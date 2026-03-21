# Bad Artists Club - Multiplayer Drawing Guessing Game

A polished, real-time multiplayer web game where players take turns drawing while others guess. Built with **Next.js 14**, **Node.js**, **Socket.IO**, and **TailwindCSS**. Features smooth animations, sound effects, spectator mode, and server-authoritative game logic.

## ✨ Features

### Core Gameplay
- 🎨 **Real-time multiplayer drawing** with vector-based stroke synchronization
- 🎮 **Three curated theme packs**: 150 League of Legends champions, 30 Elden Ring bosses, 30 Dead by Daylight killers
- 🎯 **Custom word mode**: Drawer can choose their own word if available
- 📊 **Balanced scoring**: 500 base, -1pt/sec time decay, -40pts per revealed hint letter (50 minimum)
- 🎭 **Spectator mode**: Watch matches without affecting gameplay
- 🔄 **Reroll cooldown**: One reroll per 20 seconds (drawer only)

### Rich UI/UX
- 🎯 **Dynamic hint reveals**: Initially masked with underscores, progressively reveal random letters after 30s (max 50% of word)
- 🎬 **Winner celebration**: Podium display with medals and streaks
- 🎨 **Color picker with favorites**: Save and load custom brush colors
- 🔥 **Streak system**: Track consecutive correct guesses with flame icons
- 💬 **Floating vote emoji reactions**: Live feedback (👍 👎) with animated floats
- ⚡ **Speed bonus notifications**: "FAST!" text appears for high-speed guesses (400+pts)
- 📹 **Round recap overlay**: 3-second pause between rounds showing correct answer, top guesser, votes
- 📱 **Mobile-optimized**: Tab-based navigation for canvas, players, chat on small screens
- 🎵 **Sound effects**: Join chimes, correct guess beeps, timer ticks, streak celebrations, game end fanfare
- ⌨️ **Keyboard shortcuts**: B=Brush, F=Fill, E=Eraser, Delete=Clear, Ctrl+Z=Undo, Esc=Close modals
- ✏️ **Canvas tools**: Brush, Eraser, Fill, Line, Oval, Rectangle, Rounded Rectangle, Triangle, Callout
- 🎨 **Dynamic theming**: Spectator button, leaderboard, accent colors adapt to selected theme

### Game Mechanics
- ⏱️ **Configurable draw time**: 60-240 seconds (default 180)
- 👥 **Configurable rounds**: Set total rounds for multiplayer games
- 🚫 **Anti-cheat**: Drawer cannot chat, guess cooldown (1 guess/sec), server-authoritative scoring
- 🎮 **Free draw mode**: After game ends, players can draw without guessing
- 👑 **Host controls**: Kick players, restart, customize settings
- 🔗 **Room management**: Automatic host transfer when host leaves, cleanup on last player exit

### Performance & Polish
- ⚡ **Optimized rendering**: Canvas strokes batched ~40ms, vector-based (no image streaming)
- 🎨 **Smooth animations**: CSS keyframes for confetti, floats, text effects, wiggle animations
- 🔊 **Mute toggle**: Remembers preference
- 📡 **Real-time sync**: <100ms typical latency, perMessageDeflate compression

## 🎮 Game Flow

1. **Landing Page**: Enter username
2. **Room Selection**: Create new room or join via code
3. **Lobby**: Host configures theme, rounds, draw time, max players
4. **Game Loop**:
   - Turn starts: One drawer chosen, others guess
   - Drawing timer: Canvas visible, hints progressively reveal
   - Guessing: Non-drawers chat to guess (1 sec cooldown)
   - Recap: 3-second overlay shows answer, top guesser, vote counts
   - Next turn: Host/drawer changes round-robin
5. **Results**: Final leaderboard with scores, streaks, celebration

## 🏆 Scoring System

- **Guesser**: `max(500 - secondsElapsed - (revealedLetters × 40), 50)`
  - At 5s (0 hints): ~495 pts (speed bonus!)
  - At 30s (0 hints): ~470 pts (guessed before any reveals)
  - At 45s (1 hint): ~415 pts (one letter revealed, -40)
  - At 60s (2 hints): ~360 pts
  - At 90s (3 hints): ~290 pts
  - At 150s (5 hints): ~150 pts
  - Floor: 50 pts
