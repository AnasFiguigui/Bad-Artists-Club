# Bad Artists Club - Multiplayer Drawing Guessing Game

A real-time multiplayer web game where players take turns drawing while others guess. Built with Next.js, Node.js, Socket.IO, and TailwindCSS.

## Features

- 🎨 Real-time multiplayer drawing with Socket.IO
- 🎮 Three theme packs: League of Legends, Elden Ring, Dead by Daylight
- 📊 Point-based scoring system
- 🎯 Anti-cheat measures
- 🔄 State management with Zustand
- 🎨 Customizable brush sizes and colors

## Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **TailwindCSS**
- **Zustand** (State Management)
- **Socket.IO Client**

### Backend
- **Node.js**
- **Express**
- **Socket.IO**

### Data
- **Character packs** in JSON format

## Project Structure

```
/apps
  /web                 # Next.js frontend
    /app              # Next.js app router pages
    /components       # Reusable UI components
    /lib              # Utilities (socket, store, etc.)

/server               # Node.js/Express backend
  /socket            # Socket.IO event handlers

/shared              # Shared TypeScript types
/data                # Character data files
```

## Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd Bad-Artists-Club
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp apps/web/.env.example apps/web/.env.local
cp server/.env.example server/.env.local
```

4. Start both frontend and backend:
```bash
npm run dev
```

Or run separately:
```bash
# Frontend (http://localhost:3000)
npm run dev --workspace=apps/web

# Backend (http://localhost:3001)
npm run dev --workspace=server
```

## Game Flow

1. **Landing Page**: Enter username, create or join a room
2. **Lobby**: Host configures game settings (theme, rounds, draw time, max players)
3. **Game Round**: Players take turns drawing while others guess in chat
4. **Scoring**: Points awarded for correct guesses and drawing
5. **Results**: Final leaderboard displayed

## Scoring System

- **Correct Guess**: `1000 - (timeUsed * 5)` points (minimum 100)
- **Drawer**: `guessPoints * 0.7`

## Drawing System

- **Canvas Resolution**: 1280x720
- **Brush Sizes**: 2, 5, 8, 12, 18, 24 pixels
- **Eraser Sizes**: 10, 20, 30 pixels
- **Colors**: 12-color palette
- **Tools**: Brush and Eraser
- **Sync**: Vector-based stroke synchronization (~30ms batching)

## API Events

### Client → Server

- `create-room`: Create a new game room
- `join-room`: Join existing room by ID
- `ready`: Mark player as ready
- `start-game`: Start the game (host only)
- `draw`: Send drawing strokes
- `chat-message`: Send guess or message
- `disconnect`: Player left

### Server → Client

- `room-created`: Room initialized
- `player-joined`: Player joined room
- `player-ready`: Player marked ready
- `game-started`: Game begins
- `round-start`: New round begins
- `timer-update`: Drawing time countdown
- `draw`: Incoming drawing strokes
- `chat-message`: Incoming chat/guess
- `guess-correct`: Correct answer guessed
- `game-ended`: Game finished
- `player-left`: Player disconnected

## Deployment

### Frontend (Vercel)
```bash
npm run build --workspace=apps/web
# Deploy build/ folder to Vercel
```

### Backend (Railway/Render)
```bash
npm run build --workspace=server
# Deploy dist/ folder
```

## Performance

- **Latency Target**: <40ms
- **Max Strokes**: 200 per second
- **Compression**: perMessageDeflate enabled
- **Batching**: Strokes sent every 16-40ms

## Anti-Cheat

- Drawer cannot chat
- Guess cooldown: 1 guess per second
- Server-authoritative scoring

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

MIT
