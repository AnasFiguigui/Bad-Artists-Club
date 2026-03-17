import { Socket, io } from 'socket.io-client'

let socket: Socket | null = null

export const initSocket = (url?: string): Socket => {
  if (!socket) {
    const socketUrl = url || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })
    
    socket.on('connect', () => {
      console.log('[Socket] Connected to server, socket.id:', socket?.id)
    })
    
    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from server:', reason)
    })
    
    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error)
    })
  }
  return socket
}

export const waitForSocketConnection = (sock: Socket, timeout = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (sock.connected) {
      resolve()
      return
    }
    
    const timer = setTimeout(() => {
      sock.off('connect', onConnect)
      reject(new Error('Socket connection timeout'))
    }, timeout)
    
    const onConnect = () => {
      clearTimeout(timer)
      sock.off('connect', onConnect)
      resolve()
    }
    
    sock.on('connect', onConnect)
  })
}

export const getSocket = (): Socket => {
  if (!socket) {
    throw new Error('Socket not initialized')
  }
  return socket
}

export const closeSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
