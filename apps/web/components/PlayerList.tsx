'use client'

import { Player } from '@/lib/types'

interface PlayerListProps {
  players: Player[]
  currentPlayerId: string
}

export function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-4">Players ({players.length})</h3>
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`p-3 rounded text-sm ${
              player.id === currentPlayerId ? 'bg-purple-900 border border-purple-500' : 'bg-gray-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white font-semibold">{player.username}</span>
                {player.isHost && <span className="text-yellow-400 ml-2 text-xs">[HOST]</span>}
                {player.isDrawer && <span className="text-orange-400 ml-2 text-xs">[DRAWING]</span>}
              </div>
              <span className="text-green-400 font-bold">{player.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
