'use client'

interface TimerProps {
  timeRemaining: number
  totalTime: number
}

export function Timer({ timeRemaining, totalTime }: TimerProps) {
  const percentage = (timeRemaining / totalTime) * 100

  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700">
      <div className="text-center">
        <div className="text-4xl font-bold text-white mb-2">{timeRemaining}s</div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              percentage > 50
                ? 'bg-green-500'
                : percentage > 25
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
