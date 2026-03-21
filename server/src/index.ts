import express from 'express'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RoomManager } from './socket/roomManager'
import { GameManager } from './socket/gameManager'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Serve static files (character images)
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')))

const roomManager = new RoomManager()
const gameManager = new GameManager(io, roomManager)

// Per-IP connection limit
const connectionsPerIp = new Map<string, number>()
const MAX_CONNECTIONS_PER_IP = 10

io.use((socket, next) => {
  const ip = socket.handshake.address
  const count = connectionsPerIp.get(ip) || 0
  if (count >= MAX_CONNECTIONS_PER_IP) {
    return next(new Error('Too many connections from this IP'))
  }
  connectionsPerIp.set(ip, count + 1)
  socket.on('disconnect', () => {
    const current = connectionsPerIp.get(ip) || 1
    if (current <= 1) {
      connectionsPerIp.delete(ip)
    } else {
      connectionsPerIp.set(ip, current - 1)
    }
  })
  next()
})

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

function isValidRoomId(roomId: unknown): roomId is string {
  return typeof roomId === 'string' && /^[a-zA-Z0-9-]{1,36}$/.test(roomId)
}

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
    if (!rateLimit(socket.id, 'ready', 5, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      console.log(`ready event - socket.id: ${socket.id}, roomId: ${data.roomId}`)
      gameManager.handleReady(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('start-game', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'start-game', 2, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      console.log(`start-game event - socket.id: ${socket.id}, roomId: ${data.roomId}`)
      gameManager.handleStartGame(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('enter-free-draw', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'enter-free-draw', 2, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      gameManager.handleEnterFreeDraw(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('draw', (data) => {
    if (!rateLimit(socket.id, 'draw', 60, 1000)) return
    if (!data || !isValidRoomId(data.roomId)) return
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
    if (!rateLimit(socket.id, 'request-game-state', 5, 5000)) {
      return callback({ success: false, room: null })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, room: null })
    const room = gameManager.handleRequestGameState(socket, data.roomId)
    callback({ success: !!room, room })
  })

  socket.on('restart-game', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'restart-game', 2, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    try {
      gameManager.handleRestartGame(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('end-game', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'end-game', 2, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    try {
      gameManager.handleEndGame(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('reroll', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'reroll', 3, 20000)) {
      return callback({ success: false, error: 'Too many rerolls' })
    }
    try {
      const result = gameManager.handleReroll(socket, data.roomId)
      callback(result)
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('submit-custom-word', (data: { roomId: string; word: string }, callback) => {
    if (!rateLimit(socket.id, 'submit-custom-word', 3, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      const result = gameManager.handleSubmitCustomWord(socket, data.roomId, data.word)
      callback(result)
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('skip-turn', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'skip-turn', 2, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    try {
      gameManager.handleSkipTurn(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('kick-player', (data: { roomId: string; targetId: string }, callback) => {
    if (!rateLimit(socket.id, 'kick-player', 3, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    try {
      gameManager.handleKickPlayer(socket, data.roomId, data.targetId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('update-settings', (data: { roomId: string; settings: { theme?: string; rounds?: number; drawTime?: number; maxPlayers?: number } }, callback) => {
    if (!rateLimit(socket.id, 'update-settings', 5, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    try {
      gameManager.handleUpdateSettings(socket, data.roomId, data.settings)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('clear-canvas', (data: { roomId: string }) => {
    if (!rateLimit(socket.id, 'clear-canvas', 5, 5000)) return
    if (!isValidRoomId(data.roomId)) return
    try {
      gameManager.handleClearCanvas(socket, data.roomId)
    } catch (error) {
      console.error('[Clear] Error:', error)
    }
  })

  socket.on('undo', (data: { roomId: string }) => {
    if (!rateLimit(socket.id, 'undo', 10, 5000)) return
    if (!isValidRoomId(data.roomId)) return
    try {
      gameManager.handleUndo(socket, data.roomId)
    } catch (error) {
      console.error('[Undo] Error:', error)
    }
  })

  socket.on('vote-reaction', (data: { roomId: string; type: string }) => {
    if (!rateLimit(socket.id, 'vote-reaction', 2, 5000)) return
    if (!isValidRoomId(data.roomId)) return
    try {
      gameManager.handleVoteReaction(socket, data.roomId, data.type)
    } catch (error) {
      console.error('[Vote] Error:', error)
    }
  })

  socket.on('toggle-spectator', (data: { roomId: string }, callback) => {
    if (!rateLimit(socket.id, 'toggle-spectator', 3, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      const result = gameManager.handleToggleSpectator(socket, data.roomId)
      callback(result)
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
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
