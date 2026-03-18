import { Server, Socket } from 'socket.io'
import { RoomManager } from './roomManager'
import { GameConfig, DrawStroke, Room } from '../../../shared/types'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface CharacterData {
  name: string
  hintLength: number
  altName?: string
}

function levenshteinDistance(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => {
      if (i === 0) return j
      if (j === 0) return i
      return 0
    })
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
  private readonly canvasStrokes: Map<string, DrawStroke[]> = new Map()
  private readonly cooldownRooms: Set<string> = new Set()
  // Per-room draw event counter for flood protection
  private readonly roomDrawCounts: Map<string, { count: number; resetTime: number }> = new Map()
  private readonly customWordTimers: Map<string, NodeJS.Timeout> = new Map()
  // Alt answers for characters with alternate names (e.g. Executioner = Pyramid Head)
  private readonly altAnswers: Map<string, string> = new Map()
  private static readonly MAX_ROOM_DRAWS_PER_SECOND = 120

  constructor(io: Server, roomManager: RoomManager) {
    this.io = io
    this.roomManager = roomManager
    this.loadCharacterData()
  }

  /** Strip sensitive fields (answer) from room before broadcasting to guessers */
  private sanitizeRoom(room: Room): Room {
    const { answer, ...safe } = room
    return safe as Room
  }

  private loadCharacterData(): void {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const dataPath = path.join(__dirname, '..', '..', '..', 'data')

    const themes = [
      { key: 'lol', file: 'lolChampions.json' },
      { key: 'elden-ring', file: 'eldenRingBosses.json' },
      { key: 'dbd', file: 'dbdKillers.json' },
      { key: 'game-titles', file: 'gameTitles.json' },
      { key: 'anime', file: 'animeCharacters.json' },
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

  private validateUsername(name: unknown): string {
    if (typeof name !== 'string') throw new Error('Invalid username')
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 20) throw new Error('Username must be 1-20 characters')
    if (!/^[a-zA-Z0-9_ -]{1,20}$/.test(trimmed)) throw new Error('Username can only contain letters, numbers, spaces, hyphens, and underscores')
    return trimmed
  }

  handleCreateRoom(socket: Socket, data: { config: GameConfig; username: string }): string {
    // Leave any existing room first
    this.handleLeaveRoom(socket)

    const username = this.validateUsername(data.username)

    // Validate GameConfig
    const validThemes = ['lol', 'elden-ring', 'dbd', 'game-titles', 'anime', 'custom']
    const validDrawTimes = [60, 90, 120]
    if (!data.config || typeof data.config !== 'object') throw new Error('Invalid config')
    if (!validThemes.includes(data.config.theme)) throw new Error('Invalid theme')
    if (typeof data.config.rounds !== 'number' || data.config.rounds < 1 || data.config.rounds > 10) throw new Error('Invalid rounds')
    if (!validDrawTimes.includes(data.config.drawTime)) throw new Error('Invalid draw time')
    if (typeof data.config.maxPlayers !== 'number' || data.config.maxPlayers < 2 || data.config.maxPlayers > 20) {
      throw new Error('Invalid max players')
    }

    const room = this.roomManager.createRoom(socket.id, username, data.config)
    socket.join(room.id)
    console.log(`[Room] Created room ${room.id} by ${username} (${socket.id})`)
    this.io.to(room.id).emit('room-created', room)
    return room.id
  }

  // Returns the room so the callback can include it
  handleJoinRoom(socket: Socket, roomId: string, username: string): Room {
    const validatedUsername = this.validateUsername(username)

    // Leave any existing room first
    this.handleLeaveRoom(socket)

    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    console.log(`[Room] Player ${validatedUsername} (${socket.id}) joining room ${roomId}`)
    const updatedRoom = this.roomManager.addPlayer(roomId, socket.id, validatedUsername)
    socket.join(roomId)
    console.log(`[Room] Room ${roomId} now has ${updatedRoom.players.length} players, state: ${updatedRoom.state}`)

    // Notify OTHER players that someone joined
    socket.to(roomId).emit('player-joined', this.sanitizeRoom(updatedRoom))

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

  handleEnterFreeDraw(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.host !== socket.id) throw new Error('Only host can enter free draw')
    if (room.state === 'playing') throw new Error('Game already in progress')

    console.log(`[Game] Host entering free draw in room ${roomId}`)
    this.roomManager.updateRoomState(roomId, 'results')
    const updatedRoom = this.roomManager.getRoom(roomId)!
    this.io.to(roomId).emit('game-started', updatedRoom)
  }

  handleStartGame(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.host !== socket.id) throw new Error('Only host can start game')
    if (room.players.length < 2) throw new Error('Need at least 2 players to start')

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

    // Clear canvas strokes for new turn
    this.canvasStrokes.set(roomId, [])

    // Custom theme: drawer chooses a word
    if (room.theme === 'custom') {
      this.roomManager.setAnswer(roomId, '', '')
      this.roomManager.syncPlayerScores(roomId)

      const updatedRoom = this.roomManager.getRoom(roomId)!

      // Send to drawer — tell them to choose a word
      this.io.to(drawer.id).emit('round-start', { ...updatedRoom, answer: undefined, customChoosing: true })
      // Send to guessers — waiting
      this.io.to(roomId).except(drawer.id).emit('round-start', { ...updatedRoom, answer: undefined, customChoosing: false })

      // Emit choose-word to drawer with 45 sec
      this.io.to(drawer.id).emit('choose-word', { timeLimit: 45 })

      // Start 45-sec timer for word selection
      let wordTimeRemaining = 45
      const wordTimer = setInterval(() => {
        wordTimeRemaining--
        this.io.to(roomId).emit('timer-update', { timeRemaining: wordTimeRemaining })
        if (wordTimeRemaining <= 0) {
          clearInterval(wordTimer)
          this.customWordTimers.delete(roomId)
          // Drawer didn't choose — skip turn
          this.io.to(roomId).emit('chat-message', {
            userId: 'system',
            username: 'System',
            message: `${drawer.username} didn't choose a word — turn skipped!`,
            timestamp: Date.now(),
            isSystem: true,
          })
          this.endTurn(roomId)
        }
      }, 1000)
      this.customWordTimers.set(roomId, wordTimer)
      return
    }

    // Select character
    const character = this.selectRandomCharacter(room.theme)
    const hint = this.generateHint(character.name)
    console.log(`[Game] Character: "${character.name}", hint: "${hint}"`)

    this.roomManager.setAnswer(roomId, character.name, hint)
    // Store alt answer if available
    if (character.altName) {
      this.altAnswers.set(roomId, character.altName)
    } else {
      this.altAnswers.delete(roomId)
    }
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
      this.cooldownRooms.add(roomId)
      this.io.to(roomId).emit('turn-cooldown', { seconds: 5 })
      setTimeout(() => {
        this.cooldownRooms.delete(roomId)
        this.startTurn(roomId)
      }, 5000)
    } else {
      this.roomManager.updateRoomState(roomId, 'results')
      this.roomManager.syncPlayerScores(roomId)
      const finalRoom = this.roomManager.getRoom(roomId)!
      this.io.to(roomId).emit('game-ended', finalRoom)
    }
  }

  // Called by game page on mount to recover state after navigation
  handleRequestGameState(socket: Socket, roomId: string): (Room & { canvasStrokes?: DrawStroke[] }) | null {
    const room = this.roomManager.getRoom(roomId)
    if (!room) return null

    const isPlayer = room.players.some((p: { id: string }) => p.id === socket.id)
    if (!isPlayer) return null

    // Include canvas strokes for mid-game joiners
    const strokes = this.canvasStrokes.get(roomId) || []

    // Drawer sees the answer, others don't
    if (room.drawer === socket.id) {
      return { ...room, canvasStrokes: strokes }
    }
    return { ...room, answer: undefined, canvasStrokes: strokes }
  }

  private validateStroke(stroke: DrawStroke): boolean {
    if (!stroke || typeof stroke !== 'object') return false
    if (typeof stroke.roomId !== 'string' || !/^[a-zA-Z0-9-]{1,36}$/.test(stroke.roomId)) return false
    const maxPoints = stroke.partial ? 50 : 5000
    if (!Array.isArray(stroke.points) || stroke.points.length > maxPoints) return false
    if (typeof stroke.size !== 'number' || stroke.size < 1 || stroke.size > 100) return false
    if (typeof stroke.color !== 'string' || stroke.color.length > 20) return false
    if (!['brush', 'eraser', 'fill', 'line', 'oval', 'rect', 'roundedRect', 'triangle', 'callout'].includes(stroke.tool)) return false
    if (stroke.partial !== undefined && typeof stroke.partial !== 'boolean') return false
    for (const p of stroke.points) {
      if (typeof p.x !== 'number' || typeof p.y !== 'number') return false
      if (p.x < 0 || p.x > 1280 || p.y < 0 || p.y > 720) return false
    }
    return true
  }

  /** Per-room draw flood protection — returns false if room exceeded draw rate */
  private isRoomDrawAllowed(roomId: string): boolean {
    const now = Date.now()
    const entry = this.roomDrawCounts.get(roomId)
    if (!entry || now >= entry.resetTime) {
      this.roomDrawCounts.set(roomId, { count: 1, resetTime: now + 1000 })
      return true
    }
    entry.count++
    return entry.count <= GameManager.MAX_ROOM_DRAWS_PER_SECOND
  }

  private relayStroke(socket: Socket, stroke: DrawStroke): void {
    if (stroke.partial) {
      socket.to(stroke.roomId).emit('draw', stroke)
      return
    }
    const strokes = this.canvasStrokes.get(stroke.roomId) || []
    if (strokes.length < 2000) {
      strokes.push(stroke)
      this.canvasStrokes.set(stroke.roomId, strokes)
    }
    socket.to(stroke.roomId).emit('draw', stroke)
  }

  handleDraw(socket: Socket, stroke: DrawStroke): void {
    if (!this.validateStroke(stroke)) return
    if (!this.isRoomDrawAllowed(stroke.roomId)) return

    const room = this.roomManager.getRoom(stroke.roomId)

    // Block drawing during cooldown
    if (this.cooldownRooms.has(stroke.roomId) && room?.state !== 'results') return

    // In 'results' state, allow everyone in the room to draw (free draw mode)
    if (room?.state === 'results') {
      if (!room.players.some((p: { id: string }) => p.id === socket.id)) return
      this.relayStroke(socket, stroke)
      return
    }

    if (!room?.drawer || room.drawer !== socket.id) return
    this.relayStroke(socket, stroke)
  }

  private handleCorrectGuess(socket: Socket, roomId: string, room: Room, player: { username: string }): { success: boolean; isCorrect: boolean } {
    room.correctGuessers.push(socket.id)
    const position = room.correctGuessers.length
    const ordinals: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' }
    const ordinal = ordinals[position] || `${position}th`

    this.io.to(roomId).emit('chat-message', {
      userId: socket.id,
      username: player.username,
      message: `${player.username} guessed correctly! (${ordinal})`,
      timestamp: Date.now(),
      isCorrect: true,
      isSystem: true,
      guessPosition: position,
    })

    const roundStart = this.roundStartTimes.get(roomId) || Date.now()
    const elapsedSeconds = Math.floor((Date.now() - roundStart) / 1000)
    const points = Math.max(1000 - elapsedSeconds * 5, 100)

    this.roomManager.updateScore(roomId, socket.id, points)
    if (room.drawer) {
      this.roomManager.updateScore(roomId, room.drawer, Math.floor(points * 0.7))
    }

    this.roomManager.syncPlayerScores(roomId)

    const updatedRoom = this.roomManager.getRoom(roomId)!
    const revealedIds = new Set([...room.correctGuessers, ...(room.drawer ? [room.drawer] : [])])
    for (const p of room.players) {
      const showAnswer = revealedIds.has(p.id)
      this.io.to(p.id).emit('guess-correct', { ...updatedRoom, answer: showAnswer ? room.answer : undefined })
    }

    const nonDrawerPlayers = room.players.filter((p: { id: string }) => p.id !== room.drawer)
    if (room.correctGuessers.length >= nonDrawerPlayers.length) {
      const timer = this.timers.get(roomId)
      if (timer) clearInterval(timer)
      this.timers.delete(roomId)
      this.roundStartTimes.delete(roomId)
      setTimeout(() => this.endTurn(roomId), 3000)
    }

    return { success: true, isCorrect: true }
  }

  private handleCloseGuess(socket: Socket, room: Room, player: { username: string }, message: string): { success: boolean; isCorrect: boolean } {
    socket.emit('chat-message', {
      userId: socket.id,
      username: player.username,
      message: 'Your guess was close to the word!',
      timestamp: Date.now(),
      isClose: true,
      isSystem: true,
    })

    if (room.drawer) {
      this.io.to(room.drawer).emit('chat-message', {
        userId: socket.id,
        username: player.username,
        message,
        timestamp: Date.now(),
      })
    }

    return { success: true, isCorrect: false }
  }

  handleChatMessage(socket: Socket, roomId: string, message: string): { success: boolean; isCorrect?: boolean } {
    if (typeof message !== 'string' || message.length === 0 || message.length > 200) {
      return { success: false }
    }

    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    const player = room.players.find((p: { id: string }) => p.id === socket.id)
    if (!player) throw new Error('Player not in room')

    if (this.cooldownRooms.has(roomId) && room.state !== 'results') {
      return { success: false }
    }

    if (room.state === 'results') {
      this.io.to(roomId).emit('chat-message', {
        userId: socket.id, username: player.username, message, timestamp: Date.now(),
      })
      return { success: true, isCorrect: false }
    }

    if (player.isDrawer || room.correctGuessers.includes(socket.id)) {
      return { success: false }
    }

    const guess = message.trim().toLowerCase()
    const answer = room.answer?.toLowerCase() || ''
    // Strip optional "the " prefix from guess for DBD-style names
    const normalizedGuess = guess.startsWith('the ') ? guess.slice(4) : guess
    const altAnswer = this.altAnswers.get(roomId)?.toLowerCase() || ''
    const isCorrect = answer !== '' && (normalizedGuess === answer || (altAnswer !== '' && normalizedGuess === altAnswer))
    const isClose = !isCorrect && answer !== '' && (levenshteinDistance(normalizedGuess, answer) <= 2 || (altAnswer !== '' && levenshteinDistance(normalizedGuess, altAnswer) <= 2))

    if (isCorrect) return this.handleCorrectGuess(socket, roomId, room, player)
    if (isClose) return this.handleCloseGuess(socket, room, player, message)

    this.io.to(roomId).emit('chat-message', {
      userId: socket.id, username: player.username, message, timestamp: Date.now(),
    })
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
    if (room.players.length < 2) throw new Error('Need at least 2 players to start')

    console.log(`[Game] Restarting game in room ${roomId}`)

    // Clear any running timers
    const timer = this.timers.get(roomId)
    if (timer) clearInterval(timer)
    this.timers.delete(roomId)
    this.roundStartTimes.delete(roomId)
    this.canvasStrokes.delete(roomId)
    this.cooldownRooms.delete(roomId)
    this.roomDrawCounts.delete(roomId)
    this.altAnswers.delete(roomId)
    const cwTimer = this.customWordTimers.get(roomId)
    if (cwTimer) clearInterval(cwTimer)
    this.customWordTimers.delete(roomId)

    this.roomManager.resetGameForRestart(roomId)

    const updatedRoom = this.roomManager.getRoom(roomId)!
    this.io.to(roomId).emit('game-restarted', updatedRoom)

    // Start first turn after delay
    setTimeout(() => {
      this.startTurn(roomId)
    }, 1500)
  }

  handleEndGame(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.host !== socket.id) throw new Error('Only host can end game')
    if (room.state !== 'playing') throw new Error('Game is not in progress')

    console.log(`[Game] Host ending game early in room ${roomId}`)

    // Clear any running timers
    const timer = this.timers.get(roomId)
    if (timer) clearInterval(timer)
    this.timers.delete(roomId)
    this.roundStartTimes.delete(roomId)
    this.cooldownRooms.delete(roomId)
    const cwTimer2 = this.customWordTimers.get(roomId)
    if (cwTimer2) clearInterval(cwTimer2)
    this.customWordTimers.delete(roomId)

    this.roomManager.updateRoomState(roomId, 'results')
    this.roomManager.syncPlayerScores(roomId)
    const finalRoom = this.roomManager.getRoom(roomId)!
    this.io.to(roomId).emit('game-ended', finalRoom)
  }

  handleReroll(socket: Socket, roomId: string): { success: boolean; answer?: string; hint?: string } {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.drawer !== socket.id) throw new Error('Only the drawer can reroll')
    if (room.theme === 'custom') throw new Error('Cannot reroll in custom mode')

    const character = this.selectRandomCharacter(room.theme)
    const hint = this.generateHint(character.name)
    this.roomManager.setAnswer(roomId, character.name, hint)
    if (character.altName) {
      this.altAnswers.set(roomId, character.altName)
    } else {
      this.altAnswers.delete(roomId)
    }

    console.log(`[Game] Reroll in ${roomId}: new character "${character.name}"`)

    // Send new hint to all guessers
    this.io.to(roomId).except(socket.id).emit('reroll', { hint })
    return { success: true, answer: character.name, hint }
  }

  handleSubmitCustomWord(socket: Socket, roomId: string, word: string): { success: boolean; error?: string } {
    if (typeof word !== 'string') return { success: false, error: 'Invalid word' }
    const trimmed = word.trim()
    if (trimmed.length < 1 || trimmed.length > 16) return { success: false, error: 'Word must be 1-16 characters' }
    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) return { success: false, error: 'Only letters, numbers, and spaces allowed' }

    const room = this.roomManager.getRoom(roomId)
    if (!room) return { success: false, error: 'Room not found' }
    if (room.drawer !== socket.id) return { success: false, error: 'Only the drawer can submit a word' }
    if (room.theme !== 'custom') return { success: false, error: 'Not a custom game' }

    // Clear the word selection timer
    const wordTimer = this.customWordTimers.get(roomId)
    if (wordTimer) {
      clearInterval(wordTimer)
      this.customWordTimers.delete(roomId)
    }

    // Set the answer and hint
    const hint = this.generateHint(trimmed)
    this.roomManager.setAnswer(roomId, trimmed, hint)
    console.log(`[Game] Custom word in ${roomId}: "${trimmed}"`)

    // Record start time for scoring
    this.roundStartTimes.set(roomId, Date.now())

    // Notify drawer their word was accepted
    this.io.to(socket.id).emit('custom-word-accepted', { answer: trimmed, hint })
    // Send hint to guessers
    this.io.to(roomId).except(socket.id).emit('custom-word-accepted', { hint })

    // Start the drawing timer
    this.startDrawingTimer(roomId)

    return { success: true }
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

  handleUpdateSettings(socket: Socket, roomId: string, settings: { theme?: string; rounds?: number; drawTime?: number; maxPlayers?: number }): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.host !== socket.id) throw new Error('Only the host can update settings')
    if (room.state === 'playing') throw new Error('Cannot change settings while game is in progress')

    const validThemes = ['lol', 'elden-ring', 'dbd', 'game-titles', 'anime', 'custom']
    const validRounds = [3, 5, 8, 10]
    const validDrawTimes = [60, 90, 120]

    if (settings.theme && validThemes.includes(settings.theme)) {
      room.theme = settings.theme as Room['theme']
    }
    if (settings.rounds && validRounds.includes(settings.rounds)) {
      room.totalRounds = settings.rounds
    }
    if (settings.drawTime && validDrawTimes.includes(settings.drawTime)) {
      room.drawTime = settings.drawTime
      room.timer = settings.drawTime
    }
    if (settings.maxPlayers && settings.maxPlayers >= 2 && settings.maxPlayers <= 20) {
      room.maxPlayers = settings.maxPlayers
    }

    this.io.to(roomId).emit('settings-updated', this.sanitizeRoom(room))
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
      this.io.to(roomId).emit('player-left', this.sanitizeRoom(updatedRoom))
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
    if (room.state !== 'results' && room.drawer !== socket.id) throw new Error('Only the drawer can clear')

    // Clear stored strokes
    this.canvasStrokes.set(roomId, [])

    // Broadcast clear to ALL players in the room (including sender)
    this.io.to(roomId).emit('canvas-cleared')
  }

  handleUndo(socket: Socket, roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.state !== 'results' && room.drawer !== socket.id) throw new Error('Only the drawer can undo')

    // Remove last stroke from stored history
    const strokes = this.canvasStrokes.get(roomId)
    if (strokes && strokes.length > 0) {
      strokes.pop()
    }

    // Broadcast undo to all other players (sender already undid locally)
    socket.to(roomId).emit('undo')
  }

  private cleanupAfterLeave(room: Room, leftSocketId: string): void {
    const updatedRoom = this.roomManager.getRoom(room.id)

    if (!updatedRoom || updatedRoom.players.length === 0) {
      const timer = this.timers.get(room.id)
      if (timer) clearInterval(timer)
      this.timers.delete(room.id)
      this.roundStartTimes.delete(room.id)
      this.canvasStrokes.delete(room.id)
      this.cooldownRooms.delete(room.id)
      this.roomDrawCounts.delete(room.id)
      this.roomManager.deleteRoom(room.id)
      console.log(`[Room] Deleted empty room ${room.id}`)
      return
    }

    // Transfer host if needed
    if (room.host === leftSocketId) {
      updatedRoom.host = updatedRoom.players[0].id
      updatedRoom.players[0].isHost = true
      console.log(`[Room] Host transferred to ${updatedRoom.players[0].username}`)
      this.io.to(room.id).emit('host-changed', {
        newHostId: updatedRoom.host,
        newHostUsername: updatedRoom.players[0].username,
      })
    }

    // If the drawer left during a game, end the turn early
    if (room.state === 'playing' && room.drawer === leftSocketId) {
      const timer = this.timers.get(room.id)
      if (timer) clearInterval(timer)
      this.timers.delete(room.id)
      this.roundStartTimes.delete(room.id)
      this.endTurn(room.id)
    }

    this.io.to(room.id).emit('player-left', this.sanitizeRoom(updatedRoom))
  }
}