- **Drawer**: 70% of guesser's points
- **Key design**: Guessing before hints start (first 30s) is highly rewarded. Each revealed letter costs 40 points, creating pressure to guess early.
- **Streaks**: Consecutive correct guesses unlock flame icon and special sound

## 📦 Tech Stack

### Frontend
- **Next.js 14** (App Router, static optimization)
- **React 18** (Hooks, error boundaries)
- **TypeScript** (Type-safe components)
- **TailwindCSS** (Utility-first CSS)
- **Zustand** (Lightweight state management)
- **Socket.IO Client** (Real-time communication)
- **Web Audio API** (Sound effects)

### Backend
- **Node.js** with **TypeScript**
- **Express.js** (HTTP server)
- **Socket.IO** (WebSocket communication)
- **In-memory storage** (Ready for DB integration)

### Data
- **150 League of Legends champions** (animated splash art reference)
- **30 Elden Ring bosses** (official imagery)
- **30 Dead by Daylight killers** (game-accurate)

## 📁 Project Structure

```
Bad-Artists-Club/
├── apps/
│   └── web/                    # Next.js 14 frontend
│       ├── app/                # Route pages
│       │   ├── page.tsx        # Lobby (home)
│       │   ├── game/           # Game canvas page
│       │   ├── room/           # Room selection
│       │   └── results/        # Leaderboard
│       ├── components/         # Reusable UI
│       │   ├── Canvas.tsx      # Drawing canvas
│       │   ├── GameNavbar.tsx  # Header + timer
│       │   ├── Chat.tsx        # Message feed
│       │   ├── BrushControls.tsx
│       │   ├── PlayerLeaderboard.tsx
│       │   └── [other features]
│       ├── lib/
│       │   ├── socket.ts       # Socket.IO setup
│       │   ├── store.ts        # Zustand store
│       │   ├── sounds.ts       # Audio engine
│       │   └── types.ts        # Frontend types
│       └── public/
├── server/
│   └── src/
│       ├── index.ts            # Express server
│       └── socket/
│           ├── gameManager.ts  # Core game logic (1000+ lines)
│           ├── roomManager.ts  # Room/player state
│           └── __tests__/      # Unit tests
├── shared/
│   └── types.ts                # Shared interfaces
├── data/
│   ├── lolChampions.json
│   ├── eldenRingBosses.json
│   └── dbdKillers.json
└── [documentation files]

```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repo-url>
cd Bad-Artists-Club

# Install all dependencies
npm install

# Start both frontend and backend
npm run dev
```

**Frontend**: http://localhost:3000  
**Backend**: http://localhost:3001

Or run separately:
```bash
# Frontend only (requires backend running)
npm run dev --workspace=apps/web

# Backend only
npm run dev --workspace=server
```

### Environment Variables

**Backend (`server/.env`)**:
```
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**Frontend (`apps/web/.env.local`)**:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🎮 How to Play

1. **Enter username** on landing page
2. **Create or join room**:
   - New game: Click "Create Room", share code with friends
   - Join game: Enter 4-character code
3. **Configure game** (host only):
   - Select theme (LoL, Elden Ring, DBD, or Custom)
   - Set rounds (1-10)
   - Set draw time (60-240 sec)
   - Set player limit
4. **Start game** → Players take turns drawing
   - Drawer: Use brush tools, no guessing
   - Guessers: Type guesses in chat
   - Spectators: Watch without affecting game
5. **Win**: First correct guess gets full points; drawer gets 70%
6. **Repeat** until all rounds complete

## 🛠️ Canvas Tools

- **Brush** (B): Freehand drawing
- **Eraser** (E): Remove strokes
- **Fill** (F): Bucket fill
- **Line**: Straight/diagonal strokes
- **Oval**: Perfect circles/ovals
- **Rectangle**: Perfect squares/rectangles
- **Rounded Rectangle**: Radius-controlled shapes
- **Triangle**: Equilateral triangles
- **Callout**: Text bubbles with pointers

## 🔒 Security & Anti-Cheat

- ✅ **Server-authoritative**: All game logic runs on server, client cannot manipulate scores
- ✅ **Drawer cannot chat**: Prevents accidental spoilers
- ✅ **Guess cooldown**: 1 guess per player per second (prevents spam)
- ✅ **Room isolation**: Players only see their own room data
- ✅ **Input validation**: Stroke validation, rate limiting
- ⚠️ **TODO**: Rate limiting on socket events, XSS protection in chat

