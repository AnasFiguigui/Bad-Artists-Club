'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initSocket, getSocket } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room, GameConfig } from '@/lib/types'

const DEFAULT_CONFIG: GameConfig = {
  theme: 'lol',
  rounds: 5,
  drawTime: 90,
  maxPlayers: 8,
}

export default function LobbyPage() {
  const router = useRouter()
  const { username } = gameStore()
  const [room, setRoom] = useState<Room | null>(null)
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG)
  const [copied, setCopied] = useState(false)
  const hasCreated = useRef(false)

  useEffect(() => {
    if (!username) {
      router.push('/')
      return
    }

    const socket = initSocket()

    // Listen for room created event
    socket.on('room-created', (createdRoom: Room) => {
      console.log('room-created event received:', createdRoom, 'socket.id:', socket.id)
      setRoom(createdRoom)
      gameStore.setState({ roomId: createdRoom.id })
      // Find current player in room and set it
      const currentPlayer = createdRoom.players.find((p) => p.id === socket.id)
      console.log('Current player found:', currentPlayer)
      if (currentPlayer) {
        gameStore.setState({ currentPlayer })
      }
    })

    socket.on('player-joined', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      // Update current player
      const currentPlayer = updatedRoom.players.find((p) => p.id === socket.id)
      if (currentPlayer) {
        gameStore.setState({ currentPlayer })
      }
    })

    socket.on('player-ready', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      // Update current player
      const currentPlayer = updatedRoom.players.find((p) => p.id === socket.id)
      if (currentPlayer) {
        gameStore.setState({ currentPlayer })
      }
    })

    socket.on('player-left', (updatedRoom: Room) => {
      setRoom(updatedRoom)
    })

    socket.on('game-started', (startedRoom: Room) => {
      console.log('game-started event received')
      setRoom(startedRoom)
      router.push('/game')
    })

    // Create room (only once — prevents React Strict Mode double-emit)
    if (!hasCreated.current) {
      hasCreated.current = true
      socket.emit('create-room', { config, username }, (response: { success: boolean; roomId: string }) => {
        if (!response.success) {
          alert('Failed to create room')
          router.push('/')
        }
      })
    }

    return () => {
      socket.off('room-created')
      socket.off('player-joined')
      socket.off('player-ready')
      socket.off('player-left')
      socket.off('game-started')
    }
  }, [username, router])

  const handleReady = () => {
    const socket = getSocket()
    const roomId = gameStore.getState().roomId
    console.log('Ready clicked - roomId:', roomId, 'socket.id:', socket.id)
    if (roomId) {
      socket.emit('ready', { roomId }, (response: any) => {
        console.log('Ready response:', response)
      })
    } else {
      console.error('No roomId available')
    }
  }

  const handleStartGame = () => {
    const socket = getSocket()
    const roomId = gameStore.getState().roomId
    console.log('Start Game clicked - roomId:', roomId, 'socket.id:', socket.id)
    if (roomId) {
      socket.emit('start-game', { roomId }, (response: any) => {
        console.log('Start Game response:', response)
      })
    } else {
      console.error('No roomId available')
    }
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/?roomId=${room?.id}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading lobby...</div>
      </div>
    )
  }

  const isHost = room.host === gameStore.getState().currentPlayer?.id
  const allReady = room.players.every((p) => p.ready)

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 to-black p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Room: {room.id}</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Config */}
          <div className="bg-gray-900 rounded-lg p-6 border border-purple-500">
            <h2 className="text-2xl font-bold text-white mb-4">Game Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Theme</label>
                <select
                  value={config.theme}
                  onChange={(e) => setConfig({ ...config, theme: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700"
                >
                  <option value="lol">League of Legends</option>
                  <option value="elden-ring">Elden Ring</option>
                  <option value="dbd">Dead by Daylight</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Rounds: {config.rounds}</label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={config.rounds}
                  onChange={(e) => setConfig({ ...config, rounds: parseInt(e.target.value) as any })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Draw Time: {config.drawTime}s</label>
                <input
                  type="range"
                  min="60"
                  max="120"
                  step="30"
                  value={config.drawTime}
                  onChange={(e) => setConfig({ ...config, drawTime: parseInt(e.target.value) as any })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Max Players: {config.maxPlayers}</label>
                <input
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  value={config.maxPlayers}
                  onChange={(e) => setConfig({ ...config, maxPlayers: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2 mt-6">
              <div className="p-3 bg-blue-900 border border-blue-500 rounded text-blue-100 text-sm mb-3">
                ℹ️ Share the invite link or room ID with friends. Players can join anytime, even after the game starts!
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                {copied ? '✓ Copied Invite Link' : 'Copy Invite Link'}
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room.id)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded text-sm"
              >
                {copied ? '✓ Copied Room ID' : `Copy Room ID: ${room.id}`}
              </button>
            </div>
          </div>

          {/* Right: Players */}
          <div className="bg-gray-900 rounded-lg p-6 border border-purple-500">
            <h2 className="text-2xl font-bold text-white mb-4">Players ({room.players.length}/8)</h2>

            <div className="space-y-2 mb-6">
              {room.players.map((player) => (
                <div key={player.id} className="bg-gray-800 p-3 rounded flex items-center justify-between">
                  <div>
                    <span className="text-white font-semibold">{player.username}</span>
                    {player.isHost && <span className="text-yellow-400 ml-2 text-xs">[HOST]</span>}
                  </div>
                  <span className={player.ready ? 'text-green-400 font-bold' : 'text-gray-500'}>
                    {player.ready ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReady}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
              >
                Ready
              </button>

              {isHost && allReady && (
                <button
                  onClick={handleStartGame}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-semibold"
                >
                  Start Game
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
