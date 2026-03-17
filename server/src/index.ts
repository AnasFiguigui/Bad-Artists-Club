import express from 'express'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import cors from 'cors'
import { RoomManager } from './socket/roomManager'
import { GameManager } from './socket/gameManager'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || /^http:\/\/localhost:\d+$/,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  perMessageDeflate: true,
})

app.use(cors({
  origin: process.env.FRONTEND_URL || /^http:\/\/localhost:\d+$/,
}))
app.use(express.json())

const roomManager = new RoomManager()
const gameManager = new GameManager(io, roomManager)

// Simple per-socket rate limiter
const rateLimits = new Map<string, Map<string, number[]>>()

function rateLimit(socketId: string, event: string, max: number, windowMs: number): boolean {
  if (!rateLimits.has(socketId)) rateLimits.set(socketId, new Map())
  const events = rateLimits.get(socketId)!
  const now = Date.now()
  const timestamps = (events.get(event) || []).filter(t => now - t < windowMs)
  if (timestamps.length >= max) return false
  timestamps.push(now)
  events.set(event, timestamps)
  return true
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Socket.IO events
io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.on('join-room', (data: { roomId: string; username: string }, callback) => {
    if (!rateLimit(socket.id, 'join-room', 5, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    try {
      const room = gameManager.handleJoinRoom(socket, data.roomId, data.username)
      callback({ success: true, room })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('create-room', (data, callback) => {
    if (!rateLimit(socket.id, 'create-room', 3, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    try {
      const roomId = gameManager.handleCreateRoom(socket, data)
      callback({ success: true, roomId })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('ready', (data: { roomId: string }, callback) => {
    try {
      console.log(`ready event - socket.id: ${socket.id}, roomId: ${data.roomId}`)
      gameManager.handleReady(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('start-game', (data: { roomId: string }, callback) => {
    try {
      console.log(`start-game event - socket.id: ${socket.id}, roomId: ${data.roomId}`)
      gameManager.handleStartGame(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('draw', (data) => {
    if (!rateLimit(socket.id, 'draw', 60, 1000)) return
    gameManager.handleDraw(socket, data)
  })

  socket.on('chat-message', (data: { roomId: string; message: string }, callback) => {
    if (!rateLimit(socket.id, 'chat-message', 3, 2000)) {
      return callback({ success: false, error: 'Sending too fast' })
    }
    try {
      const result = gameManager.handleChatMessage(socket, data.roomId, data.message)
      callback(result)
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('request-game-state', (data: { roomId: string }, callback) => {
    const room = gameManager.handleRequestGameState(socket, data.roomId)
    callback({ success: !!room, room })
  })

  socket.on('restart-game', (data: { roomId: string }, callback) => {
    try {
      gameManager.handleRestartGame(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('reroll', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'reroll', 1, 5000)) {
      return callback({ success: false, error: 'Too many rerolls' })
    }
    try {
      const result = gameManager.handleReroll(socket, data.roomId)
      callback(result)
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('skip-turn', (data: { roomId: string }, callback) => {
    try {
      gameManager.handleSkipTurn(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('kick-player', (data: { roomId: string; targetId: string }, callback) => {
    try {
      gameManager.handleKickPlayer(socket, data.roomId, data.targetId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('update-settings', (data: { roomId: string; settings: { theme?: string; rounds?: number; drawTime?: number; maxPlayers?: number } }, callback) => {
    try {
      gameManager.handleUpdateSettings(socket, data.roomId, data.settings)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('clear-canvas', (data: { roomId: string }) => {
    try {
      gameManager.handleClearCanvas(socket, data.roomId)
    } catch (error) {
      console.error('[Clear] Error:', error)
    }
  })

  socket.on('undo', (data: { roomId: string }) => {
    try {
      gameManager.handleUndo(socket, data.roomId)
    } catch (error) {
      console.error('[Undo] Error:', error)
    }
  })

  socket.on('leave-room', () => {
    gameManager.handleLeaveRoom(socket)
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    gameManager.handleDisconnect(socket)
    rateLimits.delete(socket.id)
  })
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export { io, roomManager, gameManager }
