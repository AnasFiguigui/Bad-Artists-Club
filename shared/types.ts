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
  theme: 'lol' | 'elden-ring' | 'dbd' | 'game-titles' | 'anime' | 'custom'
  round: number
  totalRounds: number
  drawer?: string
  answer?: string
  timer: number
  drawTime: number
  scores: Record<string, number>
  maxPlayers: number
  hint?: string
  turnIndex: number        // which turn within the game (0-based across all rounds)
  correctGuessers: string[] // socket IDs of players who guessed correctly this turn
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
  isClose?: boolean      // shown only to the guesser
  isSystem?: boolean     // system announcement to everyone
  guessPosition?: number // 1st, 2nd, 3rd...
}

export interface GameConfig {
  theme: 'lol' | 'elden-ring' | 'dbd' | 'game-titles' | 'anime' | 'custom'
  rounds: 3 | 5 | 8 | 10
  drawTime: 60 | 90 | 120
  maxPlayers: number
}

export interface Character {
  name: string
  hintLength: number
}
