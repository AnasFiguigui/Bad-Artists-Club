'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { gameStore } from '@/lib/store'
import { Grainient } from '@/components/Grainient'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [joinRoomId, setJoinRoomId] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Get roomId from URL if provided
  const roomId = searchParams.get('roomId')
  const isJoining = !!roomId
  
  // Get store methods
  const storeSetUsername = gameStore((state) => state.setUsername)
  const storeSetRoomId = gameStore((state) => state.setRoomId)

  const handleCreateRoom = async () => {
    if (!username.trim()) return alert('Please enter a username')
    setLoading(true)
    storeSetUsername(username)
    router.push(`/lobby`)
  }

  const handleJoinRoom = async () => {
    if (!username.trim()) return alert('Please enter a username')
    if (!roomId) return alert('Invalid room ID')
    setLoading(true)
    storeSetUsername(username)
    storeSetRoomId(roomId)
    router.push(`/room/${roomId}`)
  }

  const handleJoinWithId = () => {
    if (!username.trim()) return alert('Please enter a username')
    if (!joinRoomId.trim()) return alert('Please enter a room ID')
    setLoading(true)
    storeSetUsername(username)
    storeSetRoomId(joinRoomId.trim())
    router.push(`/room/${joinRoomId.trim()}`)
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4">
      <Grainient
        color1="#FF9FFC"
        color2="#5227FF"
        color3="#B19EEF"
        className="fixed inset-0 -z-10"
      />
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-2 text-center">Bad Artists Club</h1>
          <p className="text-white/90 text-center mb-8">Draw. Guess. Win.</p>

          {isJoining ? (
            // JOIN ROOM FLOW - Simple and clean
            <div className="space-y-6">
              <p className="text-gray-50 text-center text-sm">Joining room: <span className="font-bold text-indigo-500">{roomId}</span></p>
              
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-2">Your Name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-100 focus:outline-none focus:border-white/40 backdrop-blur-sm transition-colors"
                />
              </div>

              <button
                onClick={handleJoinRoom}
                disabled={loading}
                className="w-full bg-blue-500/80 hover:bg-blue-500/60 border border-blue-400/70 disabled:opacity-50 text-white font-bold py-3 rounded-lg backdrop-blur-sm transition-colors"
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
              
              <p className="text-gray-400 text-center text-xs">
                <a href="/" className="text-white hover:text-white/70">Create a new room instead</a>
              </p>
            </div>
          ) : (
            // CREATE ROOM FLOW
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-2">Your Name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-100 focus:outline-none focus:border-white/40 backdrop-blur-sm transition-colors"
                />
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full bg-indigo-500/80 hover:bg-indigo-500/60 border border-indigo-400/30 disabled:opacity-50 text-white font-bold py-3 rounded-lg backdrop-blur-sm transition-colors"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>

              {/* Join with Room ID */}
              <div className="pt-4 border-t border-white/30">
                <p className="text-gray-100 text-sm mb-3 text-center">Or join an existing room</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinWithId()}
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-100 focus:outline-none focus:border-white/40 backdrop-blur-sm transition-colors"
                  />
                  <button
                    onClick={handleJoinWithId}
                    disabled={loading || !joinRoomId.trim()}
                    className="bg-blue-500/80 hover:bg-blue-500/60 border border-blue-400/80 disabled:opacity-50 disabled:bg-gray-500/85 disabled:border-gray-400/85 text-blue-100 font-bold px-5 py-2 rounded-lg backdrop-blur-sm transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-white text-lg">Loading...</div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  )
}
