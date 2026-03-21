'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { initSocket, waitForSocketConnection } from '@/lib/socket'
import { gameStore } from '@/lib/store'
import { Room, ChatMessage as ChatMessageType, DrawStroke } from '@/lib/types'
import { Canvas, CanvasHandle } from '@/components/Canvas'
import { Chat, ChatHandle } from '@/components/Chat'
import { GameNavbar } from '@/components/GameNavbar'
import { PlayerLeaderboard } from '@/components/PlayerLeaderboard'
import { BrushControls } from '@/components/BrushControls'
import { getThemeConfig } from '@/lib/themeConfig'
import { playCorrectGuess, playTimerTick, playRoundStart, playGameEnd, playVote, playSpeedBonus, playStreakSound, playPlayerJoined } from '@/lib/sounds'

function SettingsModalContent({ room, gameEnded, themeColor, onClose, onApply, onEndGame }: Readonly<{
  room: Room
  gameEnded: boolean
  themeColor: string
  onClose: () => void
  onApply: (settings: { theme?: string; rounds?: number; drawTime?: number }) => void
  onEndGame: () => void
}>) {
  const [pendingTheme, setPendingTheme] = useState(room.theme)
  const [pendingRounds, setPendingRounds] = useState(room.totalRounds)
  const [pendingDrawTime, setPendingDrawTime] = useState(room.drawTime)

  const hasChanges = pendingTheme !== room.theme || pendingRounds !== room.totalRounds || pendingDrawTime !== room.drawTime

  const handleApply = () => {
    const settings: { theme?: string; rounds?: number; drawTime?: number } = {}
    if (pendingTheme !== room.theme) settings.theme = pendingTheme
    if (pendingRounds !== room.totalRounds) settings.rounds = pendingRounds
    if (pendingDrawTime !== room.drawTime) settings.drawTime = pendingDrawTime
    onApply(settings)
    onClose()
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Game Settings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-3">
        {!gameEnded && (
          <p className="text-yellow-300 text-xs italic">Settings can only be changed after the game ends.</p>
        )}
        <div>
          <span className="text-xs text-gray-300 block mb-1">Theme</span>
          <div className="flex flex-wrap gap-1.5">
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
                onClick={() => setPendingTheme(t.value as Room['theme'])}
                disabled={!gameEnded}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  pendingTheme === t.value
                    ? 'bg-purple-500/40 border-purple-400/60 text-white'
                    : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white'
                } border disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-300 block mb-1">Rounds</span>
          <div className="flex gap-1.5">
            {[3, 5, 8, 10].map((r) => (
              <button
                key={r}
                onClick={() => setPendingRounds(r)}
                disabled={!gameEnded}
                className={`flex-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  pendingRounds === r
                    ? 'bg-purple-500/40 border-purple-400/60 text-white'
                    : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white'
                } border disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-300 block mb-1">Draw Time</span>
          <div className="flex flex-wrap gap-1.5">
            {[60, 90, 120, 150, 180, 240].map((t) => (
              <button
                key={t}
                onClick={() => setPendingDrawTime(t)}
                disabled={!gameEnded}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  pendingDrawTime === t
                    ? 'bg-purple-500/40 border-purple-400/60 text-white'
                    : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white'
                } border disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {t}s
              </button>
            ))}
          </div>
        </div>
      </div>
      {gameEnded && (
        <button
          onClick={handleApply}
          disabled={!hasChanges}
          className="w-full mt-4 py-2 text-white rounded-lg font-bold backdrop-blur-sm transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
          style={{ backgroundColor: hasChanges ? themeColor : undefined }}
        >
          Apply
        </button>
      )}
      {!gameEnded && (
        <button
          onClick={onEndGame}
          className="w-full mt-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-100 rounded-lg font-bold backdrop-blur-sm transition-colors text-sm"
        >
          End Game
        </button>
      )}
    </div>
  )
}

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
  const [cooldown, setCooldown] = useState(0)
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  const [showReference, setShowReference] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'chat' | 'players'>('canvas')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [customWordInput, setCustomWordInput] = useState('')
  const [isChoosingWord, setIsChoosingWord] = useState(false)
  const [likes, setLikes] = useState(0)
  const [dislikes, setDislikes] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteType, setVoteType] = useState<'like' | 'dislike' | null>(null)
  const [voteAnimating, setVoteAnimating] = useState(false)

  // Feature state: streaks, speed bonuses, floating emojis, recap, spectator, celebration
  const [playerStreaks, setPlayerStreaks] = useState<Record<string, number>>({})
  const [speedBonuses, setSpeedBonuses] = useState<{ id: number; text: string; x: number; y: number }[]>([])
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; x: number }[]>([])
  const [showRecap, setShowRecap] = useState(false)
  const [recapData, setRecapData] = useState<{ answer: string; topGuesser?: string; totalGuessers: number; drawerLikes: number; drawerDislikes: number } | null>(null)
  const [isSpectator, setIsSpectator] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [rerollCooldown, setRerollCooldown] = useState(0)
  const speedBonusIdRef = useRef(0)
  const floatingEmojiIdRef = useRef(0)
  const rerollCooldownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const canvasRef = useRef<CanvasHandle>(null)
  const chatRef = useRef<ChatHandle>(null)
  const [brushKey, setBrushKey] = useState(0)
  const [currentBrushSize, setCurrentBrushSize] = useState(5)
  const [currentTool, setCurrentTool] = useState<'brush' | 'eraser' | 'fill' | 'line' | 'oval' | 'rect' | 'roundedRect' | 'triangle' | 'callout'>('brush')

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

  const replayStrokes = useCallback((strokes: DrawStroke[]) => {
    for (const stroke of strokes) {
      canvasRef.current?.drawStroke(stroke)
    }
  }, [])

  // Keep mutedRef synced with muted state so socket callbacks read current value
  useEffect(() => { mutedRef.current = muted }, [muted])

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

    sock.on('round-start', (updatedRoom: Room & { customChoosing?: boolean }) => {
      console.log('[Game] round-start received, drawer:', updatedRoom.drawer)
      setRoom(updatedRoom)
      gameStore.setState({ room: updatedRoom })
      setIsDrawer(updatedRoom.drawer === sock.id)
      setMessages([])
      setRoundAnswer(null)
      setCooldown(0)
      setIsChoosingWord(!!updatedRoom.customChoosing)
      setCustomWordInput('')
      setLikes(0)
      setDislikes(0)
      setHasVoted(false)
      setVoteType(null)
      setVoteAnimating(false)
      setShowRecap(false)
      setRecapData(null)
      setRerollCooldown(20)
      
      // Clear existing cooldown interval
      if (rerollCooldownIntervalRef.current) clearInterval(rerollCooldownIntervalRef.current)
      
      // Set up reroll cooldown countdown (20s)
      rerollCooldownIntervalRef.current = setInterval(() => {
        setRerollCooldown((prev) => {
          if (prev <= 0.1) {
            if (rerollCooldownIntervalRef.current) clearInterval(rerollCooldownIntervalRef.current)
            return 0
          }
          return prev - 0.1
        })
      }, 100)
      
      // Play round start sound
      if (!mutedRef.current) playRoundStart()
      // Reset brush controls and chat input for new round
      setBrushKey((k) => k + 1)
      chatRef.current?.clearInput()
      // Reset canvas internal tool state to defaults (syncs with BrushControls remount)
      canvasRef.current?.setColor('#000000')
      canvasRef.current?.setSize(5)
      canvasRef.current?.setTool('brush')
      // Clear canvas for new round
      canvasRef.current?.clear()
      roomLoaded = true
      clearTimeout(roundTimeout)
    })

    sock.on('choose-word', () => {
      setIsChoosingWord(true)
    })

    sock.on('custom-word-accepted', (data: { answer?: string; hint?: string }) => {
      setIsChoosingWord(false)
      setRoom((prev) => {
        if (!prev) return prev
        return { ...prev, answer: data.answer, hint: data.hint }
      })
    })

    sock.on('round-ended', (data: { answer: string; scores: Record<string, number>; topGuesser?: string; totalGuessers: number; drawerLikes: number; drawerDislikes: number }) => {
      console.log('[Game] round-ended, answer was:', data.answer)
      setRoundAnswer(data.answer)
      setRecapData({ answer: data.answer, topGuesser: data.topGuesser, totalGuessers: data.totalGuessers, drawerLikes: data.drawerLikes, drawerDislikes: data.drawerDislikes })
      setShowRecap(true)
    })

    sock.on('player-joined', (updatedRoom: Room) => {
      setRoom((prev) => ({
        ...updatedRoom,
        answer: updatedRoom.answer ?? prev?.answer,
        drawer: updatedRoom.drawer ?? prev?.drawer,
        hint: updatedRoom.hint ?? prev?.hint,
      }))
      const newPlayer = updatedRoom.players.at(-1)
      if (newPlayer) {
        setNotification(`${newPlayer.username} joined the game!`)
        if (!mutedRef.current) playPlayerJoined()
        setTimeout(() => setNotification(null), 3000)
      }
    })

    sock.on('player-left', (updatedRoom: Room) => {
      setRoom((prev) => ({
        ...updatedRoom,
        answer: updatedRoom.answer ?? prev?.answer,
        drawer: updatedRoom.drawer ?? prev?.drawer,
        hint: updatedRoom.hint ?? prev?.hint,
      }))
    })

    sock.on('timer-update', ({ timeRemaining: t }: { timeRemaining: number }) => {
      setTimeRemaining(t)
      if (t <= 10 && t > 0 && !mutedRef.current) playTimerTick()
    })

    sock.on('draw', (stroke: DrawStroke) => {
      // Draw remote stroke on our canvas
      canvasRef.current?.drawStroke(stroke)
    })

    sock.on('chat-message', (message: ChatMessageType) => {
      setMessages((prev) => [...prev, message])
    })

    sock.on('guess-correct', (updatedRoom: Room & { _guesserId?: string; _points?: number; _streak?: number; _position?: number }) => {
      setRoom(updatedRoom)
      const { _guesserId, _points, _streak, _position } = updatedRoom

      // Update streaks
      if (_guesserId && _streak) {
        setPlayerStreaks((prev) => ({ ...prev, [_guesserId]: _streak }))
      }

      // Play sounds
      if (!mutedRef.current) {
        playCorrectGuess()
        if (_points && _points >= 400) playSpeedBonus()
        if (_streak && _streak >= 3) playStreakSound(_streak)
      }

      // Show speed bonus floating text
      if (_guesserId && _points && _points >= 250) {
        const id = ++speedBonusIdRef.current
        const label = _points >= 400 ? `+${_points} FAST!` : `+${_points}`
        const xPos = 30 + Math.random() * 40
        setSpeedBonuses((prev) => [...prev, { id, text: label, x: xPos, y: 50 }])
        setTimeout(() => setSpeedBonuses((prev) => prev.filter((b) => b.id !== id)), 2000)
      }
    })

    sock.on('game-ended', (endedRoom: Room) => {
      setGameEnded(true)
      setRoom(endedRoom)
      setRoundAnswer(null)
      setTimeRemaining(0)
      setShowRecap(false)
      setPlayerStreaks({})
      gameStore.setState({ room: endedRoom })
      // Play game end sound and show celebration
      if (!mutedRef.current) playGameEnd()
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 5000)
      // Clear canvas for free draw mode
      canvasRef.current?.clear()
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
      setMessages([])
      setRoundAnswer(null)
      setCooldown(0)
      setPlayerStreaks({})
      setShowRecap(false)
      setRecapData(null)
      setShowCelebration(false)
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

    sock.on('hint-update', ({ hint }: { hint: string }) => {
      setRoom((prev) => prev ? { ...prev, hint } : prev)
    })

    sock.on('kicked', () => {
      alert('You have been kicked from the room.')
      router.push('/')
    })

    sock.on('host-changed', ({ newHostId, newHostUsername }: { newHostId: string; newHostUsername: string }) => {
      updateRoomHost(newHostId)
      setNotification(`${newHostUsername} is now the host`)
      setTimeout(() => setNotification(null), 3000)
    })

    sock.on('settings-updated', (updatedRoom: Room) => {
      setRoom((prev) => ({
        ...updatedRoom,
        answer: updatedRoom.answer ?? prev?.answer,
        drawer: updatedRoom.drawer ?? prev?.drawer,
        hint: updatedRoom.hint ?? prev?.hint,
      }))
    })

    sock.on('reaction-update', (data: { likes: number; dislikes: number }) => {
      setLikes(data.likes)
      setDislikes(data.dislikes)
    })

    sock.on('spectator-update', (updatedRoom: Room) => {
      setRoom((prev) => ({
        ...updatedRoom,
        answer: updatedRoom.answer ?? prev?.answer,
        drawer: updatedRoom.drawer ?? prev?.drawer,
        hint: updatedRoom.hint ?? prev?.hint,
      }))
      // Update our own spectator state
      const me = updatedRoom.players.find((p: { id: string }) => p.id === sock.id)
      if (me) setIsSpectator(!!me.isSpectator)
    })

    // --- Request current game state (handles race condition) ---
    // The server may have emitted round-start before this page mounted.
    // request-game-state lets us recover the current round data.
    const handleGameStateResponse = (
      sock: ReturnType<typeof initSocket>,
      response: { success: boolean; room: (Room & { canvasStrokes?: DrawStroke[] }) | null },
    ) => {
      if (response.success && response.room && !roomLoaded) {
        console.log('[Game] Got game state from request-game-state')
        const { canvasStrokes, ...roomData } = response.room
        setRoom(roomData)
        gameStore.setState({ room: roomData })
        setIsDrawer(roomData.drawer === sock.id)
        if (roomData.state === 'results') {
          setGameEnded(true)
        }
        if (canvasStrokes && canvasStrokes.length > 0) {
          setTimeout(() => replayStrokes(canvasStrokes), 100)
        }
        roomLoaded = true
        clearTimeout(roundTimeout)
      }
    }

    const requestState = async () => {
      try {
        await waitForSocketConnection(sock)
        sock.emit('request-game-state', { roomId }, (response: { success: boolean; room: (Room & { canvasStrokes?: DrawStroke[] }) | null }) => {
          handleGameStateResponse(sock, response)
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
      if (rerollCooldownIntervalRef.current) clearInterval(rerollCooldownIntervalRef.current)
      sock.off('round-start')
      sock.off('round-ended')
      sock.off('choose-word')
      sock.off('custom-word-accepted')
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
      sock.off('hint-update')
      sock.off('kicked')
      sock.off('host-changed')
      sock.off('settings-updated')
      sock.off('reaction-update')
      sock.off('spectator-update')
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

  const handleUndo = useCallback(() => {
    if (socket && roomId) {
      canvasRef.current?.undo()
      socket.emit('undo', { roomId })
    }
  }, [socket, roomId])

  // Compute canDraw early so hooks below can use it (hooks cannot be called after early return)
  const isCooldown = cooldown > 0
  const canDraw = isSpectator ? false : (gameEnded || (isDrawer && !isCooldown && !isChoosingWord))
  const showReactions = !gameEnded && !isCooldown && room?.state === 'playing' && !!room?.drawer && !isSpectator

  const BRUSH_SIZES = [2, 5, 10, 18, 30] as const

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    if (!canDraw) return
    e.preventDefault()
    setCurrentBrushSize((prev) => {
      const idx = BRUSH_SIZES.indexOf(prev as typeof BRUSH_SIZES[number])
      const currentIdx = idx === -1 ? 1 : idx // default to size 5 (index 1)
      const newIdx = e.deltaY < 0
        ? Math.min(currentIdx + 1, BRUSH_SIZES.length - 1)
        : Math.max(currentIdx - 1, 0)
      const newSize = BRUSH_SIZES[newIdx]
      canvasRef.current?.setSize(newSize)
      return newSize
    })
  }, [canDraw])

  // Keyboard shortcuts: Ctrl+Z undo, B brush, F fill, E eraser, Del clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo (works even when input focused)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canDraw) handleUndo()
        return
      }

      // Escape closes settings modal
      if (e.key === 'Escape') {
        setShowSettingsModal(false)
        return
      }

      // Skip tool shortcuts if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!canDraw) return

      switch (e.key.toLowerCase()) {
        case 'b':
          canvasRef.current?.setTool('brush')
          setCurrentTool('brush')
          break
        case 'f':
          canvasRef.current?.setTool('fill')
          setCurrentTool('fill')
          break
        case 'e':
          canvasRef.current?.setTool('eraser')
          setCurrentTool('eraser')
          break
        case 'delete':
          handleClearCanvas()
          break
      }
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [canDraw, handleUndo])

  const handleReroll = () => {
    if (rerollCooldown > 0) {
      setNotification(`Reroll ready in ${Math.ceil(rerollCooldown)}s`)
      setTimeout(() => setNotification(null), 2000)
      return
    }
    
    if (socket && roomId) {
      socket.emit('reroll', { roomId }, (response: { success: boolean; answer?: string; hint?: string }) => {
        if (response.success && response.answer && response.hint) {
          setRoom((prev) => prev ? { ...prev, answer: response.answer, hint: response.hint } : prev)
          canvasRef.current?.clear()
          socket.emit('clear-canvas', { roomId })
          setRerollCooldown(20)
          
          // Reset cooldown interval
          if (rerollCooldownIntervalRef.current) clearInterval(rerollCooldownIntervalRef.current)
          rerollCooldownIntervalRef.current = setInterval(() => {
            setRerollCooldown((prev) => {
              if (prev <= 0.1) {
                if (rerollCooldownIntervalRef.current) clearInterval(rerollCooldownIntervalRef.current)
                return 0
              }
              return prev - 0.1
            })
          }, 100)
        }
      })
    }
  }

  const handleSubmitCustomWord = () => {
    const word = customWordInput.trim()
    if (!word || word.length > 16 || !socket || !roomId) return
    socket.emit('submit-custom-word', { roomId, word }, (response: { success: boolean; error?: string }) => {
      if (response.success) {
        setIsChoosingWord(false)
      } else {
        setNotification(response.error || 'Failed to submit word')
        setTimeout(() => setNotification(null), 3000)
      }
    })
  }

  const handleSkipTurn = () => {
    if (socket && roomId) {
      socket.emit('skip-turn', { roomId }, () => {})
    }
  }

  const handleVoteReaction = (type: 'like' | 'dislike') => {
    if (socket && roomId && !hasVoted && !isDrawer) {
      socket.emit('vote-reaction', { roomId, type })
      setHasVoted(true)
      setVoteType(type)
      setVoteAnimating(true)
      setTimeout(() => setVoteAnimating(false), 400)
      if (!muted) playVote()
      // Spawn floating emoji
      const id = ++floatingEmojiIdRef.current
      const emoji = type === 'like' ? '👍' : '👎'
      const x = 40 + Math.random() * 20
      setFloatingEmojis((prev) => [...prev, { id, emoji, x }])
      setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 1600)
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

  const handleUpdateSettings = (settings: { theme?: string; rounds?: number; drawTime?: number; maxPlayers?: number }) => {
    if (socket && roomId) {
      socket.emit('update-settings', { roomId, settings }, () => {})
    }
  }

  const handleEndGame = () => {
    if (socket && roomId) {
      socket.emit('end-game', { roomId }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          setNotification(response.error || 'Failed to end game')
          setTimeout(() => setNotification(null), 3000)
        }
      })
    }
  }

  const handleToggleSpectator = () => {
    if (socket && roomId) {
      socket.emit('toggle-spectator', { roomId }, (response: { success: boolean; isSpectator?: boolean; error?: string }) => {
        if (response.success) {
          setIsSpectator(!!response.isSpectator)
        } else {
          setNotification(response.error || 'Cannot toggle spectator')
          setTimeout(() => setNotification(null), 3000)
        }
      })
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
  const themeConfig = getThemeConfig(room.theme)
  const themeColors = themeConfig.colors

  const getTimerColor = () => {
    if (timeRemaining > room.drawTime * 0.5) return themeColors.primary
    if (timeRemaining > room.drawTime * 0.25) return '#eab308'
    return '#ef4444'
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden" style={{ '--theme-primary': themeColors.primary, '--theme-border': themeColors.border, '--theme-bg': themeColors.bg } as React.CSSProperties}>
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
        isHost={isHost}
        gameEnded={gameEnded}
        onEditSettings={() => setShowSettingsModal(true)}
        themeColor={themeColors.primary}
        isChoosingWord={isChoosingWord}
        themeName={themeConfig.name}
        isSpectator={isSpectator}
        onToggleSpectator={handleToggleSpectator}
      />

      {/* Floating toast notifications */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm animate-slide-down" style={{ background: `${themeColors.primary}cc` }}>
          {notification}
        </div>
      )}
      {cooldown > 0 && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-6 py-3 text-white text-lg font-bold rounded-lg shadow-lg backdrop-blur-sm" style={{ background: `${themeColors.primary}cc`, border: `2px solid ${themeColors.primary}` }}>
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
                ? 'border-b-2'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            style={mobilePanel === tab ? { color: themeColors.primary, borderColor: themeColors.primary } : undefined}
          >
            {{ canvas: '🎨 Draw', players: '👥 Players', chat: '💬 Chat' }[tab]}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left sidebar: Players + Round info + Drawer tools — hidden on mobile unless "players" tab */}
        <div className={`md:w-56 shrink-0 flex flex-col md:border-r border-gray-800 bg-gray-900/50 ${
          mobilePanel === 'players' ? 'flex' : 'hidden'
        } md:flex`} style={{ borderColor: themeColors.border }}>
          {/* Round info */}
          {!gameEnded && (
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
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${room.drawTime > 0 ? (timeRemaining / room.drawTime) * 100 : 0}%`,
                  backgroundColor: getTimerColor(),
                }}
              />
            </div>
            <p className="text-xs text-center mt-1">
              <span className="font-semibold" style={{ color: isDrawer ? themeColors.primary : themeColors.secondary || '#60a5fa' }}>
                {isDrawer ? '✎ Drawing' : '👀 Guessing'}
              </span>
            </p>
          </div>
          )}

          {/* Player leaderboard */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PlayerLeaderboard
              players={room.players}
              scores={room.scores}
              currentPlayerId={socket?.id || ''}
              hostId={room.host}
              drawerId={room.drawer}
              gameState={room.state}
              themeColor={themeColors.primary}
              onKick={isHost ? handleKickPlayer : undefined}
              streaks={playerStreaks}
            />
          </div>

          {/* Drawer tools: Reference image + action buttons (only when drawing, not in free draw) */}
          {isDrawer && !gameEnded && (
            <div className="shrink-0 border-t border-gray-700/50 p-2 space-y-2">
              {/* Reference image (hidden for custom theme) */}
              {showReference && room.theme !== 'custom' && (
                <div className="w-full bg-gray-800 border border-gray-700/50 rounded-lg flex items-center justify-center overflow-hidden" style={{ aspectRatio: themeConfig.referenceAspectRatio }}>
                  {(room.theme === 'dbd' || room.theme === 'lol') && room.answer ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/images/${room.theme}/${room.theme === 'dbd' ? room.answer.replaceAll(' ', '_') : encodeURIComponent(room.answer)}.webp`}
                      alt="Reference"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <div className={`text-center text-gray-500 p-2 ${(room.theme === 'dbd' || room.theme === 'lol') && room.answer ? 'hidden' : ''}`}>
                    <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    <span className="text-[10px]">Reference</span>
                  </div>
                </div>
              )}
              {/* Action buttons */}
              <div className="flex gap-1">
              {room.theme !== 'custom' && (
                  <button
                    onClick={handleReroll}
                    disabled={rerollCooldown > 0}
                    title={rerollCooldown > 0 ? `Reroll ready in ${Math.ceil(rerollCooldown)}s` : "Reroll word"}
                    className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded-lg transition-colors text-[10px] font-medium ${
                      rerollCooldown > 0
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-gray-800 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {rerollCooldown > 0 ? `${Math.ceil(rerollCooldown)}s` : 'Reroll'}
                  </button>
                )}
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
                {room.theme !== 'custom' && (
                <button
                  onClick={() => setShowReference(!showReference)}
                  title={showReference ? 'Hide reference' : 'Show reference'}
                  className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded-lg transition-colors text-[10px] font-medium ${
                    showReference
                      ? 'text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                  style={showReference ? { backgroundColor: `${themeColors.primary}80` } : undefined}
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
                )}
              </div>
            </div>
          )}

          {/* Start Game button for host when game ended */}
          {gameEnded && isHost && (
            <div className="shrink-0 border-t border-gray-700/50 p-2">
              {playerCount >= 2 ? (
                <button
                  onClick={handleRestartGame}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors text-sm"
                >
                  Start Game
                </button>
              ) : (
                <p className="text-gray-400 text-center text-xs">Need 2+ players to start</p>
              )}
            </div>
          )}
          {gameEnded && !isHost && (
            <div className="shrink-0 border-t border-gray-700/50 p-2">
              <p className="text-gray-400 text-center text-xs">Waiting for host to start...</p>
            </div>
          )}
        </div>

        {/* Center: Canvas + Brush Controls — always visible */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-3 min-h-0 animate-fade-in">
            <div className="w-full max-h-full" style={{ aspectRatio: '16/9' }} onWheel={handleCanvasWheel}>
              {roomId && (
                <Canvas
                  ref={canvasRef}
                  isDrawer={canDraw}
                  onDraw={handleDraw}
                  roomId={roomId}
                  playerId={socket?.id || ''}
                />
              )}
            </div>
          </div>

          {/* Brush controls bar (drawer) */}
          {canDraw && (
            <div className="shrink-0 px-2 sm:px-3 pb-2 animate-slide-up">
              <BrushControls
                key={brushKey}
                onColorChange={(color) => canvasRef.current?.setColor(color)}
                onSizeChange={(size) => { canvasRef.current?.setSize(size); setCurrentBrushSize(size) }}
                onToolChange={(tool) => { canvasRef.current?.setTool(tool); setCurrentTool(tool) }}
                onClear={handleClearCanvas}
                onUndo={handleUndo}
                isDrawer={canDraw}
                themeColor={themeColors.primary}
                externalSize={currentBrushSize}
                externalTool={currentTool}
                likes={likes}
                dislikes={dislikes}
                showReactions={showReactions && isDrawer}
              />
            </div>
          )}

          {/* Guesser bar — always visible when not drawing, reactions inside when active */}
          {!canDraw && (
            <div className="shrink-0 px-2 sm:px-3 pb-2">
              <div className="flex items-center justify-center bg-gray-900/80 border border-gray-700/50 rounded-lg px-2 sm:px-3 py-2 min-h-[2.75rem]">
                {showReactions && !isDrawer && (
                  <div className="flex items-center gap-1">
                    {hasVoted ? (
                      <>
                        <span className={`flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-sm transition-all ${voteType === 'like' ? 'bg-green-900/40 ring-1 ring-green-500/50' : 'bg-gray-800/50 opacity-40'} ${voteAnimating && voteType === 'like' ? 'animate-vote-bounce' : ''}`}>
                          <span>👍</span><span className="text-green-400 font-bold tabular-nums">{likes}</span>
                        </span>
                        <span className={`flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-sm transition-all ${voteType === 'dislike' ? 'bg-red-900/40 ring-1 ring-red-500/50' : 'bg-gray-800/50 opacity-40'} ${voteAnimating && voteType === 'dislike' ? 'animate-vote-bounce' : ''}`}>
                          <span>👎</span><span className="text-red-400 font-bold tabular-nums">{dislikes}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleVoteReaction('like')}
                          className="flex items-center gap-0.5 px-2.5 py-1.5 bg-gray-800 hover:bg-green-900/40 rounded-lg text-sm transition-all hover:scale-105 active:scale-95"
                        >
                          <span>👍</span><span className="text-green-400 font-bold tabular-nums">{likes}</span>
                        </button>
                        <button
                          onClick={() => handleVoteReaction('dislike')}
                          className="flex items-center gap-0.5 px-2.5 py-1.5 bg-gray-800 hover:bg-red-900/40 rounded-lg text-sm transition-all hover:scale-105 active:scale-95"
                        >
                          <span>👎</span><span className="text-red-400 font-bold tabular-nums">{dislikes}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: Chat — hidden on mobile unless "chat" tab */}
        <div className={`md:w-72 shrink-0 md:border-l border-gray-800 bg-gray-900/50 ${
          mobilePanel === 'chat' ? 'flex' : 'hidden'
        } md:flex`} style={{ borderColor: themeColors.border }}>
          {roomId && (
            <Chat
              ref={chatRef}
              isDrawer={gameEnded ? false : isDrawer}
              isCooldown={isCooldown && !gameEnded}
              isSpectator={isSpectator}
              messages={messages}
              onSendMessage={handleSendMessage}
              roomId={roomId}
              themeColor={themeColors.primary}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false) }}
        >
          <SettingsModalContent
            room={room}
            gameEnded={gameEnded}
            themeColor={themeColors.primary}
            onClose={() => setShowSettingsModal(false)}
            onApply={handleUpdateSettings}
            onEndGame={() => { handleEndGame(); setShowSettingsModal(false) }}
          />
        </div>
      )}

      {/* Custom Word Choosing Modal */}
      {isChoosingWord && isDrawer && (
        <dialog
          open
          aria-label="Choose a word"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm m-0 w-full h-full border-none"
        >
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold text-white text-center mb-1">Choose a Word</h2>
            <p className="text-gray-400 text-xs text-center mb-4">
              Type a word for others to guess (max 16 characters)
            </p>
            <div className="text-center mb-3">
              <span className="font-bold text-2xl tabular-nums" style={{ color: themeColors.primary }}>{timeRemaining}s</span>
            </div>
            <input
              type="text"
              value={customWordInput}
              onChange={(e) => {
                if (e.target.value.length <= 16) setCustomWordInput(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitCustomWord()
              }}
              placeholder="Enter your word..."
              maxLength={16}
              autoFocus
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-white/40 backdrop-blur-sm transition-colors mb-1"
            />
            <p className="text-gray-500 text-xs text-right mb-3">{customWordInput.length}/16</p>
            <button
              onClick={handleSubmitCustomWord}
              disabled={!customWordInput.trim()}
              className="w-full py-2.5 text-white rounded-lg font-bold transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
              style={{ backgroundColor: themeColors.primary }}
            >
              Confirm Word
            </button>
          </div>
        </dialog>
      )}

      {/* Waiting for drawer to choose (guessers see this) */}
      {isChoosingWord && !isDrawer && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm font-bold animate-slide-down" style={{ background: `${themeColors.primary}cc` }}>
          ✏️ Drawer is choosing a word...
        </div>
      )}

      {/* Spectating banner */}
      {isSpectator && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 text-white/80 text-xs rounded-lg shadow-lg backdrop-blur-sm font-bold bg-gray-800/80 border border-gray-600/50">
          👁 Spectating
        </div>
      )}

      {/* Floating vote emojis (Twitch-style) */}
      {floatingEmojis.map((emoji) => (
        <div
          key={emoji.id}
          className="fixed z-50 text-3xl animate-float-emoji pointer-events-none"
          style={{ left: `${emoji.x}%`, bottom: '15%' }}
        >
          {emoji.emoji}
        </div>
      ))}

      {/* Speed bonus floating text */}
      {speedBonuses.map((bonus) => (
        <div
          key={bonus.id}
          className="fixed z-50 animate-speed-bonus pointer-events-none font-bold text-lg"
          style={{ left: `${bonus.x}%`, top: '40%', color: themeColors.primary, textShadow: '0 0 8px rgba(0,0,0,0.5)' }}
        >
          {bonus.text}
        </div>
      ))}

      {/* Round Recap Overlay (3s between rounds) */}
      {showRecap && recapData && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="animate-recap bg-black/70 backdrop-blur-md rounded-2xl px-8 py-6 border border-white/10 text-center max-w-sm">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">The answer was</p>
            <p className="text-white font-bold text-2xl mb-3">{recapData.answer}</p>
            {recapData.topGuesser && (
              <p className="text-sm text-gray-300 mb-1">
                ⚡ First guess: <span className="font-bold" style={{ color: themeColors.primary }}>{recapData.topGuesser}</span>
              </p>
            )}
            <p className="text-xs text-gray-400 mb-2">
              {recapData.totalGuessers} player{recapData.totalGuessers !== 1 ? 's' : ''} guessed correctly
            </p>
            <div className="flex items-center justify-center gap-3 text-sm">
              <span>👍 {recapData.drawerLikes}</span>
              <span>👎 {recapData.drawerDislikes}</span>
            </div>
          </div>
        </div>
      )}

      {/* Winner Celebration Overlay */}
      {showCelebration && room && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
          <div className="animate-celebration text-center">
            {/* Confetti pieces */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: '-10px',
                  backgroundColor: ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'][i % 6],
                  '--fall-duration': `${2 + Math.random() * 2}s`,
                  '--fall-delay': `${Math.random() * 0.5}s`,
                } as React.CSSProperties}
              />
            ))}
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-white font-bold text-2xl mb-2">Game Over!</p>
            {(() => {
              const sorted = [...room.players].sort((a, b) => (room.scores[b.id] || 0) - (room.scores[a.id] || 0))
              const medals = ['🥇', '🥈', '🥉']
              return (
                <div className="space-y-2">
                  {sorted.slice(0, 3).map((p, i) => (
                    <div key={p.id} className="flex items-center justify-center gap-2 text-white">
                      <span className="text-xl">{medals[i]}</span>
                      <span className="font-bold">{p.username}</span>
                      <span className="text-gray-300 tabular-nums">{room.scores[p.id] || 0}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
