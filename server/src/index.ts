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

app.use(cors())
app.use(express.json())

const roomManager = new RoomManager()
const gameManager = new GameManager(io, roomManager)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Socket.IO events
io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.on('join-room', (data: { roomId: string; username: string }, callback) => {
    try {
      const room = gameManager.handleJoinRoom(socket, data.roomId, data.username)
      callback({ success: true, room })
    } catch (error) {
      callback({ success: false, error: (error as Error).message })
    }
  })

  socket.on('create-room', (data, callback) => {
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
    gameManager.handleDraw(socket, data)
  })

  socket.on('chat-message', (data: { roomId: string; message: string }, callback) => {
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
  })
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export { io, roomManager, gameManager }
