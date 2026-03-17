import { create } from 'zustand'
import { Room, Player } from './types'

interface GameStore {
  username: string
  roomId: string | null
  room: Room | null
  isDrawer: boolean
  currentPlayer: Player | null
  chatMessages: any[]
  setUsername: (username: string) => void
  setRoomId: (roomId: string) => void
  setRoom: (room: Room) => void
  setIsDrawer: (isDrawer: boolean) => void
  setCurrentPlayer: (player: Player) => void
  addChatMessage: (message: any) => void
  clearChat: () => void
}

export const gameStore = create<GameStore>((set) => ({
  username: '',
  roomId: null,
  room: null,
  isDrawer: false,
  currentPlayer: null,
  chatMessages: [],
  setUsername: (username) => set({ username }),
  setRoomId: (roomId) => set({ roomId }),
  setRoom: (room) => set({ room }),
  setIsDrawer: (isDrawer) => set({ isDrawer }),
  setCurrentPlayer: (currentPlayer) => set({ currentPlayer }),
  addChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  clearChat: () => set({ chatMessages: [] }),
}))
