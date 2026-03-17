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
  const [showReference, setShowReference] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'chat' | 'players'>('canvas')

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

    sock.on('undo', () => {
      canvasRef.current?.undo()
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
      sock.off('undo')
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

  const handleUndo = () => {
    if (socket && roomId) {
      canvasRef.current?.undo()
      socket.emit('undo', { roomId })
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
        roundAnswer={roundAnswer}
        timeRemaining={timeRemaining}
        totalTime={room.drawTime}
        round={room.round}
        totalRounds={room.totalRounds}
        turnIndex={room.turnIndex ?? 0}
        playerCount={playerCount}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
      />

      {/* Floating toast notifications */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-blue-600/90 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm animate-pulse">
          {notification}
        </div>
      )}
      {cooldown > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-700/90 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm font-bold animate-pulse">
          Next turn in {cooldown}...
        </div>
      )}

      {/* Mobile tab bar */}
      <div className="flex md:hidden border-b border-gray-800 bg-gray-900/80 shrink-0">
        {(['canvas', 'players', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobilePanel(tab)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              mobilePanel === tab
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'canvas' ? '🎨 Draw' : tab === 'players' ? '👥 Players' : '💬 Chat'}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar: Players + Round info + Drawer tools — hidden on mobile unless "players" tab */}
        <div className={`w-full md:w-56 shrink-0 flex flex-col md:border-r border-gray-800 bg-gray-900/50 ${
          mobilePanel === 'players' ? 'flex' : 'hidden'
        } md:flex`}>
          {/* Round info */}
          <div className="px-3 py-2 border-b border-gray-700/50 shrink-0">
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
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PlayerLeaderboard
              players={room.players}
              scores={room.scores}
              currentPlayerId={socket?.id || ''}
              hostId={room.host}
              drawerId={room.drawer}
              onKick={isHost ? handleKickPlayer : undefined}
            />
          </div>

          {/* Drawer tools: Reference image + action buttons (only when drawing) */}
          {isDrawer && (
            <div className="shrink-0 border-t border-gray-700/50 p-2 space-y-2">
              {/* Reference image placeholder */}
              {showReference && (
                <div className="w-full bg-gray-800 border border-gray-700/50 rounded-lg flex items-center justify-center overflow-hidden" style={{ aspectRatio: '9/16' }}>
                  <div className="text-center text-gray-500 p-2">
                    <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    <span className="text-[10px]">Reference</span>
                  </div>
                </div>
              )}
              {/* Action buttons */}
              <div className="flex gap-1">
                <button
                  onClick={handleReroll}
                  title="Reroll word"
                  className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded-lg bg-gray-800 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300 transition-colors text-[10px] font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reroll
                </button>
                <button
                  onClick={handleSkipTurn}
                  title="Skip turn"
                  className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded-lg bg-gray-800 text-yellow-400 hover:bg-yellow-900/50 hover:text-yellow-300 transition-colors text-[10px] font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Skip
                </button>
                <button
                  onClick={() => setShowReference(!showReference)}
                  title={showReference ? 'Hide reference' : 'Show reference'}
                  className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded-lg transition-colors text-[10px] font-medium ${
                    showReference
                      ? 'bg-purple-600/50 text-purple-300 hover:bg-purple-700/50'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {showReference ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    )}
                  </svg>
                  {showReference ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: Canvas + Brush Controls — hidden on mobile unless "canvas" tab */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${
          mobilePanel === 'canvas' ? 'flex' : 'hidden'
        } md:flex`}>
          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-3 min-h-0">
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
            <div className="shrink-0 px-2 sm:px-3 pb-2">
              <BrushControls
                onColorChange={(color) => canvasRef.current?.setColor(color)}
                onSizeChange={(size) => canvasRef.current?.setSize(size)}
                onToolChange={(tool) => canvasRef.current?.setTool(tool)}
                onClear={handleClearCanvas}
                onUndo={handleUndo}
                isDrawer={isDrawer}
              />
            </div>
          )}
        </div>

        {/* Right sidebar: Chat — hidden on mobile unless "chat" tab */}
        <div className={`w-full md:w-72 shrink-0 md:border-l border-gray-800 bg-gray-900/50 ${
          mobilePanel === 'chat' ? 'flex' : 'hidden'
        } md:flex`}>
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
