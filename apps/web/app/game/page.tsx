'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initSocket, waitForSocketConnection } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room, ChatMessage as ChatMessageType, DrawStroke } from '@/lib/types'
import { Canvas, CanvasHandle } from '@/components/Canvas'
import { Chat } from '@/components/Chat'
import { PlayerList } from '@/components/PlayerList'
import { Timer } from '@/components/Timer'
import { ScoreBoard } from '@/components/ScoreBoard'
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
    if (confirm('Leave the game? You cannot rejoin.')) {
      if (socket) {
        socket.emit('leave-room')
      }
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

  const [roomIdCopied, setRoomIdCopied] = useState(false)

  const handleCopyRoomId = () => {
    if (roomId) {
      const link = `${globalThis.location.origin}/room/${roomId}`
      navigator.clipboard.writeText(link)
      setRoomIdCopied(true)
      setTimeout(() => setRoomIdCopied(false), 2000)
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-black flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Loading game...</div>
      </div>
    )
  }

  const isHost = room.host === socket?.id
  const playerCount = room.players.length
  const totalTurns = room.totalRounds * playerCount
  const currentTurn = (room.turnIndex ?? 0) + 1

  // Game ended overlay
  if (gameEnded && finalRoom) {
    const sortedPlayers = [...finalRoom.players].sort((a, b) => b.score - a.score)
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 to-black p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8">Game Over!</h1>
          <div className="bg-gray-900 rounded-lg p-6 border border-purple-500 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">Final Scores</h2>
            <div className="space-y-3">
              {sortedPlayers.map((player, idx) => (
                <div
                  key={player.id}
                  className={`flex justify-between items-center p-4 rounded ${
                    idx === 0 ? 'bg-yellow-900 border border-yellow-500' : 'bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <span className="text-white font-semibold text-lg">{player.username}</span>
                  </div>
                  <span className="text-purple-400 font-bold text-xl">{player.score} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            {isHost && (
              <button
                onClick={handleRestartGame}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg transition-colors"
              >
                Start Game
              </button>
            )}
            <button
              onClick={handleLeaveGame}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-lg transition-colors"
            >
              Leave
            </button>
          </div>
          {!isHost && (
            <p className="text-gray-400 text-center mt-4">Waiting for the host to start a new game...</p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 to-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Notification Banner */}
        {notification && (
          <div className="mb-4 p-4 bg-blue-600 text-white rounded border border-blue-400 animate-pulse">
            {notification}
          </div>
        )}

        {/* Turn cooldown banner */}
        {cooldown > 0 && (
          <div className="mb-4 p-4 bg-indigo-700 text-white rounded border border-indigo-400 text-center text-lg font-bold animate-pulse">
            Next turn starting in {cooldown}...
          </div>
        )}

        {/* Round-ended answer reveal */}
        {roundAnswer && (
          <div className="mb-4 p-4 bg-yellow-600 text-white rounded border border-yellow-400 text-center text-lg font-bold">
            The answer was: {roundAnswer}
          </div>
        )}

        {/* Top Bar with Room Info */}
        <div className="mb-8 flex justify-between items-center bg-gray-900 p-4 rounded border border-purple-500">
          <div>
            <h2 className="text-sm text-gray-400">Room ID</h2>
            <p className="text-xl font-mono font-bold text-purple-400">{roomId}</p>
          </div>
          <button
            onClick={handleCopyRoomId}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              roomIdCopied
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {roomIdCopied ? '✓ Copied!' : 'Copy Room Link'}
          </button>
          <button
            onClick={handleLeaveGame}
            className="px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Leave Game
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left: Canvas and Game Info */}
          <div className="lg:col-span-3 space-y-4">
            {/* Header */}
            <div className="bg-gray-900 p-4 rounded border border-purple-500">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-white">Round {room.round}/{room.totalRounds} — Turn {currentTurn}/{totalTurns}</h1>
                  <p className="text-gray-400 text-xl font-mono tracking-widest">{room.hint}</p>
                  {isDrawer && room.answer && (
                    <p className="text-green-400 mt-1 text-sm">Draw: <span className="font-bold text-lg">{room.answer}</span></p>
                  )}
                  <p className="text-sm mt-2">
                    <span className={`font-semibold ${isDrawer ? 'text-orange-400' : 'text-blue-400'}`}>
                      {isDrawer ? '✎ You are drawing' : '👀 You are guessing'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Canvas */}
            {roomId && (
              <Canvas
                ref={canvasRef}
                isDrawer={isDrawer}
                onDraw={handleDraw}
                roomId={roomId}
                playerId={socket?.id || ''}
              />
            )}

            {/* Brush Controls — wired to Canvas via ref */}
            {isDrawer && (
              <BrushControls
                onColorChange={(color) => canvasRef.current?.setColor(color)}
                onSizeChange={(size) => canvasRef.current?.setSize(size)}
                onToolChange={(tool) => canvasRef.current?.setTool(tool)}
                isDrawer={isDrawer}
              />
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4">
            <Timer timeRemaining={timeRemaining} totalTime={room.drawTime} />
            <PlayerList players={room.players} currentPlayerId={socket?.id || ''} />
            <ScoreBoard room={room} />
            {roomId && <Chat isDrawer={isDrawer} messages={messages} onSendMessage={handleSendMessage} roomId={roomId} />}
          </div>
        </div>
      </div>
    </main>
  )
}
