import { Room, Player, GameConfig } from '../../../shared/types'
// @ts-ignore - uuid is installed but lacks type declarations
import { v4 as uuidv4 } from 'uuid'

export class RoomManager {
  private readonly rooms: Map<string, Room> = new Map()

  createRoom(hostId: string, username: string, config: GameConfig): Room {
    const roomId = uuidv4().substring(0, 8)
    const host: Player = {
      id: hostId,
      username,
      ready: false,
      score: 0,
      isHost: true,
    }

    const room: Room = {
      id: roomId,
      host: hostId,
      players: [host],
      state: 'lobby',
      theme: config.theme,
      round: 0,
      totalRounds: config.rounds,
      timer: config.drawTime,
      drawTime: config.drawTime,
      scores: { [hostId]: 0 },
      maxPlayers: config.maxPlayers,
      turnIndex: 0,
      correctGuessers: [],
    }

    this.rooms.set(roomId, room)
    return room
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  addPlayer(roomId: string, userId: string, username: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    if (room.players.length >= room.maxPlayers) throw new Error('Room is full')
    
    // Prevent duplicate players from the same socket
    if (room.players.some((p: Player) => p.id === userId)) {
      console.log(`Player ${userId} already in room ${roomId}, skipping add`)
      return room
    }

    const player: Player = {
      id: userId,
      username,
      ready: false,
      score: 0,
      isHost: false,
    }

    room.players.push(player)
    room.scores[userId] = 0

    return room
  }

  removePlayer(roomId: string, userId: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    room.players = room.players.filter((p: Player) => p.id !== userId)
    delete room.scores[userId]

    if (room.players.length === 0) {
      this.rooms.delete(roomId)
    }

    return room
  }

  setPlayerReady(roomId: string, userId: string, ready: boolean): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    const player = room.players.find((p: Player) => p.id === userId)
    if (player) player.ready = ready

    return room
  }

  updateRoomState(roomId: string, state: 'lobby' | 'playing' | 'results'): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    room.state = state
    return room
  }

  setDrawer(roomId: string, userId: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    room.players.forEach((p: Player) => {
      p.isDrawer = p.id === userId
    })

    room.drawer = userId
    return room
  }

  setAnswer(roomId: string, answer: string, hint: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    room.answer = answer
    room.hint = hint

    return room
  }

  updateScore(roomId: string, userId: string, points: number): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    room.scores[userId] = (room.scores[userId] || 0) + points

    return room
  }

  incrementRound(roomId: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    room.round++
    return room
  }

  resetRoundState(roomId: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    room.drawer = undefined
    room.answer = undefined
    room.hint = undefined
    room.timer = room.drawTime
    room.correctGuessers = []

    room.players.forEach((p: Player) => {
      p.ready = false
      p.isDrawer = false
    })

    return room
  }

  resetGameForRestart(roomId: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')

    room.state = 'playing'
    room.round = 0
    room.turnIndex = 0
    room.drawer = undefined
    room.answer = undefined
    room.hint = undefined
    room.timer = room.drawTime
    room.correctGuessers = []
    room.scores = {}

    room.players.forEach((p: Player) => {
      p.ready = false
      p.isDrawer = false
      p.score = 0
      room.scores[p.id] = 0
    })

    return room
  }

  resetCorrectGuessers(roomId: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    room.correctGuessers = []
    return room
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId)
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  // Sync room.scores → player.score so PlayerList / ScoreBoard show correct values
  syncPlayerScores(roomId: string): Room {
    const room = this.getRoom(roomId)
    if (!room) throw new Error('Room not found')
    room.players.forEach((p: Player) => {
      p.score = room.scores[p.id] || 0
    })
    return room
  }
}