## 📡 Socket.IO Events

### Client → Server

| Event | Payload | Purpose |
|-------|---------|---------|
| `join-room` | `{ roomId, username }` | Join game room |
| `leave-room` | `{ roomId }` | Exit game |
| `start-game` | `{ roomId }` | Begin game (host) |
| `restart-game` | `{ roomId }` | New game (host) |
| `draw` | `{ stroke }` | Send drawing stroke |
| `undo` | `{ roomId }` | Undo last stroke |
| `clear-canvas` | `{ roomId }` | Clear canvas |
| `chat-message` | `{ roomId, message }` | Send guess/message |
| `reroll` | `{ roomId }` | Get new word (20s cooldown) |
| `toggle-spectator` | `{ roomId }` | Join/leave spectate mode |
| `vote` | `{ roomId, voteType }` | Like/dislike drawing (👍/👎) |
| `kick-player` | `{ roomId, playerId }` | Remove player (host) |
| `update-settings` | `{ roomId, settings }` | Change game config (host) |

### Server → Client

| Event | Payload | Purpose |
|-------|---------|---------|
| `round-start` | `{ room, drawer }` | New round begins |
| `hint-update` | `{ hint }` | Progressive hint reveal (every 5s after 30s) |
| `timer-update` | `{ timeRemaining }` | Countdown tick |
| `draw` | `{ stroke }` | Remote player drew |
| `guess-correct` | `{ room, points, streak }` | Correct answer! |
| `game-ended` | `{ room }` | Game over, show leaderboard |
| `round-ended` | `{ answer, scores, topGuesser }` | Round complete, show recap |
| `player-joined` | `{ room }` | Someone joined |
| `spectator-update` | `{ room }` | Spectator status changed |

## 🎨 Customization

### Add New Theme
1. Create 30 items in JSON format:
```json
[
  { "name": "MyCharacter", "altNames": ["Alt Name 1", "Alt Name 2"] },
  ...
]
```
2. Add to `/data/myTheme.json`
3. Update `themeConfig` in `apps/web/lib/themeConfig.ts`

### Adjust Scoring
Edit formula in `server/src/socket/gameManager.ts` (handleCorrectGuess method):
```typescript
const points = Math.max(500 - elapsedSeconds - (revealedCount * 40), 50)
```

### Change Colors/Theme
Edit TailwindCSS config or `apps/web/tailwind.config.ts`

## 📱 Responsive Design

- **Desktop**: Full canvas + side panels
- **Tablet**: 2-column layout
- **Mobile**: Tab-based nav (canvas | players | chat)

## 🐛 Known Limitations

- In-memory storage (data lost on server restart)
- No user authentication
- Single server instance
- No persistent statistics/database
- TODO: Achievements system
- TODO: Game replays
- TODO: Custom skins/cosmetics

## 🚀 Production Deployment

### Frontend (Vercel)
```bash
npm run build --workspace=apps/web
# Push to GitHub, auto-deploy via Vercel
```
Set `NEXT_PUBLIC_API_URL` environment variable to backend URL.

### Backend (Railway/Render)
```bash
npm run build --workspace=server
npm start --workspace=server
```
Set `PORT`, `FRONTEND_URL`, `NODE_ENV` variables.

### Recommended Scaling
1. Add Redis for session persistence
2. Add PostgreSQL for statistics
3. Use load balancer (multiple server instances)
4. Enable strict rate limiting
5. Add user authentication (OAuth/JWT)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Credits

- Drawing game mechanics inspired by Skribbl.io
- Character data from official game sources
- Built with passion for multiplayer gaming

## 📚 Documentation

See additional docs:
- [Socket.IO Event Flow](./SOCKET_IO_API.md) - Detailed event sequences
- [Socket Flow Test](./SOCKET_FLOW_TEST.md) - Testing procedures
- [Drawing Specifications](./DRAWING_SPECIFICATIONS.md) - Canvas details
- [Development Guide](./DEVELOPMENT.md) - Local setup & debugging
- [Deployment Guide](./DEPLOYMENT.md) - Production setup
- [Recent Updates](./RECENT_UPDATES.md) - Changelog

---

**Last Updated**: December 2024  
**Version**: 2.0+  
**Status**: Production-ready for small servers, scaling in progress
