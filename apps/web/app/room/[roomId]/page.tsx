'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { initSocket, waitForSocketConnection } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room } from '@/lib/types'

export default function RoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const { username } = gameStore()
  const hasJoined = useRef(false)

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState<any>(null)
  const [roomIdCopied, setRoomIdCopied] = useState(false)

  useEffect(() => {
    if (!username) {
      router.push('/')
      return
    }

    const sock = initSocket()
    setSocket(sock)
    console.log(`[Room] Mounting room page for ${roomId} as ${username}`)

    let joinTimeout: NodeJS.Timeout | undefined

    // ALWAYS set up event listeners (must survive React strict mode remount)
    sock.on('player-joined', (updatedRoom: Room) => {
      console.log('[Room] player-joined:', updatedRoom.players.length, 'players')
      setRoom(updatedRoom)
    })

    sock.on('player-ready', (updatedRoom: Room) => {
      console.log('[Room] player-ready received')
      setRoom(updatedRoom)
    })

    sock.on('player-left', (updatedRoom: Room) => {
      setRoom(updatedRoom)
    })

    sock.on('game-started', (updatedRoom: Room) => {
      console.log('[Room] game-started, navigating to game page')
      gameStore.setState({ roomId, room: updatedRoom })
      router.push('/game')
    })

    // Only emit join ONCE (prevents duplicate in React strict mode)
    if (!hasJoined.current) {
      hasJoined.current = true

      const emitJoin = async () => {
        try {
          await waitForSocketConnection(sock, 5000)
          console.log('[Room] Socket ready, emitting join-room')

          sock.emit('join-room', { roomId, username }, (response: { success: boolean; room?: Room; error?: string }) => {
            console.log('[Room] join-room callback:', response.success)
            if (joinTimeout) clearTimeout(joinTimeout)

            if (response.success && response.room) {
              gameStore.setState({ roomId, room: response.room })
              const currentPlayer = response.room.players.find((p) => p.id === sock.id)
              if (currentPlayer) gameStore.setState({ currentPlayer })

              // If the game is already in progress, redirect to game page
              if (response.room.state === 'playing') {
                console.log('[Room] Game already in progress, redirecting to /game')
                router.push('/game')
                return
              }

              setRoom(response.room)
              setLoading(false)
            } else {
              alert(response.error || 'Failed to join room')
              router.push('/')
            }
          })
        } catch (error) {
          console.error('[Room] Socket connection failed:', error)
          if (joinTimeout) clearTimeout(joinTimeout)
          alert('Failed to connect to server')
          router.push('/')
        }
      }

      emitJoin()

      joinTimeout = setTimeout(() => {
        console.warn('[Room] Timeout waiting for join response')
        alert('Failed to join room - server connection timeout')
        router.push('/')
      }, 8000)
    }

    return () => {
      if (joinTimeout) clearTimeout(joinTimeout)
      sock.off('player-joined')
      sock.off('player-ready')
      sock.off('player-left')
      sock.off('game-started')
    }
  }, [username, roomId, router])

  const handleReady = () => {
    if (!socket) return
    socket.emit('ready', { roomId }, (response: any) => {
      console.log('[Room] Ready response:', response)
    })
  }

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setRoomIdCopied(true)
    setTimeout(() => setRoomIdCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-black flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Joining room...</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-black flex items-center justify-center">
        <div className="text-white text-2xl">Room not found</div>
      </div>
    )
  }

  const isHost = room.host === socket?.id
  const allReady = room.players.every((p) => p.ready)

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 to-black p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Room: {room.id}</h1>
          <button
            onClick={handleCopyRoomId}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              roomIdCopied ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {roomIdCopied ? '✓ Copied!' : 'Copy Room ID'}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Config */}
          <div className="bg-gray-900 rounded-lg p-6 border border-purple-500">
            <h2 className="text-2xl font-bold text-white mb-4">Game Settings</h2>
            <div className="space-y-3 text-gray-300">
              <p>
                <span className="font-semibold">Theme:</span>{' '}
                {room.theme === 'lol'
                  ? 'League of Legends'
                  : room.theme === 'elden-ring'
                  ? 'Elden Ring'
                  : 'Dead by Daylight'}
              </p>
              <p><span className="font-semibold">Rounds:</span> {room.totalRounds}</p>
              <p><span className="font-semibold">Draw Time:</span> {room.drawTime}s</p>
              <p><span className="font-semibold">Max Players:</span> {room.maxPlayers}</p>
            </div>
          </div>

          {/* Right: Players */}
          <div className="bg-gray-900 rounded-lg p-6 border border-purple-500">
            <h2 className="text-2xl font-bold text-white mb-4">
              Players ({room.players.length}/{room.maxPlayers})
            </h2>

            <div className="space-y-2 mb-6">
              {room.players.map((player) => (
                <div key={player.id} className="bg-gray-800 p-3 rounded flex items-center justify-between">
                  <div>
                    <span className="text-white font-semibold">{player.username}</span>
                    {player.isHost && <span className="text-yellow-400 ml-2 text-xs">[HOST]</span>}
                    {player.id === socket?.id && <span className="text-blue-400 ml-2 text-xs">(you)</span>}
                  </div>
                  <span className={player.ready ? 'text-green-400 font-bold' : 'text-gray-500'}>
                    {player.ready ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleReady}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
            >
              Ready
            </button>

            {isHost && allReady && (
              <p className="text-gray-400 text-sm mt-3 text-center">
                Waiting for the host to start the game...
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
