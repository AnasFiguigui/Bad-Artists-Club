'use client'

import { Room } from '@/lib/types'

interface ScoreBoardProps {
  room: Room | null
}

export function ScoreBoard({ room }: ScoreBoardProps) {
  if (!room) return null

  const sortedPlayers = [...room.players].sort((a, b) => room.scores[b.id] - room.scores[a.id])

  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-4">Leaderboard</h3>
      <div className="space-y-2">
        {sortedPlayers.map((player, idx) => (
          <div key={player.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold w-6">#{idx + 1}</span>
              <span className="text-white">{player.username}</span>
            </div>
            <span className="text-green-400 font-bold">{room.scores[player.id] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
