'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initSocket, getSocket } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room, GameConfig } from '@/lib/types'
import { Grainient } from '@/components/Grainient'
import { BackgroundDoodles } from '@/components/BackgroundDoodles'
import { THEME_CONFIGS } from '@/lib/themeConfig'

const DEFAULT_CONFIG: GameConfig = {
  theme: 'lol',
  rounds: 5,
  drawTime: 90,
  maxPlayers: 20,
  hintsEnabled: true,
}

const THEMES = [
  { key: 'lol', label: 'League of Legends', emoji: '⚔️' },
  { key: 'elden-ring', label: 'Elden Ring', emoji: '🗡️' },
  { key: 'dbd', label: 'Dead by Daylight', emoji: '🔪' },
  { key: 'game-titles', label: 'Game Titles', emoji: '🎮' },
  { key: 'anime', label: 'Anime', emoji: '🌸' },
  { key: 'crossverse', label: 'Crossverse', emoji: '🌀' },
  { key: 'custom', label: 'Custom', emoji: '✏️' },
] as const

const ROUND_OPTIONS = [3, 5, 8, 10] as const
const DRAW_TIME_OPTIONS = [60, 90, 120, 150, 180, 240] as const

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
    const link = `${globalThis.location.origin}/?roomId=${room?.id}`
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
  const themeConfig = THEME_CONFIGS[config.theme] || THEME_CONFIGS['lol']

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <Grainient
        color1="#2A2A35"
        color2="#3D3548"
        color3="#35353F"
        color4="#2F3040"
        color5="#40384A"
        className="fixed inset-0 -z-10"
      />
      <BackgroundDoodles />
      
      <div className="w-full max-w-6xl relative z-10">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-caveat font-bold text-white leading-tight mb-1">Hosting Party</h1>
          <p className="text-white/60 text-sm">
            Room <span className="font-mono text-purple-300/90 font-bold">{room.id}</span>
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* LEFT COLUMN: Settings */}
          <div>
            {/* Settings Card */}
            <div className="card-hand-drawn p-5 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-caveat font-bold text-white mb-5">⚙️ Settings</h2>

              {/* Theme buttons */}
              <div className="mb-5">
                <label className="block text-white/70 text-xs font-medium uppercase tracking-wider mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => handleUpdateConfig({ theme: t.key as GameConfig['theme'] })}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
                        config.theme === t.key
                          ? 'bg-white/20 border-white/40 text-white shadow-lg scale-[1.02]'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white/80'
                      }`}
                    >
                      <span className="text-base block mb-0.5">{t.emoji}</span>
                      <span className="leading-tight block">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rounds buttons */}
              <div className="mb-5">
                <label className="block text-white/70 text-xs font-medium uppercase tracking-wider mb-2">Rounds</label>
                <div className="flex gap-2">
                  {ROUND_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => handleUpdateConfig({ rounds: r as GameConfig['rounds'] })}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 border ${
                        config.rounds === r
                          ? 'bg-white/20 border-white/40 text-white shadow-lg'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Draw Time buttons */}
              <div className="mb-5">
                <label className="block text-white/70 text-xs font-medium uppercase tracking-wider mb-2">Draw Time</label>
                <div className="grid grid-cols-3 gap-2">
                  {DRAW_TIME_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => handleUpdateConfig({ drawTime: t as GameConfig['drawTime'] })}
                      className={`py-2 rounded-lg text-sm font-bold transition-all duration-200 border ${
                        config.drawTime === t
                          ? 'bg-white/20 border-white/40 text-white shadow-lg'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Hints toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={config.hintsEnabled}
                      onChange={(e) => handleUpdateConfig({ hintsEnabled: e.target.checked } as Partial<GameConfig>)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 border border-white/20 rounded-full peer-checked:bg-purple-500/50 peer-checked:border-purple-400/50 transition-all" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white/60 rounded-full transition-all peer-checked:translate-x-4 peer-checked:bg-white" />
                  </div>
                  <span className="text-white/70 text-xs font-medium uppercase tracking-wider group-hover:text-white/90 transition-colors">Hints</span>
                </label>
                <p className="text-white/40 text-[10px] mt-1 ml-12">Reveal letters gradually during each round</p>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Players + Invite */}
          <div className="space-y-5">
          <div className="card-hand-drawn p-5 sm:p-6 flex flex-col">
            <h2 className="text-xl sm:text-2xl font-caveat font-bold text-white mb-4">👥 Players ({room.players.length})</h2>

            {/* Player list: max 5 visible, scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide mb-5" style={{ maxHeight: '320px' }}>
              <div className="space-y-2.5">
                {room.players.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/8 hover:bg-white/12 border border-white/15 p-3.5 rounded-lg flex items-center justify-between transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white/80">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-white font-semibold text-sm block">{player.username}</span>
                        {player.isHost && <span className="text-[10px] text-yellow-400/80 font-bold">👑 Host</span>}
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                      player.ready
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}>
                      {player.ready ? '✓ Ready' : 'Waiting'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5 mt-auto">
              <button
                onClick={handleReady}
                className="w-full bg-gradient-to-r from-emerald-500/50 to-emerald-600/50 hover:from-emerald-500/60 hover:to-emerald-600/40 border border-emerald-400/50 text-emerald-100 hover:text-emerald-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all text-sm"
              >
                ✓ Ready to Play
              </button>

              {isHost && room.players.length < 2 && (
                <button
                  onClick={handleEnterFreeDraw}
                  className="w-full bg-gradient-to-r from-amber-500/50 to-amber-600/50 hover:from-amber-500/60 hover:to-amber-600/60 border border-amber-400/50 text-amber-100 hover:text-amber-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all text-sm"
                >
                  Free Draw Mode
                </button>
              )}

              {isHost && allReady && room.players.length >= 2 && (
                <button
                  onClick={handleStartGame}
                  className="w-full bg-gradient-to-r from-indigo-500/30 to-indigo-600/30 hover:from-indigo-500/40 hover:to-indigo-600/40 border border-indigo-400/50 text-indigo-100 hover:text-indigo-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all text-sm"
                >
                  Launch Game
                </button>
              )}

              {isHost && (!allReady || room.players.length < 2) && (
                <p className="text-white/50 text-xs text-center font-medium italic">
                  {room.players.length < 2 ? 'Waiting for 2+ players' : 'All players must be ready'}
                </p>
              )}
            </div>
          </div>

          {/* Invite Card */}
          <div className="card-hand-drawn p-5 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-caveat font-bold text-white mb-4">🔗 Invite Friends</h2>

            <div className="p-3 bg-purple-500/15 border border-purple-400/20 rounded-lg text-white/80 text-xs backdrop-blur-sm mb-4">
              <p className="font-medium text-white/90 mb-0.5">💡 How to join:</p>
              <p>Share your room ID or invite link. Friends can join anytime!</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCopyLink}
                className="w-full bg-gradient-to-r from-blue-500/50 to-blue-600/40 hover:from-blue-500/60 hover:to-blue-600/50 border border-blue-400/40 text-blue-100 hover:text-blue-50 px-4 py-2.5 rounded-lg font-bold backdrop-blur-sm transition-all text-sm"
              >
                {copied ? '✓ Copied!' : '📋 Copy Invite Link'}
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room.id)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="w-full bg-gradient-to-r from-cyan-500/25 to-cyan-600/25 hover:from-cyan-500/35 hover:to-cyan-600/45 border border-cyan-400/40 text-cyan-100 hover:text-cyan-50 px-4 py-2.5 rounded-lg font-bold backdrop-blur-sm transition-all text-sm"
              >
                {copied ? '✓ Copied!' : `🎮 Copy Room ID`}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </main>
  )
}
