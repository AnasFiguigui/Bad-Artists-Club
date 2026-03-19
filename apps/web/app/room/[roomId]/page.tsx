'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { initSocket, waitForSocketConnection } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room } from '@/lib/types'
import { Grainient } from '@/components/Grainient'
import { BackgroundDoodles } from '@/components/BackgroundDoodles'

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
  const themeLabels: Record<string, string> = { lol: 'League of Legends', 'elden-ring': 'Elden Ring', dbd: 'Dead by Daylight', 'game-titles': 'Game Titles' }
  const themeEmojis: Record<string, string> = { lol: '⚔️', 'elden-ring': '🗡️', dbd: '🔪', 'game-titles': '🎮' }

  return (
    <main className="min-h-screen relative p-4 sm:p-8 overflow-hidden">
      <Grainient
        color1="#FF9FFC"
        color2="#5227FF"
        color3="#B19EEF"
        className="fixed inset-0 -z-10"
      />
      <BackgroundDoodles />
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header with personality */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-caveat font-bold text-white leading-tight">Game Lobby</h1>
            <p className="text-white/60 text-sm mt-2">
              Room: <span className="font-mono text-purple-600 text-base font-bold">{room.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:shadow-md backdrop-blur-sm ${
                linkCopied ? 'bg-emerald-500/50 border border-emerald-400/50 text-white' : 'bg-indigo-500/40 hover:bg-indigo-500/50 border border-indigo-400/30 text-white'
              }`}
            >
              {linkCopied ? '✓ Copied!' : '🔗 Invite'}
            </button>
            <button
              onClick={handleCopyRoomId}
              className={`px-3 py-2 rounded-lg font-semibold transition-all hover:shadow-md backdrop-blur-sm text-xs sm:text-sm ${
                roomIdCopied ? 'bg-emerald-500/40 border border-emerald-400/40 text-emerald-100' : 'bg-white/20 hover:bg-white/30 border border-white/40 text-white'
              }`}
            >
              {roomIdCopied ? '✓' : '📋'}
            </button>
          </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Game Settings */}
          <div className="card-hand-drawn card-hover rotate-subtle p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-caveat font-bold text-white mb-6 flex items-center gap-2">
              ⚙️ Game Settings
            </h2>
            {isHost ? (
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
                      { value: 'custom', label: '✏️ Custom' },
                    ].map((t) => (
                      <button
                        key={t.value}
                        onClick={() => handleUpdateSettings({ theme: t.value })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          room.theme === t.value
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
                        onClick={() => handleUpdateSettings({ rounds: r })}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          room.totalRounds === r
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
                  <div className="flex gap-2">
                    {[60, 90, 120].map((t) => (
                      <button
                        key={t}
                        onClick={() => handleUpdateSettings({ drawTime: t })}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          room.drawTime === t
                            ? 'bg-purple-500/40 border-purple-400/60 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white'
                        } border`}
                      >
                        {t}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-white/70">
                <div className="flex justify-between items-center py-3 px-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/80 font-medium">Theme</span>
                  <span className="text-white font-semibold">{themeEmojis[room.theme]} {themeLabels[room.theme]}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/80 font-medium">Rounds</span>
                  <span className="text-white font-semibold">{room.totalRounds}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/80 font-medium">Draw Time</span>
                  <span className="text-white font-semibold">{room.drawTime}s</span>
                </div>
                <p className="text-white text-xs italic pt-2 float-hint">Only the host can change settings</p>
              </div>
            )}
          </div>

          {/* Right: Players */}
          <div className="card-hand-drawn card-hover rotate-subtle p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-caveat font-bold text-white mb-6 flex items-center gap-2">
              👥 Players ({room.players.length})
            </h2>

            <div className="space-y-3 mb-6">
              {room.players.map((player) => (
                <div
                  key={player.id}
                  className="bg-white/10 hover:bg-white/15 border border-white/20 p-4 rounded-lg flex items-center justify-between transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all ${player.ready ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-gray-500'}`} />
                    <span className="text-white font-semibold text-sm group-hover:text-white/95">{player.username}</span>
                    {player.isHost && <span className="text-lg">👑</span>}
                    {player.id === socket?.id && <span className="text-xs text-blue-300 font-medium">(you)</span>}
                  </div>
                  <span className={`text-xs font-bold transition-colors ${player.ready ? 'text-emerald-300' : 'text-gray-500'}`}>
                    {player.ready ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleReady}
                className="w-full bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 hover:from-emerald-500/40 hover:to-emerald-600/40 border border-emerald-400/50 text-emerald-100 hover:text-emerald-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
              >
                {room.players.find((p) => p.id === socket?.id)?.ready ? 'Change Mind' : '✓ Ready to Play'}
              </button>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={!allReady || room.players.length < 2}
                  className="w-full bg-gradient-to-r from-indigo-500/30 to-indigo-600/30 hover:from-indigo-500/40 hover:to-indigo-600/40 border border-indigo-400/50 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-100 hover:text-indigo-50 px-4 py-3 rounded-lg font-bold backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-indigo-500/25"
                >
                  Launch Game
                </button>
              )}

              {isHost && !allReady && room.players.length >= 2 && (
                <p className="text-white text-xs text-center font-medium italic float-hint">All players must be ready</p>
              )}
              {isHost && room.players.length < 2 && (
                <p className="text-white text-xs text-center font-medium italic float-hint">Need 2+ players to start</p>
              )}
              {!isHost && (
                <p className="text-white text-xs text-center font-medium italic float-hint">Waiting for host...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
