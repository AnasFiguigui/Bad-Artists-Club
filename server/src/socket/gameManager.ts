import { Server, Socket } from 'socket.io'
import { RoomManager } from './roomManager'
import { GameConfig, DrawStroke, Room } from '../../../shared/types'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface CharacterData {
  name: string
  hintLength: number
}

function levenshteinDistance(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[la][lb]
}

export class GameManager {
  private readonly io: Server
  private readonly roomManager: RoomManager
  private readonly timers: Map<string, NodeJS.Timeout> = new Map()
  private readonly roundStartTimes: Map<string, number> = new Map()
  private readonly characterData: Map<string, CharacterData[]> = new Map()

  constructor(io: Server, roomManager: RoomManager) {
    this.io = io
    this.roomManager = roomManager
    this.loadCharacterData()
  }

  private loadCharacterData(): void {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const dataPath = path.join(__dirname, '..', '..', '..', 'data')

    const themes = [
      { key: 'lol', file: 'lolChampions.json' },
      { key: 'elden-ring', file: 'eldenRingBosses.json' },
      { key: 'dbd', file: 'dbdKillers.json' },
    ]

    for (const { key, file } of themes) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(dataPath, file), 'utf-8')
        ) as CharacterData[]
        this.characterData.set(key, data)
        console.log(`[Data] Loaded ${data.length} characters for theme '${key}'`)
      } catch (err) {
        console.error(`[Data] Failed to load ${file}:`, err)
        this.characterData.set(key, [])
      }
    }
  }

  private selectRandomCharacter(theme: string): CharacterData {
    const characters = this.characterData.get(theme) || []
    if (characters.length === 0) return { name: 'Unknown', hintLength: 7 }
    return characters[Math.floor(Math.random() * characters.length)]
  }

  private generateHint(name: string): string {
    // Preserve spaces, replace letters with underscores
    return name.split('').map((c: string) => c === ' ' ? '  ' : '_ ').join('').trim()
  }

  handleCreateRoom(socket: Socket, data: { config: GameConfig; username: string }): string {
    const room = this.roomManager.createRoom(socket.id, data.username, data.config)
    socket.join(room.id)
    console.log(`[Room] Created room ${room.id} by ${data.username} (${socket.id})`)
    this.io.to(room.id).emit('room-created', room)
    return room.id
  }

  // Returns the room so the callback can include it
  handleJoinRoom(socket: Socket, roomId: string, username: string): Room {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    console.log(`[Room] Player ${username} (${socket.id}) joining room ${roomId}`)
    const updatedRoom = this.roomManager.addPlayer(roomId, socket.id, username)
    socket.join(roomId)
    console.log(`[Room] Room ${roomId} now has ${updatedRoom.players.length} players, state: ${updatedRoom.state}`)

    // Notify OTHER players that someone joined
    socket.to(roomId).emit('player-joined', updatedRoom)

    // Return room data — caller sends it back via callback
    // Client checks room.state to know if game is already in progress
    return updatedRoom
  }

  handleReady(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    // Toggle ready
    const player = room.players.find((p: { id: string }) => p.id === socket.id)
    if (!player) throw new Error('Player not in room')
    const newReady = !player.ready
    this.roomManager.setPlayerReady(roomId, socket.id, newReady)
    const updatedRoom = this.roomManager.getRoom(roomId)!
    console.log(`[Room] Player ${socket.id} ready=${newReady} in room ${roomId}`)

    this.io.to(roomId).emit('player-ready', updatedRoom)
  }

  handleStartGame(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.host !== socket.id) throw new Error('Only host can start game')

    console.log(`[Game] Starting game in room ${roomId}`)
    this.roomManager.updateRoomState(roomId, 'playing')

    // Reset turn tracking
    room.turnIndex = 0
    room.round = 0
    room.correctGuessers = []

    const updatedRoom = this.roomManager.getRoom(roomId)!
    this.io.to(roomId).emit('game-started', updatedRoom)

    // Delay first turn so clients can navigate from lobby to game page
    setTimeout(() => {
      this.startTurn(roomId)
    }, 1500)
  }

  private startTurn(roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) {
      console.log(`[Game] startTurn: Room ${roomId} not found`)
      return
    }

    const playerCount = room.players.length
    const totalTurns = room.totalRounds * playerCount

    if (room.turnIndex >= totalTurns) {
      // Game over
      this.roomManager.updateRoomState(roomId, 'results')
      this.roomManager.syncPlayerScores(roomId)
      const finalRoom = this.roomManager.getRoom(roomId)!
      this.io.to(roomId).emit('game-ended', finalRoom)
      return
    }

    // Calculate round and drawer from turnIndex
    const currentRound = Math.floor(room.turnIndex / playerCount) + 1
    const drawerIndex = room.turnIndex % playerCount
    const drawer = room.players[drawerIndex]

    room.round = currentRound
    console.log(`[Game] Turn ${room.turnIndex + 1}/${totalTurns}, Round ${currentRound}/${room.totalRounds}, drawer: ${drawer.username}`)

    this.roomManager.setDrawer(roomId, drawer.id)
    this.roomManager.resetCorrectGuessers(roomId)

    // Select character
    const character = this.selectRandomCharacter(room.theme)
    const hint = this.generateHint(character.name)
    console.log(`[Game] Character: "${character.name}", hint: "${hint}"`)

    this.roomManager.setAnswer(roomId, character.name, hint)
    this.roomManager.syncPlayerScores(roomId)

    const updatedRoom = this.roomManager.getRoom(roomId)!

    // Record start time for scoring
    this.roundStartTimes.set(roomId, Date.now())

    // Send to drawer WITH answer, to others WITHOUT answer
    const drawerView = { ...updatedRoom, answer: character.name }
    this.io.to(drawer.id).emit('round-start', drawerView)

    const guesserView = { ...updatedRoom, answer: undefined }
    this.io.to(roomId).except(drawer.id).emit('round-start', guesserView)

    this.startDrawingTimer(roomId)
  }

  private startDrawingTimer(roomId: string): void {
    const existing = this.timers.get(roomId)
    if (existing) clearInterval(existing)

    const room = this.roomManager.getRoom(roomId)
    if (!room) return

    let timeRemaining = room.drawTime

    const timer = setInterval(() => {
      timeRemaining--
      this.io.to(roomId).emit('timer-update', { timeRemaining })

      if (timeRemaining <= 0) {
        clearInterval(timer)
        this.timers.delete(roomId)
        this.roundStartTimes.delete(roomId)
        this.endTurn(roomId)
      }
    }, 1000)

    this.timers.set(roomId, timer)
  }

  private endTurn(roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) return

    const playerCount = room.players.length
    const totalTurns = room.totalRounds * playerCount

    // Reveal the answer to everyone
    this.io.to(roomId).emit('round-ended', {
      answer: room.answer,
      scores: room.scores,
    })

    // Advance to next turn
    room.turnIndex++

    if (room.turnIndex < totalTurns) {
      this.roomManager.resetRoundState(roomId)
      // 5 second cooldown between turns
      this.io.to(roomId).emit('turn-cooldown', { seconds: 5 })
      setTimeout(() => this.startTurn(roomId), 5000)
    } else {
      this.roomManager.updateRoomState(roomId, 'results')
      this.roomManager.syncPlayerScores(roomId)
      const finalRoom = this.roomManager.getRoom(roomId)!
      this.io.to(roomId).emit('game-ended', finalRoom)
    }
  }

  // Called by game page on mount to recover state after navigation
  handleRequestGameState(socket: Socket, roomId: string): Room | null {
    const room = this.roomManager.getRoom(roomId)
    if (!room) return null

    const isPlayer = room.players.some((p: { id: string }) => p.id === socket.id)
    if (!isPlayer) return null

    // Drawer sees the answer, others don't
    if (room.drawer === socket.id) {
      return { ...room }
    }
    return { ...room, answer: undefined }
  }

  handleDraw(socket: Socket, stroke: DrawStroke): void {
    const room = this.roomManager.getRoom(stroke.roomId)
    if (!room?.drawer || room.drawer !== socket.id) return

    // BUG FIX: Only broadcast to OTHER players (drawer already sees their own strokes)
    socket.to(stroke.roomId).emit('draw', stroke)
  }

  handleChatMessage(socket: Socket, roomId: string, message: string): { success: boolean; isCorrect?: boolean } {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    const player = room.players.find((p: { id: string }) => p.id === socket.id)
    if (!player) throw new Error('Player not in room')

    // Drawer cannot guess
    if (player.isDrawer) {
      return { success: false }
    }

    // Already guessed correctly this turn
    if (room.correctGuessers.includes(socket.id)) {
      return { success: false }
    }

    const isCorrect = room.answer
      ? message.trim().toLowerCase() === room.answer.toLowerCase()
      : false

    // Check close guess (Levenshtein distance <= 2, but not exact)
    const isClose = !isCorrect && room.answer
      ? levenshteinDistance(message.trim().toLowerCase(), room.answer.toLowerCase()) <= 2
      : false

    if (isCorrect) {
      // Track correct guesser position
      room.correctGuessers.push(socket.id)
      const position = room.correctGuessers.length

      const ordinal = position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`

      // System message visible to EVERYONE (green)
      const correctMsg = {
        userId: socket.id,
        username: player.username,
        message: `${player.username} guessed correctly! (${ordinal})`,
        timestamp: Date.now(),
        isCorrect: true,
        isSystem: true,
        guessPosition: position,
      }
      this.io.to(roomId).emit('chat-message', correctMsg)

      // Score calculation
      const roundStart = this.roundStartTimes.get(roomId) || Date.now()
      const elapsedSeconds = Math.floor((Date.now() - roundStart) / 1000)
      const points = Math.max(1000 - elapsedSeconds * 5, 100)

      this.roomManager.updateScore(roomId, socket.id, points)

      const drawerPoints = Math.floor(points * 0.7)
      if (room.drawer) {
        this.roomManager.updateScore(roomId, room.drawer, drawerPoints)
      }

      this.roomManager.syncPlayerScores(roomId)

      const updatedRoom = this.roomManager.getRoom(roomId)!
      this.io.to(roomId).emit('guess-correct', { ...updatedRoom, answer: room.answer })

      // Check if all non-drawer players have guessed
      const nonDrawerPlayers = room.players.filter((p: { id: string }) => p.id !== room.drawer)
      if (room.correctGuessers.length >= nonDrawerPlayers.length) {
        // Everyone guessed, end turn early
        const timer = this.timers.get(roomId)
        if (timer) clearInterval(timer)
        this.timers.delete(roomId)
        this.roundStartTimes.delete(roomId)
        setTimeout(() => this.endTurn(roomId), 3000)
      }

      return { success: true, isCorrect: true }
    }

    if (isClose) {
      // Send close-guess message ONLY to the guesser (private)
      const closeMsg = {
        userId: socket.id,
        username: player.username,
        message: 'Your guess was close to the word!',
        timestamp: Date.now(),
        isClose: true,
        isSystem: true,
      }
      socket.emit('chat-message', closeMsg)

      // Send the actual message to drawer only (drawer sees all)
      if (room.drawer) {
        const drawerMsg = {
          userId: socket.id,
          username: player.username,
          message,
          timestamp: Date.now(),
        }
        this.io.to(room.drawer).emit('chat-message', drawerMsg)
      }

      return { success: true, isCorrect: false }
    }

    // Normal message: broadcast to everyone
    const chatMsg = {
      userId: socket.id,
      username: player.username,
      message,
      timestamp: Date.now(),
    }
    this.io.to(roomId).emit('chat-message', chatMsg)

    return { success: true, isCorrect: false }
  }

  handleLeaveRoom(socket: Socket): void {
    const rooms = this.roomManager.getAllRooms()
    for (const room of rooms) {
      const player = room.players.find((p: { id: string }) => p.id === socket.id)
      if (player) {
        socket.leave(room.id)
        this.roomManager.removePlayer(room.id, socket.id)
        this.cleanupAfterLeave(room, socket.id)
        break
      }
    }
  }

  handleDisconnect(socket: Socket): void {
    this.handleLeaveRoom(socket)
  }

  handleRestartGame(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.host !== socket.id) throw new Error('Only host can restart game')

    console.log(`[Game] Restarting game in room ${roomId}`)

    // Clear any running timers
    const timer = this.timers.get(roomId)
    if (timer) clearInterval(timer)
    this.timers.delete(roomId)
    this.roundStartTimes.delete(roomId)

    this.roomManager.resetGameForRestart(roomId)

    const updatedRoom = this.roomManager.getRoom(roomId)!
    this.io.to(roomId).emit('game-restarted', updatedRoom)

    // Start first turn after delay
    setTimeout(() => {
      this.startTurn(roomId)
    }, 1500)
  }

  handleReroll(socket: Socket, roomId: string): { success: boolean; answer?: string; hint?: string } {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.drawer !== socket.id) throw new Error('Only the drawer can reroll')

    const character = this.selectRandomCharacter(room.theme)
    const hint = this.generateHint(character.name)
    this.roomManager.setAnswer(roomId, character.name, hint)

    console.log(`[Game] Reroll in ${roomId}: new character "${character.name}"`)

    // Send new hint to all guessers
    this.io.to(roomId).except(socket.id).emit('reroll', { hint })
    return { success: true, answer: character.name, hint }
  }

  handleSkipTurn(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.drawer !== socket.id) throw new Error('Only the drawer can skip')

    console.log(`[Game] Drawer ${socket.id} skipping turn in ${roomId}`)

    // Clear timer
    const timer = this.timers.get(roomId)
    if (timer) clearInterval(timer)
    this.timers.delete(roomId)
    this.roundStartTimes.delete(roomId)

    // Announce skip
    const player = room.players.find((p: { id: string }) => p.id === socket.id)
    this.io.to(roomId).emit('chat-message', {
      userId: 'system',
      username: 'System',
      message: `${player?.username || 'Drawer'} skipped their turn!`,
      timestamp: Date.now(),
      isSystem: true,
    })

    this.endTurn(roomId)
  }

  handleKickPlayer(socket: Socket, roomId: string, targetId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.host !== socket.id) throw new Error('Only the host can kick players')
    if (targetId === socket.id) throw new Error('Cannot kick yourself')

    const target = room.players.find((p: { id: string }) => p.id === targetId)
    if (!target) throw new Error('Player not found')

    console.log(`[Game] Host kicking ${target.username} from ${roomId}`)

    // Notify the kicked player
    this.io.to(targetId).emit('kicked')

    // Remove from room
    this.roomManager.removePlayer(roomId, targetId)

    // If the kicked player was drawing, end the turn
    if (room.drawer === targetId && room.state === 'playing') {
      const timer = this.timers.get(roomId)
      if (timer) clearInterval(timer)
      this.timers.delete(roomId)
      this.roundStartTimes.delete(roomId)
      this.endTurn(roomId)
    }

    const updatedRoom = this.roomManager.getRoom(roomId)
    if (updatedRoom) {
      this.io.to(roomId).emit('player-left', updatedRoom)
      this.io.to(roomId).emit('chat-message', {
        userId: 'system',
        username: 'System',
        message: `${target.username} was kicked by the host.`,
        timestamp: Date.now(),
        isSystem: true,
      })
    }
  }

  handleClearCanvas(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.drawer !== socket.id) throw new Error('Only the drawer can clear')

    // Broadcast clear to ALL players in the room (including drawer)
    this.io.to(roomId).emit('canvas-cleared')
  }

  handleUndo(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.drawer !== socket.id) throw new Error('Only the drawer can undo')

    // Broadcast undo to all other players (drawer already undid locally)
    socket.to(roomId).emit('undo')
  }

  private cleanupAfterLeave(room: Room, leftSocketId: string): void {
    const updatedRoom = this.roomManager.getRoom(room.id)

    if (!updatedRoom || updatedRoom.players.length === 0) {
      const timer = this.timers.get(room.id)
      if (timer) clearInterval(timer)
      this.timers.delete(room.id)
      this.roundStartTimes.delete(room.id)
      this.roomManager.deleteRoom(room.id)
      console.log(`[Room] Deleted empty room ${room.id}`)
      return
    }

    // Transfer host if needed
    if (room.host === leftSocketId) {
      updatedRoom.host = updatedRoom.players[0].id
      updatedRoom.players[0].isHost = true
      console.log(`[Room] Host transferred to ${updatedRoom.players[0].username}`)
    }

    // If the drawer left during a game, end the turn early
    if (room.state === 'playing' && room.drawer === leftSocketId) {
      const timer = this.timers.get(room.id)
      if (timer) clearInterval(timer)
      this.timers.delete(room.id)
      this.roundStartTimes.delete(room.id)
      this.endTurn(room.id)
    }

    this.io.to(room.id).emit('player-left', updatedRoom)
  }
}
