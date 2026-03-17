'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initSocket, waitForSocketConnection } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room, ChatMessage as ChatMessageType, DrawStroke } from '@/lib/types'
import { Canvas, CanvasHandle } from '@/components/Canvas'
import { Chat } from '@/components/Chat'
import { GameNavbar } from '@/components/GameNavbar'
import { PlayerLeaderboard } from '@/components/PlayerLeaderboard'
import { BrushControls } from '@/components/BrushControls'

export default function GamePage() {
  const router = useRouter()
  const { username, roomId } = gameStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [isDrawer, setIsDrawer] = useState(false)
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [socket, setSocket] = useState<any>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [roundAnswer, setRoundAnswer] = useState<string | null>(null)
  const [gameEnded, setGameEnded] = useState(false)
  const [finalRoom, setFinalRoom] = useState<Room | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [muted, setMuted] = useState(false)

  const canvasRef = useRef<CanvasHandle>(null)

  useEffect(() => {
    if (!username || !roomId) {
      console.log('[Game] Missing username or roomId, redirecting to home')
      router.push('/')
      return
    }

    const sock = initSocket()
    setSocket(sock)
    console.log(`[Game] Mounted, roomId: ${roomId}, socket.id: ${sock.id}`)

    let roundTimeout: NodeJS.Timeout
    let roomLoaded = false

    // --- Socket event handlers ---

    sock.on('round-start', (updatedRoom: Room) => {
      console.log('[Game] round-start received, drawer:', updatedRoom.drawer)
      setRoom(updatedRoom)
      gameStore.setState({ room: updatedRoom })
      setIsDrawer(updatedRoom.drawer === sock.id)
      setMessages([])
      setRoundAnswer(null)
      // Clear canvas for new round
      canvasRef.current?.clear()
      roomLoaded = true
      clearTimeout(roundTimeout)
    })

    sock.on('round-ended', (data: { answer: string; scores: Record<string, number> }) => {
      console.log('[Game] round-ended, answer was:', data.answer)
      setRoundAnswer(data.answer)
    })

    sock.on('player-joined', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      const newPlayer = updatedRoom.players.at(-1)
      if (newPlayer) {
        setNotification(`${newPlayer.username} joined the game!`)
        setTimeout(() => setNotification(null), 3000)
      }
    })

    sock.on('player-left', (updatedRoom: Room) => {
      setRoom(updatedRoom)
    })

    sock.on('timer-update', ({ timeRemaining: t }: { timeRemaining: number }) => {
      setTimeRemaining(t)
    })

    sock.on('draw', (stroke: DrawStroke) => {
      // Draw remote stroke on our canvas
      canvasRef.current?.drawStroke(stroke)
    })

    sock.on('chat-message', (message: ChatMessageType) => {
      setMessages((prev) => [...prev, message])
    })

    sock.on('guess-correct', (updatedRoom: Room) => {
      setRoom(updatedRoom)
    })

    sock.on('game-ended', (endedRoom: Room) => {
      setFinalRoom(endedRoom)
      setGameEnded(true)
      setRoom(endedRoom)
      gameStore.setState({ room: endedRoom })
    })

    sock.on('turn-cooldown', ({ seconds }: { seconds: number }) => {
      setCooldown(seconds)
      let remaining = seconds
      const interval = setInterval(() => {
        remaining--
        setCooldown(remaining)
        if (remaining <= 0) clearInterval(interval)
      }, 1000)
    })

    sock.on('game-restarted', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      setGameEnded(false)
      setFinalRoom(null)
      setMessages([])
      setRoundAnswer(null)
      setCooldown(0)
      canvasRef.current?.clear()
      gameStore.setState({ room: updatedRoom })
    })

    sock.on('canvas-cleared', () => {
      canvasRef.current?.clear()
    })

    sock.on('reroll', ({ hint }: { hint: string }) => {
      setRoom((prev) => prev ? { ...prev, hint } : prev)
    })

    sock.on('kicked', () => {
      alert('You have been kicked from the room.')
      router.push('/')
    })

    // --- Request current game state (handles race condition) ---
    // The server may have emitted round-start before this page mounted.
    // request-game-state lets us recover the current round data.
    const requestState = async () => {
      try {
        await waitForSocketConnection(sock)
        sock.emit('request-game-state', { roomId }, (response: { success: boolean; room: Room | null }) => {
          if (response.success && response.room && !roomLoaded) {
            console.log('[Game] Got game state from request-game-state')
            setRoom(response.room)
            gameStore.setState({ room: response.room })
            setIsDrawer(response.room.drawer === sock.id)
            roomLoaded = true
            clearTimeout(roundTimeout)
          }
        })
      } catch (err) {
        console.error('[Game] Failed to request game state:', err)
      }
    }
    requestState()

    roundTimeout = setTimeout(() => {
      if (!roomLoaded) {
        console.warn('[Game] Timeout waiting for room data')
        alert('Game failed to load - server connection timeout')
        router.push('/')
      }
    }, 10000)

    return () => {
      clearTimeout(roundTimeout)
      sock.off('round-start')
      sock.off('round-ended')
      sock.off('player-joined')
      sock.off('player-left')
      sock.off('timer-update')
      sock.off('draw')
      sock.off('chat-message')
      sock.off('guess-correct')
      sock.off('game-ended')
      sock.off('turn-cooldown')
      sock.off('game-restarted')
      sock.off('canvas-cleared')
      sock.off('reroll')
      sock.off('kicked')
    }
  }, [username, roomId, router])

  const handleDraw = (stroke: DrawStroke) => {
    if (socket) {
      socket.emit('draw', stroke)
    }
  }

  const handleSendMessage = (message: string) => {
    if (socket) {
      socket.emit('chat-message', { roomId, message }, (response: { success: boolean }) => {
        if (!response.success && isDrawer) {
          setNotification('You are the drawer and cannot chat')
          setTimeout(() => setNotification(null), 2000)
        }
      })
    }
  }

  const handleLeaveGame = () => {
    if (confirm('Leave the game?')) {
      if (socket) socket.emit('leave-room')
      router.push('/')
    }
  }

  const handleRestartGame = () => {
    if (socket && roomId) {
      socket.emit('restart-game', { roomId }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          setNotification(response.error || 'Failed to restart game')
          setTimeout(() => setNotification(null), 3000)
        }
      })
    }
  }

  const handleClearCanvas = () => {
    if (socket && roomId) {
      canvasRef.current?.clear()
      socket.emit('clear-canvas', { roomId })
    }
  }

  const handleReroll = () => {
    if (socket && roomId) {
      socket.emit('reroll', { roomId }, (response: { success: boolean; answer?: string; hint?: string }) => {
        if (response.success && response.answer && response.hint) {
          setRoom((prev) => prev ? { ...prev, answer: response.answer, hint: response.hint } : prev)
          canvasRef.current?.clear()
          socket.emit('clear-canvas', { roomId })
        }
      })
    }
  }

  const handleSkipTurn = () => {
    if (socket && roomId) {
      socket.emit('skip-turn', { roomId }, () => {})
    }
  }

  const handleKickPlayer = (targetId: string) => {
    if (socket && roomId) {
      const target = room?.players.find((p) => p.id === targetId)
      if (target && confirm(`Kick ${target.username}?`)) {
        socket.emit('kick-player', { roomId, targetId }, () => {})
      }
    }
  }

  if (!room) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Loading game...</div>
      </div>
    )
  }

  const isHost = room.host === socket?.id
  const playerCount = room.players.length

  // Game ended overlay
  if (gameEnded && finalRoom) {
    const sortedPlayers = [...finalRoom.players].sort((a, b) => b.score - a.score)
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="max-w-lg w-full mx-4">
          <h1 className="text-4xl font-bold text-white text-center mb-6">Game Over!</h1>
          <div className="bg-gray-900 rounded-xl p-6 border border-purple-500/50 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Final Scores</h2>
            <div className="space-y-2">
              {sortedPlayers.map((player, idx) => {
                const medals: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }
                const medal = medals[idx] || `#${idx + 1}`
                return (
                  <div
                    key={player.id}
                    className={`flex justify-between items-center p-3 rounded-lg ${
                      idx === 0 ? 'bg-yellow-900/50 border border-yellow-500/50' : 'bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-8">{medal}</span>
                      <span className="text-white font-semibold">{player.username}</span>
                    </div>
                    <span className="text-purple-400 font-bold">{player.score} pts</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            {isHost && (
              <button
                onClick={handleRestartGame}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors"
              >
                Play Again
              </button>
            )}
            <button
              onClick={handleLeaveGame}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors"
            >
              Leave
            </button>
          </div>
          {!isHost && (
            <p className="text-gray-400 text-center mt-3 text-sm">Waiting for host to start...</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Navbar */}
      <GameNavbar
        roomId={roomId || ''}
        isDrawer={isDrawer}
        answer={room.answer}
        hint={room.hint}
        timeRemaining={timeRemaining}
        totalTime={room.drawTime}
        round={room.round}
        totalRounds={room.totalRounds}
        turnIndex={room.turnIndex ?? 0}
        playerCount={playerCount}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
      />

      {/* Notification banner */}
      {notification && (
        <div className="px-4 py-2 bg-blue-600 text-white text-sm text-center font-medium">
          {notification}
        </div>
      )}

      {/* Cooldown banner */}
      {cooldown > 0 && (
        <div className="px-4 py-2 bg-indigo-700 text-white text-sm text-center font-bold animate-pulse">
          Next turn in {cooldown}...
        </div>
      )}

      {/* Answer reveal */}
      {roundAnswer && (
        <div className="px-4 py-2 bg-yellow-600 text-white text-sm text-center font-bold">
          The answer was: {roundAnswer}
        </div>
      )}

      {/* Main content: Left sidebar | Canvas center | Right sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar: Players + Round info */}
        <div className="w-56 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900/50">
          {/* Round info */}
          <div className="px-3 py-2 border-b border-gray-700/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Round</span>
              <span className="text-white font-bold">{room.round}/{room.totalRounds}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">Turn</span>
              <span className="text-white font-bold">{(room.turnIndex ?? 0) + 1}/{room.totalRounds * playerCount}</span>
            </div>
            <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  timeRemaining > room.drawTime * 0.5
                    ? 'bg-green-500'
                    : timeRemaining > room.drawTime * 0.25
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${room.drawTime > 0 ? (timeRemaining / room.drawTime) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-center mt-1">
              <span className={`font-semibold ${isDrawer ? 'text-orange-400' : 'text-blue-400'}`}>
                {isDrawer ? '✎ Drawing' : '👀 Guessing'}
              </span>
            </p>
          </div>

          {/* Player leaderboard */}
          <div className="flex-1 min-h-0">
            <PlayerLeaderboard
              players={room.players}
              scores={room.scores}
              currentPlayerId={socket?.id || ''}
              hostId={room.host}
              drawerId={room.drawer}
              onKick={isHost ? handleKickPlayer : undefined}
            />
          </div>
        </div>

        {/* Center: Canvas + Brush Controls */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center p-3 min-h-0">
            <div className="w-full max-h-full" style={{ aspectRatio: '16/9' }}>
              {roomId && (
                <Canvas
                  ref={canvasRef}
                  isDrawer={isDrawer}
                  onDraw={handleDraw}
                  roomId={roomId}
                  playerId={socket?.id || ''}
                />
              )}
            </div>
          </div>

          {/* Brush controls bar */}
          {isDrawer && (
            <div className="shrink-0 px-3 pb-2">
              <BrushControls
                onColorChange={(color) => canvasRef.current?.setColor(color)}
                onSizeChange={(size) => canvasRef.current?.setSize(size)}
                onToolChange={(tool) => canvasRef.current?.setTool(tool)}
                onClear={handleClearCanvas}
                onReroll={handleReroll}
                onSkip={handleSkipTurn}
                isDrawer={isDrawer}
              />
            </div>
          )}
        </div>

        {/* Right sidebar: Chat */}
        <div className="w-72 shrink-0 border-l border-gray-800 bg-gray-900/50">
          {roomId && (
            <Chat
              isDrawer={isDrawer}
              messages={messages}
              onSendMessage={handleSendMessage}
              roomId={roomId}
            />
          )}
        </div>
      </div>
    </div>
  )
}
