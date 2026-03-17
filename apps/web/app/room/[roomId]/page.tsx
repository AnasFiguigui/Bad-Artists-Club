'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { initSocket, waitForSocketConnection } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room } from '@/lib/types'
import { Grainient } from '@/components/Grainient'

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
      setRoom((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          host: newHostId,
          players: prev.players.map((p) => ({ ...p, isHost: p.id === newHostId })),
        }
      })
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
            console.log('[Room] join-room callback:', response.success)
            if (joinTimeout) clearTimeout(joinTimeout)

            if (response.success && response.room) {
              gameStore.setState({ roomId, room: response.room })
              const currentPlayer = response.room.players.find((p) => p.id === sock.id)
              if (currentPlayer) gameStore.setState({ currentPlayer })

              // If the game is already in progress or ended, redirect to game page
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
  const themeLabels: Record<string, string> = { lol: 'League of Legends', 'elden-ring': 'Elden Ring', dbd: 'Dead by Daylight' }
  const themeEmojis: Record<string, string> = { lol: '⚔️', 'elden-ring': '🗡️', dbd: '🔪' }

  return (
    <main className="min-h-screen relative p-4 sm:p-8">
      <Grainient
        color1="#FF9FFC"
        color2="#5227FF"
        color3="#B19EEF"
        className="fixed inset-0 -z-10"
      />
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Lobby</h1>
            <p className="text-gray-400 text-sm mt-1">Room: <span className="text-indigo-400 font-mono">{room.id}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                linkCopied ? 'bg-emerald-500/30 border border-emerald-400/30 text-emerald-100' : 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-100'
              } backdrop-blur-sm`}
            >
              {linkCopied ? '✓ Link Copied!' : '🔗 Copy Invite Link'}
            </button>
            <button
              onClick={handleCopyRoomId}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                roomIdCopied ? 'bg-emerald-500/30 border border-emerald-400/30 text-emerald-100' : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
              } backdrop-blur-sm`}
            >
              {roomIdCopied ? '✓ Copied!' : '📋 Room ID'}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Game Settings */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">⚙️ Game Settings</h2>
            {isHost ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">Theme</label>
                  <select
                    value={room.theme}
                    onChange={(e) => handleUpdateSettings({ theme: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-white/40 backdrop-blur-sm transition-colors"
                  >
                    <option value="lol" className="bg-gray-900">⚔️ League of Legends</option>
                    <option value="elden-ring" className="bg-gray-900">🗡️ Elden Ring</option>
                    <option value="dbd" className="bg-gray-900">🔪 Dead by Daylight</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300 block mb-1">Rounds</label>
                  <select
                    value={room.totalRounds}
                    onChange={(e) => handleUpdateSettings({ rounds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-white/40 backdrop-blur-sm transition-colors"
                  >
                    {[3, 5, 8, 10].map((r) => (
                      <option key={r} value={r} className="bg-gray-900">{r} rounds</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300 block mb-1">Draw Time</label>
                  <select
                    value={room.drawTime}
                    onChange={(e) => handleUpdateSettings({ drawTime: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-white/40 backdrop-blur-sm transition-colors"
                  >
                    {[60, 90, 120].map((t) => (
                      <option key={t} value={t} className="bg-gray-900">{t} seconds</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-gray-300">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-400">Theme</span>
                  <span className="text-white font-medium">{themeEmojis[room.theme]} {themeLabels[room.theme]}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-400">Rounds</span>
                  <span className="text-white font-medium">{room.totalRounds}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400">Draw Time</span>
                  <span className="text-white font-medium">{room.drawTime}s</span>
                </div>
                <p className="text-gray-400 text-xs italic pt-2">Only the host can change settings</p>
              </div>
            )}
          </div>

          {/* Right: Players */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">
              👥 Players ({room.players.length})
            </h2>

            <div className="space-y-2 mb-6">
              {room.players.map((player) => (
                <div key={player.id} className="bg-white/10 p-3 rounded-lg flex items-center justify-between border border-white/10">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${player.ready ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <span className="text-white font-semibold text-sm">{player.username}</span>
                    {player.isHost && <span className="text-yellow-400 text-xs font-bold">👑</span>}
                    {player.id === socket?.id && <span className="text-blue-400 text-xs">(you)</span>}
                  </div>
                  <span className={`text-xs font-bold ${player.ready ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {player.ready ? '✓ Ready' : 'Waiting...'}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleReady}
                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-100 px-4 py-2.5 rounded-lg font-semibold backdrop-blur-sm transition-colors"
              >
                Toggle Ready
              </button>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={!allReady || room.players.length < 2}
                  className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-100 px-4 py-2.5 rounded-lg font-bold backdrop-blur-sm transition-colors"
                >
                  Start Game
                </button>
              )}

              {isHost && !allReady && room.players.length >= 2 && (
                <p className="text-gray-400 text-xs text-center">All players must be ready to start</p>
              )}
              {isHost && room.players.length < 2 && (
                <p className="text-gray-400 text-xs text-center">Need at least 2 players to start</p>
              )}
              {!isHost && (
                <p className="text-gray-400 text-xs text-center">Waiting for the host to start the game...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
