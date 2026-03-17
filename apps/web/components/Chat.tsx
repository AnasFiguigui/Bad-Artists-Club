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
    if (now - lastGuessTime < 1000) {
      alert('You can only guess once per second')
      return
    }

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
    <div className="flex flex-col gap-4 bg-gray-900 p-4 rounded border border-gray-700 h-96">
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.map((msg, idx) => {
          let bgColor = ''
          let textColor = 'text-gray-300'
          let prefix = ''

          if (msg.isCorrect) {
            bgColor = 'bg-green-900'
            textColor = 'text-green-200'
            if (msg.guessPosition) {
              const medals: Record<number, string> = { 1: '🥇 ', 2: '🥈 ', 3: '🥉 ' }
              prefix = medals[msg.guessPosition] || `#${msg.guessPosition} `
            }
          } else if (msg.isClose) {
            bgColor = 'bg-yellow-900'
            textColor = 'text-yellow-200'
          }

          return (
            <div
              key={idx}
              className={`text-sm ${bgColor} ${textColor} p-2 rounded`}
            >
              {msg.isSystem ? (
                <span className="font-semibold">{prefix}{msg.message}</span>
              ) : (
                <>
                  <span className="font-semibold text-blue-400">{msg.username}:</span> {msg.message}
                </>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {!isDrawer && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your guess..."
            className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSend}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-semibold"
          >
            Send
          </button>
        </div>
      )}

      {isDrawer && <div className="text-yellow-400 text-sm italic">You are the drawer. Watch the guesses!</div>}
    </div>
  )
}
