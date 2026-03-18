// Re-export types from shared folder
// In a monorepo setup, these would ideally be in a shared workspace package
// For now, we duplicate them here for simplicity

export interface Player {
  id: string
  username: string
  ready: boolean
  score: number
  isDrawer?: boolean
  isHost: boolean
}

export interface Room {
  id: string
  host: string
  players: Player[]
  state: 'lobby' | 'playing' | 'results'
  theme: 'lol' | 'elden-ring' | 'dbd'
  round: number
  totalRounds: number
  drawer?: string
  answer?: string
  timer: number
  drawTime: number
  scores: Record<string, number>
  maxPlayers: number
  hint?: string
  turnIndex: number
  correctGuessers: string[]
}

export interface DrawStroke {
  roomId: string
  userId: string
  color: string
  size: number
  tool: 'brush' | 'eraser' | 'fill'
  points: { x: number; y: number }[]
  partial?: boolean // true = streaming mid-stroke segment, false/undefined = complete stroke
}

export interface ChatMessage {
  userId: string
  username: string
  message: string
  timestamp: number
  isCorrect?: boolean
  isClose?: boolean
  isSystem?: boolean
  guessPosition?: number
}

export interface GameConfig {
  theme: 'lol' | 'elden-ring' | 'dbd'
  rounds: 3 | 5 | 8 | 10
  drawTime: 60 | 90 | 120
  maxPlayers: number
}

export interface Character {
  name: string
  hintLength: number
}
