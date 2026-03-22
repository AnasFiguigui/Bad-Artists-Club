'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { gameStore } from '@/lib/store'
import LiquidEther from '@/components/LiquidEther'
import { HandDrawnBorder } from '@/components/HandDrawnBorder'
import { BackgroundDoodles } from '@/components/BackgroundDoodles'

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
    <main className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background fluid simulation */}
      <LiquidEther
        colors={['#5227FF', '#FF9FFC', '#B19EEF']}
        className="fixed inset-0 -z-10"
        style={{ width: '100%', height: '100%' }}
      />
      <BackgroundDoodles />
      
      {/* Main card container */}
      <div className="max-w-md w-full">
        {/* Layered paper effect */}
        <div className="paper-layer paper-layer-1" />
        <div className="paper-layer paper-layer-2" />
        
        {/* Main card with hand-drawn aesthetic */}
        <div className="relative card-hand-drawn card-hover rotate-subtle p-8 z-10">
          {/* Hand-drawn border SVG */}
          <HandDrawnBorder />
          
          {/* Content */}
          <div className="relative z-20">
            {/* Logo with decorative underline */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-128 h-128 sm:w-144 sm:h-144 mx-auto mb-2 drop-shadow-lg">
                <img src="/images/logo-bac-white.svg" alt="Bad Artists Club" className="w-full h-full object-contain opacity-90" />
              </div>
              {/* <div className="h-1 w-16 bg-gradient-to-r from-transparent via-pink-400/60 to-transparent rounded-full" /> */}
            </div>
            
            {/* Tagline */}
            <p className="font-caveat text-2xl text-white/90 text-center mb-8 leading-relaxed">
              Draw. Guess. Win.
            </p>

            {isJoining ? (
              // JOIN ROOM FLOW
              <div className="space-y-5">
                <p className="text-gray-50 text-center text-sm">
                  Joining: <span className="font-bold text-purple-800/95 accent-doodle">{roomId}</span>
                </p>
                
                <div>
                  <label htmlFor="join-username" className="block font-medium text-gray-100 mb-2 font-caveat text-base">Your Name</label>
                  <input
                    id="join-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Type here..."
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-100 focus:outline-none focus:border-purple-300/60 backdrop-blur-sm transition-all"
                  />
                </div>

                <button
                  onClick={handleJoinRoom}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500/70 to-blue-600/70 hover:from-blue-500 hover:to-blue-600 border border-blue-400/70 disabled:opacity-50 text-white font-bold font-caveat text-lg py-3 rounded-lg backdrop-blur-sm transition-all hover:shadow-lg active:scale-95"
                >
                  {loading ? 'Joining...' : 'Join Room'}
                </button>
                
                <p className="text-gray-300 text-center text-xs">
                  <a href="/" className="text-purple-100 hover:text-white underline">Create a new room instead</a>
                </p>
              </div>
            ) : (
              // CREATE ROOM FLOW
              <div className="space-y-5">
                <div>
                  <label htmlFor="create-username" className="block font-medium text-gray-100 mb-2 font-caveat text-base">Your Name</label>
                  <input
                    id="create-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Type here..."
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-100 focus:outline-none focus:border-purple-300/60 backdrop-blur-sm transition-all"
                  />
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-500/70 to-indigo-600/70 hover:from-purple-500 hover:to-indigo-600 border border-purple-400/70 disabled:opacity-50 text-white font-bold font-caveat text-lg py-3 rounded-lg backdrop-blur-sm transition-all hover:shadow-lg active:scale-95"
                >
                  {loading ? '✨ Creating Room...' : 'Create Room'}
                </button>

                {/* Divider with personality */}
                <div className="pt-4 border-t border-white/20 relative">
                  <div className="absolute left-0 right-0 -top-3 flex justify-center">
                    {/* <span className="bg-gradient-to-b from-purple-900/80 via-purple-700 to-purple-900/80 px-3 text-xs text-white/90 font-caveat text-sm">or</span> */}
                  </div>
                  <p className="text-gray-100 text-sm mb-4 text-center mt-2 font-caveat">Join with Room ID</p>
                </div>

                {/* Join with Room ID section */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Room code..."
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinWithId()}
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white focus:outline-none focus:border-blue-300/60 backdrop-blur-sm transition-all text-sm"
                  />
                  <button
                    onClick={handleJoinWithId}
                    disabled={loading || !joinRoomId.trim()}
                    className="bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600 border border-blue-400/70 disabled:opacity-50 disabled:from-zinc-500/80 disabled:to-zinc-600/80 disabled:border-zinc-500/80 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-lg backdrop-blur-sm transition-all hover:shadow-md disabled:hover:shadow-none text-sm"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}

            {/* Playful footer hint */}
            <div className="text-center mt-6">
              <p className="text-xs text-white">Ready to draw? Bring your worst!</p>
            </div>
          </div>
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
