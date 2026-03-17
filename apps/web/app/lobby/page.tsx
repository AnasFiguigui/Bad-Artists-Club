'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initSocket, getSocket } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room, GameConfig } from '@/lib/types'
import { Grainient } from '@/components/Grainient'

const DEFAULT_CONFIG: GameConfig = {
  theme: 'lol',
  rounds: 5,
  drawTime: 90,
  maxPlayers: 20,
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
        if (!response.success) {
          alert(response.error || 'Failed to start game')
        }
      })
    } else {
      console.error('No roomId available')
    }
  }

  const handleEnterFreeDraw = () => {
    const socket = getSocket()
    const roomId = gameStore.getState().roomId
    if (roomId) {
      socket.emit('enter-free-draw', { roomId }, (response: any) => {
        if (!response.success) {
          alert(response.error || 'Failed to enter game')
        }
      })
    }
  }

  const handleUpdateConfig = (partial: Partial<GameConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
    const socket = getSocket()
    const roomId = gameStore.getState().roomId
    if (roomId) {
      socket.emit('update-settings', { roomId, settings: partial }, () => {})
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading lobby...</div>
      </div>
    )
  }

  const isHost = room.host === gameStore.getState().currentPlayer?.id
  const allReady = room.players.every((p) => p.ready)

  return (
    <main className="min-h-screen relative p-8">
      <Grainient
        color1="#FF9FFC"
        color2="#5227FF"
        color3="#B19EEF"
        className="fixed inset-0 -z-10"
      />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Room: {room.id}</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Config */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Game Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-100 mb-2 text-sm font-medium">Theme</label>
                <select
                  value={config.theme}
                  onChange={(e) => handleUpdateConfig({ theme: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 backdrop-blur-sm focus:outline-none focus:border-white/40 transition-colors appearance-none cursor-pointer"
                >
                  <option value="lol" className="bg-gray-400/90">League of Legends</option>
                  <option value="elden-ring" className="bg-gray-400/90">Elden Ring</option>
                  <option value="dbd" className="bg-gray-400/90">Dead by Daylight</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-100 mb-2 text-sm font-medium">Rounds: {config.rounds}</label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={config.rounds}
                  onChange={(e) => handleUpdateConfig({ rounds: parseInt(e.target.value) as any })}
                  className="w-full slider-modern"
                />
              </div>

              <div>
                <label className="block text-gray-100 mb-2 text-sm font-medium">Draw Time: {config.drawTime}s</label>
                <input
                  type="range"
                  min="60"
                  max="120"
                  step="30"
                  value={config.drawTime}
                  onChange={(e) => handleUpdateConfig({ drawTime: parseInt(e.target.value) as any })}
                  className="w-full slider-modern"
                />
              </div>
            </div>

            <div className="space-y-2 mt-6">
              <div className="p-3 bg-blue-500/50 border border-blue-400/60 rounded-lg text-white text-sm mb-3 backdrop-blur-sm">
                ℹ️ Share the invite link or room ID with friends. Players can join anytime, even after the game starts!
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full bg-blue-500/80 hover:bg-blue-500/60 text-white border border-blue-400/80 px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
              >
                {copied ? '✓ Copied Invite Link' : 'Copy Invite Link'}
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room.id)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="w-full bg-cyan-500/80 hover:bg-cyan-500/60 text-white border border-cyan-400/70 px-4 py-2 rounded-lg text-sm backdrop-blur-sm transition-colors"
              >
                {copied ? '✓ Copied Room ID' : `Copy Room ID: ${room.id}`}
              </button>
            </div>
          </div>

          {/* Right: Players */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Players ({room.players.length})</h2>

            <div className="space-y-2 mb-6">
              {room.players.map((player) => (
                <div key={player.id} className="bg-white/10 p-3 rounded-lg flex items-center justify-between border border-white/10">
                  <div>
                    <span className="text-white font-semibold">{player.username}</span>
                    {player.isHost && <span className="text-yellow-400 ml-2 text-xs">[HOST]</span>}
                  </div>
                  <span className={player.ready ? 'text-emerald-400 font-bold' : 'text-gray-100'}>
                    {player.ready ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReady}
                className="flex-1 bg-emerald-500/80 hover:bg-emerald-500/60 border border-emerald-400/70 text-white px-4 py-2 rounded-lg font-semibold backdrop-blur-sm transition-colors"
              >
                Ready
              </button>

              {isHost && room.players.length < 2 && (
                <button
                  onClick={handleEnterFreeDraw}
                  className="flex-1 bg-amber-500/75 hover:bg-amber-500/60 border border-amber-400/60 text-white px-4 py-2 rounded-lg font-semibold backdrop-blur-sm transition-colors"
                >
                  Free Draw
                </button>
              )}

              {isHost && allReady && room.players.length >= 2 && (
                <button
                  onClick={handleStartGame}
                  className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-100 px-4 py-2 rounded-lg font-semibold backdrop-blur-sm transition-colors"
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
