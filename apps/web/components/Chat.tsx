'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatMessage as ChatMessageType } from '@/lib/types'

interface ChatProps {
  isDrawer: boolean
  messages: ChatMessageType[]
  onSendMessage: (message: string) => void
  roomId: string
}

export function Chat({ isDrawer, messages, onSendMessage, roomId }: ChatProps) {
  const [input, setInput] = useState('')
  const [lastGuessTime, setLastGuessTime] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return

    const now = Date.now()
    if (now - lastGuessTime < 1000) return

    onSendMessage(input)
    setLastGuessTime(now)
    setInput('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-700/50">
        <h3 className="text-sm font-bold text-white">Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
        {messages.map((msg, idx) => {
          let bgColor = ''
          let textColor = 'text-gray-300'
          let prefix = ''

          if (msg.isCorrect) {
            bgColor = 'bg-emerald-900/50'
            textColor = 'text-emerald-200'
            if (msg.guessPosition) {
              const medals: Record<number, string> = { 1: '🥇 ', 2: '🥈 ', 3: '🥉 ' }
              prefix = medals[msg.guessPosition] || `#${msg.guessPosition} `
            }
          } else if (msg.isClose) {
            bgColor = 'bg-yellow-900/50'
            textColor = 'text-yellow-200'
          }

          return (
            <div
              key={`${msg.timestamp}-${msg.userId}-${idx}`}
              className={`text-xs ${bgColor} ${textColor} px-2 py-1.5 rounded`}
            >
              {msg.isSystem ? (
                <span className="font-semibold">{prefix}{msg.message}</span>
              ) : (
                <>
                  <span className="font-semibold text-blue-400">{msg.username}: </span>
                  {msg.message}
                </>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {!isDrawer ? (
        <div className="p-2 border-t border-gray-700/50">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your guess..."
              className="flex-1 px-2 py-1.5 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleSend}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-gray-700/50">
          <p className="text-yellow-400 text-xs italic text-center">You are drawing — cannot chat</p>
        </div>
      )}
    </div>
  )
}
