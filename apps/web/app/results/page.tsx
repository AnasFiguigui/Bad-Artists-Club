'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { gameStore } from '@/lib/store'

export default function ResultsPage() {
  const router = useRouter()
  const { room } = gameStore()

  const [finalScores, setFinalScores] = useState<{ username: string; score: number }[]>([])

  useEffect(() => {
    if (!room) {
      router.push('/')
      return
    }

    const sorted = [...room.players]
      .map((p) => ({ username: p.username, score: room.scores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score)

    setFinalScores(sorted)
  }, [room, router])

  const handlePlayAgain = () => {
    router.push(`/lobby`)
  }

  const handleBackHome = () => {
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-900 rounded-lg shadow-2xl p-8 border border-indigo-500">
          <h1 className="text-4xl font-bold text-center text-white mb-2">Game Over!</h1>
          <p className="text-center text-gray-400 mb-8">Final Results</p>

          <div className="space-y-3 mb-8">
            {finalScores.map((player, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-800 p-3 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-bold w-6">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className="text-white">{player.username}</span>
                </div>
                <span className="text-emerald-400 font-bold">{player.score}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePlayAgain}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded transition"
            >
              Play Again
            </button>
            <button
              onClick={handleBackHome}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded transition"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
