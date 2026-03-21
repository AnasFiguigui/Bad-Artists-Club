'use client'

import { Player } from '@/lib/types'

interface PlayerLeaderboardProps {
  players: Player[]
  scores: Record<string, number>
  currentPlayerId: string
  hostId: string
  drawerId?: string
  gameState?: 'lobby' | 'playing' | 'results'
  themeColor?: string
  onKick?: (targetId: string) => void
  streaks?: Record<string, number>
}

export function PlayerLeaderboard({
  players,
  scores,
  currentPlayerId,
  hostId,
  drawerId,
  gameState,
  themeColor,
  onKick,
  streaks = {},
}: Readonly<PlayerLeaderboardProps>) {
  const activePlayers = players.filter((p) => !p.isSpectator)
  const spectators = players.filter((p) => p.isSpectator)
  const sorted = [...activePlayers].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
  const isHost = currentPlayerId === hostId
  const anyScores = sorted.some((p) => (scores[p.id] || 0) > 0)

  // Compute score ranks: players with the same score share the same rank
  const scoreRanks = new Map<string, number>()
  let rank = 0
  let lastScore = -1
  for (const p of sorted) {
    const s = scores[p.id] || 0
    if (s !== lastScore) {
      rank++
      lastScore = s
    }
    scoreRanks.set(p.id, rank)
  }

  const getScoreColor = (playerId: string): string => {
    if (!anyScores) return '#ffffff'
    const r = scoreRanks.get(playerId) || 999
    if (r === 1) return '#fbbf24' // gold
    if (r === 2) return '#c0c0c0' // silver
    if (r === 3) return '#cd7f32' // bronze
    return '#ffffff'
  }

  return (
    <div className="bg-gray-900/80 rounded-lg border border-gray-700/50 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Players ({activePlayers.length})</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((player, idx) => {
          const isMe = player.id === currentPlayerId
          const isDrawing = player.id === drawerId && gameState === 'playing'
          const medal = anyScores && (scoreRanks.get(player.id) || 999) === 1 ? '👑 ' : ''

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-3 py-2 border-b border-gray-800/50 last:border-0 ${
                isDrawing ? 'bg-orange-900/20' : ''
              }`}
              style={isMe ? { backgroundColor: `${themeColor || '#4f46e5'}30` } : undefined}
            >
              <span className="text-gray-500 text-xs font-bold w-5 text-right">
                #{idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium truncate" style={isMe ? { color: themeColor || '#818cf8' } : { color: '#ffffff' }}>
                    {medal}{player.username}
                  </span>
                  {player.isHost && (
                    <span className="text-[10px] text-yellow-400 font-bold">[Host]</span>
                  )}
                  {isDrawing && (
                    <span className="text-[10px] text-orange-400 animate-pencil-wiggle">✎</span>
                  )}
                  {(streaks[player.id] || 0) >= 3 && (
                    <span className="text-xs animate-flame" title={`${streaks[player.id]} streak!`}>🔥{streaks[player.id]}</span>
                  )}
                </div>
              </div>
              <span className="font-bold text-sm tabular-nums" style={{ color: getScoreColor(player.id) }}>
                {scores[player.id] || 0}
              </span>
              {isHost && !isMe && onKick && (
                <button
                  onClick={() => onKick(player.id)}
                  title={`Kick ${player.username}`}
                  className="text-red-400 hover:text-red-300 p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </div>
      {spectators.length > 0 && (
        <>
          <div className="px-3 py-1.5 border-t border-gray-700/50">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Spectators ({spectators.length})</h4>
          </div>
          <div className="overflow-y-auto">
            {spectators.map((player) => {
              const isMe = player.id === currentPlayerId
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/50 last:border-0 opacity-60"
                >
                  <span className="text-gray-600 text-xs w-5 text-right">👁</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-400 truncate" style={isMe ? { color: themeColor || '#818cf8' } : undefined}>
                      {player.username}
                    </span>
                  </div>
                  {isHost && !isMe && onKick && (
                    <button
                      onClick={() => onKick(player.id)}
                      title={`Kick ${player.username}`}
                      className="text-red-400 hover:text-red-300 p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
