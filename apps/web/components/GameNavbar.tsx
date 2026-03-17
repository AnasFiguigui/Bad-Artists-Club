'use client'

import { useState } from 'react'

interface GameNavbarProps {
  roomId: string
  isDrawer: boolean
  answer?: string
  hint?: string
  roundAnswer?: string | null
  timeRemaining: number
  totalTime: number
  round: number
  totalRounds: number
  turnIndex: number
  playerCount: number
  muted: boolean
  onToggleMute: () => void
}

export function GameNavbar({
  roomId,
  isDrawer,
  answer,
  hint,
  roundAnswer,
  timeRemaining,
  totalTime,
  round,
  totalRounds,
  turnIndex,
  playerCount,
  muted,
  onToggleMute,
}: GameNavbarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    const link = `${globalThis.location.origin}/room/${roomId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalTurns = totalRounds * playerCount
  const currentTurn = turnIndex + 1
  const timerPercent = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0
  const timerColor = timerPercent > 50 ? 'text-green-400' : timerPercent > 25 ? 'text-yellow-400' : 'text-red-400'

  return (
    <nav className="flex items-center justify-between bg-gray-900/90 border-b border-purple-500/50 px-2 sm:px-4 h-12 sm:h-14 shrink-0">
      {/* Left: Logo + Round info */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
            BA
          </div>
          <span className="text-white font-bold text-sm hidden sm:block">Bad Artists</span>
        </div>
        <div className="text-xs text-gray-400 hidden md:block">
          R{round}/{totalRounds} · T{currentTurn}/{totalTurns}
        </div>
      </div>

      {/* Center: Drawing prompt / Hint + Timer */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 justify-center">
        {roundAnswer ? (
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">Answer:</span>
            <span className="text-yellow-400 font-bold text-sm sm:text-lg">{roundAnswer}</span>
          </div>
        ) : isDrawer && answer ? (
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">Draw:</span>
            <span className="text-green-400 font-bold text-sm sm:text-lg">{answer}</span>
          </div>
        ) : (
          <div className="text-gray-300 text-base sm:text-xl font-mono tracking-[0.2em] sm:tracking-[0.3em] truncate">
            {hint || '...'}
          </div>
        )}
        <div className={`font-bold text-base sm:text-xl tabular-nums ${timerColor}`}>
          {timeRemaining}s
        </div>
      </div>

      {/* Right: Invite + Volume */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={handleCopyLink}
          title="Copy invite link"
          className={`p-2 rounded-lg transition-colors ${
            copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
        >
          {copied ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          )}
        </button>
        <button
          onClick={onToggleMute}
          title={muted ? 'Unmute' : 'Mute'}
          className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          {muted ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  )
}
