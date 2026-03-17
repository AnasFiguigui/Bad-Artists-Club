'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initSocket, getSocket } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room, GameConfig } from '@/lib/types'
import { Grainient } from '@/components/Grainient'
import { HandDrawnBorder } from '@/components/HandDrawnBorder'
import { BackgroundDoodles } from '@/components/BackgroundDoodles'

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
    <main className="min-h-screen relative p-4 sm:p-8 overflow-hidden">
      <Grainient
        color1="#FF9FFC"
        color2="#5227FF"
        color3="#B19EEF"
        className="fixed inset-0 -z-10"
      />
      <BackgroundDoodles />
      
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-caveat font-bold text-white leading-tight mb-2">Hosting Party</h1>
          <p className="text-white/75 text-lg">
            Room ID: <span className="font-mono text-purple-900/90 font-bold">{room.id}</span>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="card-hand-drawn card-hover rotate-subtle p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-caveat font-bold text-white mb-6">⚙️ Settings</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-white font-medium text-lg mb-2 font-caveat">Theme</label>
                <select
                  value={config.theme}
                  onChange={(e) => handleUpdateConfig({ theme: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white/10 text-white rounded-lg border border-white/20 backdrop-blur-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-purple-300/20 transition-colors appearance-none cursor-pointer hover:border-white/30"
                >
                  <option value="lol" className="bg-gray-900">⚔️ League of Legends</option>
                  <option value="elden-ring" className="bg-gray-900">🗡️ Elden Ring</option>
                  <option value="dbd" className="bg-gray-900">🔪 Dead by Daylight</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-medium text-lg mb-2 font-caveat flex justify-between items-center">
                  <span>Rounds</span>
                  <span className="text-white font-bold">{config.rounds}</span>
                </label>
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
                <label className="block text-white font-medium text-lg mb-2 font-caveat flex justify-between items-center">
                  <span>Draw Time</span>
                  <span className="text-white font-bold">{config.drawTime}s</span>
                </label>
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
          </div>

          {/* Middle: Invite & Share */}
          <div className="card-hand-drawn card-hover rotate-subtle p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-caveat font-bold text-white mb-6">🔗 Invite Friends</h2>

            <div className="space-y-5">
              <div className="p-4 bg-purple-500/20 border border-purple-400/30 rounded-lg text-white/90 text-sm backdrop-blur-sm">
                <p className="font-medium text-white mb-1">💡 How to join:</p>
                <p className="text-white/90">Share your room ID or invite link. Friends can join anytime!</p>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full bg-gradient-to-r from-blue-500/60 to-blue-600/50 hover:from-blue-500/60 hover:to-blue-600/50 border border-blue-400/50 text-blue-100 hover:text-blue-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
              >
                {copied ? '✓ Link Copied!' : '📋 Copy Invite Link'}
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room.id)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="w-full bg-gradient-to-r from-cyan-500/30 to-cyan-600/30 hover:from-cyan-500/40 hover:to-cyan-600/60 border border-cyan-400/50 text-cyan-100 hover:text-cyan-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-cyan-500/25"
              >
                {copied ? '✓ Room ID Copied!' : `🎮 Copy Room ID`}
              </button>

              <div className="mt-4 p-3 bg-white/10 border border-white/20 rounded-lg text-white text-xs font-mono text-center break-all">
                {room.id}
              </div>
            </div>
          </div>

          {/* Right: Players */}
          <div className="card-hand-drawn card-hover rotate-subtle p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-caveat font-bold text-white mb-6">👥 Players ({room.players.length})</h2>

            <div className="space-y-3 mb-6">
              {room.players.map((player) => (
                <div
                  key={player.id}
                  className="bg-white/10 hover:bg-white/15 border border-white/20 p-4 rounded-lg flex items-center justify-between transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold group-hover:text-white/95">{player.username}</span>
                    {player.isHost && <span className="text-lg">👑</span>}
                  </div>
                  <span className={`text-xs font-bold transition-colors ${player.ready ? 'text-green-400' : 'text-gray-100'}`}>
                    {player.ready ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleReady}
                className="w-full bg-gradient-to-r from-emerald-500/50 to-emerald-600/50 hover:from-emerald-500/60 hover:to-emerald-600/40 border border-emerald-400/50 text-emerald-100 hover:text-emerald-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
              >
                ✓ Ready to Play
              </button>

              {isHost && room.players.length < 2 && (
                <button
                  onClick={handleEnterFreeDraw}
                  className="w-full bg-gradient-to-r from-amber-500/50 to-amber-600/50 hover:from-amber-500/60 hover:to-amber-600/60 border border-amber-400/50 text-amber-100 hover:text-amber-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-amber-500/25"
                >
                  Free Draw Mode
                </button>
              )}

              {isHost && allReady && room.players.length >= 2 && (
                <button
                  onClick={handleStartGame}
                  className="w-full bg-gradient-to-r from-indigo-500/30 to-indigo-600/30 hover:from-indigo-500/40 hover:to-indigo-600/40 border border-indigo-400/50 text-indigo-100 hover:text-indigo-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-indigo-500/25"
                >
                  Launch Game
                </button>
              )}

              {isHost && (!allReady || room.players.length < 2) && (
                <p className="text-white text-xs text-center font-medium italic">
                  {room.players.length < 2 ? 'Waiting for 2+ players' : 'All players must be ready'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
