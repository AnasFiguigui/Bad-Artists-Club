import express from 'express'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RoomManager } from './socket/roomManager.js'
import { GameManager } from './socket/gameManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Find server root (dir with package.json) - works in both dev (src/) and prod (dist/server/src/)
let serverRoot = __dirname
while (!fs.existsSync(path.join(serverRoot, 'package.json'))) {
  serverRoot = path.dirname(serverRoot)
}

// Validate required env vars in production
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is required in production')
}

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || /^http:\/\/localhost:\d+$/,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  perMessageDeflate: process.env.NODE_ENV !== 'production',
  maxHttpBufferSize: 1e5, // 100KB max message
})

app.use(cors({
  origin: process.env.FRONTEND_URL || /^http:\/\/localhost:\d+$/,
}))
app.use(express.json({ limit: '1kb' }))

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-XSS-Protection', '0')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})

// Serve static files (character images) with path traversal protection and cache
app.use('/images', (req, res, next) => {
  const decodedPath = decodeURIComponent(req.path)
  if (decodedPath.includes('..') || !/^\/[a-zA-Z0-9_\-./]+$/.test(decodedPath)) {
    return res.status(400).json({ error: 'Invalid path' })
  }
  next()
}, express.static(path.join(serverRoot, 'public', 'images'), { maxAge: '7d' }))

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
  return typeof roomId === 'string' && /^[a-f0-9-]{36}$/.test(roomId)
}

// Socket.IO events
io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.on('join-room', (data: { roomId: string; username: string }, callback) => {
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'join-room', 5, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      const room = gameManager.handleJoinRoom(socket, data.roomId, data.username)
      callback({ success: true, room })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('create-room', (data, callback) => {
    if (typeof callback !== 'function') return
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
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'chat-message', 2, 2000)) {
      return callback({ success: false, error: 'Sending too fast' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
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
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'restart-game', 2, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      gameManager.handleRestartGame(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('end-game', (data: { roomId: string }, callback) => {
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'end-game', 2, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      gameManager.handleEndGame(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('reroll', (data: { roomId: string }, callback) => {
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'reroll', 3, 20000)) {
      return callback({ success: false, error: 'Too many rerolls' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
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
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'skip-turn', 2, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      gameManager.handleSkipTurn(socket, data.roomId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('kick-player', (data: { roomId: string; targetId: string }, callback) => {
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'kick-player', 3, 10000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
    try {
      gameManager.handleKickPlayer(socket, data.roomId, data.targetId)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('update-settings', (data: { roomId: string; settings: { theme?: string; rounds?: number; drawTime?: number; maxPlayers?: number } }, callback) => {
    if (typeof callback !== 'function') return
    if (!rateLimit(socket.id, 'update-settings', 5, 5000)) {
      return callback({ success: false, error: 'Too many requests' })
    }
    if (!isValidRoomId(data.roomId)) return callback({ success: false, error: 'Invalid room' })
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

// Periodic cleanup: remove stale rate limit entries every 60s
setInterval(() => {
  const now = Date.now()
  for (const [socketId, events] of rateLimits.entries()) {
    for (const [eventName, timestamps] of events.entries()) {
      const fresh = timestamps.filter(t => now - t < 60000)
      if (fresh.length === 0) events.delete(eventName)
      else events.set(eventName, fresh)
    }
    if (events.size === 0) rateLimits.delete(socketId)
  }
}, 60000)

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export { io, roomManager, gameManager }
