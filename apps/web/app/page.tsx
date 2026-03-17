'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { gameStore } from '@/lib/store'

export default function Home() {
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
    <main className="min-h-screen bg-gradient-to-br from-purple-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-900 rounded-lg shadow-2xl p-8 border border-purple-500">
          <h1 className="text-4xl font-bold text-white mb-2 text-center">Bad Artists Club</h1>
          <p className="text-gray-400 text-center mb-8">Draw. Guess. Win.</p>

          {isJoining ? (
            // JOIN ROOM FLOW - Simple and clean
            <div className="space-y-6">
              <p className="text-gray-300 text-center text-sm">Joining room: <span className="font-bold text-purple-400">{roomId}</span></p>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                onClick={handleJoinRoom}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded transition"
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
              
              <p className="text-gray-400 text-center text-xs">
                <a href="/" className="text-purple-400 hover:text-purple-300">Create a new room instead</a>
              </p>
            </div>
          ) : (
            // CREATE ROOM FLOW
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded transition"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>

              {/* Join with Room ID */}
              <div className="pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-sm mb-3 text-center">Or join an existing room</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinWithId()}
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleJoinWithId}
                    disabled={loading || !joinRoomId.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded transition"
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
