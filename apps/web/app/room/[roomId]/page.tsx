'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { initSocket, waitForSocketConnection } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room } from '@/lib/types'
import { Grainient } from '@/components/Grainient'
import { BackgroundDoodles } from '@/components/BackgroundDoodles'

function SettingsForm({ room, onApply }: Readonly<{ room: Room; onApply: (settings: { theme?: string; rounds?: number; drawTime?: number; hintsEnabled?: boolean }) => void }>) {
  const [pendingTheme, setPendingTheme] = useState(room.theme)
  const [pendingRounds, setPendingRounds] = useState(room.totalRounds)
  const [pendingDrawTime, setPendingDrawTime] = useState(room.drawTime)
  const [pendingHints, setPendingHints] = useState(room.hintsEnabled ?? true)

  // Sync with server updates
  useEffect(() => {
    setPendingTheme(room.theme)
    setPendingRounds(room.totalRounds)
    setPendingDrawTime(room.drawTime)
    setPendingHints(room.hintsEnabled ?? true)
  }, [room.theme, room.totalRounds, room.drawTime, room.hintsEnabled])

  const hasChanges = pendingTheme !== room.theme || pendingRounds !== room.totalRounds || pendingDrawTime !== room.drawTime || pendingHints !== (room.hintsEnabled ?? true)

  const handleApply = () => {
    const settings: { theme?: string; rounds?: number; drawTime?: number; hintsEnabled?: boolean } = {}
    if (pendingTheme !== room.theme) settings.theme = pendingTheme
    if (pendingRounds !== room.totalRounds) settings.rounds = pendingRounds
    if (pendingDrawTime !== room.drawTime) settings.drawTime = pendingDrawTime
    if (pendingHints !== (room.hintsEnabled ?? true)) settings.hintsEnabled = pendingHints
    onApply(settings)
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-white/80 font-medium text-sm mb-2 block font-caveat">Theme</span>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'lol', label: '⚔️ LoL' },
            { value: 'elden-ring', label: '🗡️ Elden Ring' },
            { value: 'dbd', label: '🔪 DbD' },
            { value: 'game-titles', label: '🎮 Games' },
            { value: 'anime', label: '🌸 Anime' },
            { value: 'crossverse', label: '🌀 Crossverse' },
            { value: 'custom', label: '✏️ Custom' },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setPendingTheme(t.value as Room['theme'])}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pendingTheme === t.value
                  ? 'bg-purple-500/40 border-purple-400/60 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white'
              } border`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-white/80 font-medium text-sm mb-2 block font-caveat">Rounds</span>
        <div className="flex gap-2">
          {[3, 5, 8, 10].map((r) => (
            <button
              key={r}
              onClick={() => setPendingRounds(r)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                pendingRounds === r
                  ? 'bg-purple-500/40 border-purple-400/60 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white'
              } border`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-white/80 font-medium text-sm mb-2 block font-caveat">Draw Time</span>
        <div className="flex flex-wrap gap-2">
          {[60, 90, 120, 150, 180, 240].map((t) => (
            <button
              key={t}
              onClick={() => setPendingDrawTime(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                pendingDrawTime === t
                  ? 'bg-purple-500/40 border-purple-400/60 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white'
              } border`}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={pendingHints}
              onChange={(e) => setPendingHints(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-white/10 border border-white/20 rounded-full peer-checked:bg-purple-500/50 peer-checked:border-purple-400/50 transition-all" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white/60 rounded-full transition-all peer-checked:translate-x-4 peer-checked:bg-white" />
          </div>
          <span className="text-white/80 font-medium text-sm font-caveat group-hover:text-white/90 transition-colors">Hints</span>
        </label>
        <p className="text-white/40 text-[10px] mt-1 ml-12">Reveal letters gradually during each round</p>
      </div>
      <button
        onClick={handleApply}
        disabled={!hasChanges}
        className="w-full bg-gradient-to-r from-purple-500/30 to-purple-600/30 hover:from-purple-500/40 hover:to-purple-600/40 border border-purple-400/50 text-purple-100 hover:text-purple-50 px-4 py-2.5 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Apply
      </button>
    </div>
  )
}

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
  const [linkCopied, setLinkCopied] = useState(false)

  const updateRoomHost = useCallback((newHostId: string) => {
    setRoom((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        host: newHostId,
        players: prev.players.map((p) => ({ ...p, isHost: p.id === newHostId })),
      }
    })
  }, [])

  const handleJoinResponse = useCallback((
    sock: ReturnType<typeof initSocket>,
    response: { success: boolean; room?: Room; error?: string },
    joinTimeout: NodeJS.Timeout | undefined,
  ) => {
    console.log('[Room] join-room callback:', response.success)
    if (joinTimeout) clearTimeout(joinTimeout)

    if (response.success && response.room) {
      gameStore.setState({ roomId, room: response.room })
      const currentPlayer = response.room.players.find((p) => p.id === sock.id)
      if (currentPlayer) gameStore.setState({ currentPlayer })

      if (response.room.state === 'playing' || response.room.state === 'results') {
        console.log('[Room] Game in progress or ended, redirecting to /game')
        router.push('/game')
        return
      }

      setRoom(response.room)
      setLoading(false)
    } else {
      alert(response.error || 'Failed to join room')
      router.push('/')
    }
  }, [roomId, router])

  useEffect(() => {
    if (!username) {
      router.push(`/?roomId=${roomId}`)
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

    sock.on('host-changed', ({ newHostId }: { newHostId: string }) => {
      updateRoomHost(newHostId)
    })

    sock.on('settings-updated', (updatedRoom: Room) => {
      setRoom(updatedRoom)
    })

    sock.on('kicked', () => {
      alert('You have been kicked from the room.')
      router.push('/')
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
            handleJoinResponse(sock, response, joinTimeout)
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
      sock.off('host-changed')
      sock.off('settings-updated')
      sock.off('kicked')
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

  const handleCopyLink = () => {
    const link = `${globalThis.location.origin}/room/${roomId}`
    navigator.clipboard.writeText(link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleStartGame = () => {
    if (!socket) return
    socket.emit('start-game', { roomId }, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        alert(response.error || 'Failed to start game')
      }
    })
  }

  const handleUpdateSettings = (settings: { theme?: string; rounds?: number; drawTime?: number; maxPlayers?: number }) => {
    if (socket) {
      socket.emit('update-settings', { roomId, settings }, () => {})
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Joining room...</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Room not found</div>
      </div>
    )
  }

  const isHost = room.host === socket?.id
  const allReady = room.players.every((p) => p.ready)
  const themeLabels: Record<string, string> = { lol: 'League of Legends', 'elden-ring': 'Elden Ring', dbd: 'Dead by Daylight', 'game-titles': 'Game Titles', anime: 'Anime', custom: 'Custom', crossverse: 'Crossverse' }
  const themeEmojis: Record<string, string> = { lol: '⚔️', 'elden-ring': '🗡️', dbd: '🔪', 'game-titles': '🎮', anime: '🌸', custom: '✏️', crossverse: '🌀' }

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
          <h1 className="text-4xl sm:text-5xl font-caveat font-bold text-white leading-tight mb-1">
            {isHost ? 'Hosting Party' : 'Game Lobby'}
          </h1>
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
              {isHost ? (
                <SettingsForm room={room} onApply={handleUpdateSettings} />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2.5 px-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/70 text-sm">Theme</span>
                    <span className="text-white font-semibold text-sm">{themeEmojis[room.theme] || '🎮'} {themeLabels[room.theme] || room.theme}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/70 text-sm">Rounds</span>
                    <span className="text-white font-semibold text-sm">{room.totalRounds}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/70 text-sm">Draw Time</span>
                    <span className="text-white font-semibold text-sm">{room.drawTime}s</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/70 text-sm">Hints</span>
                    <span className={`font-semibold text-sm ${(room.hintsEnabled ?? true) ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {(room.hintsEnabled ?? true) ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs italic pt-1">Only the host can change settings</p>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Players + Invite */}
          <div className="space-y-5">
          <div className="card-hand-drawn p-5 sm:p-6 flex flex-col">
            <h2 className="text-xl sm:text-2xl font-caveat font-bold text-white mb-4">👥 Players ({room.players.length})</h2>

            {/* Player list */}
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
                        <span className="text-white font-semibold text-sm block">
                          {player.username}
                          {player.id === socket?.id && <span className="text-xs text-blue-300 font-medium ml-1.5">(you)</span>}
                        </span>
                        {player.isHost && <span className="text-[10px] text-yellow-400/80 font-bold">👑 Host</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                        player.ready
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-white/5 text-gray-400 border border-white/10'
                      }`}>
                        {player.ready ? '✓ Ready' : 'Waiting'}
                      </span>
                      {isHost && player.id !== socket?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`Kick ${player.username}?`)) {
                              socket?.emit('kick-player', { roomId, targetId: player.id }, () => {})
                            }
                          }}
                          title={`Kick ${player.username}`}
                          className="p-1 rounded text-red-400/60 hover:text-red-300 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
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
                {room.players.find((p) => p.id === socket?.id)?.ready ? 'Change Mind' : '✓ Ready to Play'}
              </button>

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

              {!isHost && (
                <p className="text-white/50 text-xs text-center font-medium italic">Waiting for host to start...</p>
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
                {linkCopied ? '✓ Copied!' : '📋 Copy Invite Link'}
              </button>
              <button
                onClick={handleCopyRoomId}
                className="w-full bg-gradient-to-r from-cyan-500/25 to-cyan-600/25 hover:from-cyan-500/35 hover:to-cyan-600/45 border border-cyan-400/40 text-cyan-100 hover:text-cyan-50 px-4 py-2.5 rounded-lg font-bold backdrop-blur-sm transition-all text-sm"
              >
                {roomIdCopied ? '✓ Copied!' : '🎮 Copy Room ID'}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </main>
  )
}
