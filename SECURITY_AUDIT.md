# Security Audit & Feature Roadmap

## 🔒 Security Audit Results

### ✅ FIXED — Previously HIGH Severity

These critical issues were discovered and **patched** during this audit session:

1. **Spectators could guess/score points** — `handleChatMessage` didn't block spectators. A spectator could bypass the client UI and emit `chat-message` directly to guess and earn points.
   - **Fix**: Added `player.isSpectator` check to the guard in `handleChatMessage`.

2. **Answer leaked to joining players** — `handleJoinRoom` returned the full room object (including `room.answer`) to the joining player in the callback.
   - **Fix**: Now returns `this.sanitizeRoom(updatedRoom)` which strips the answer.

3. **Answer leaked via player-ready broadcast** — `handleReady` broadcast the full room (including answer) to all players. During active play, all guessers received the answer.
   - **Fix**: Now broadcasts `this.sanitizeRoom(updatedRoom)`.

### ✅ STRONG PROTECTIONS (Already in place)

**Input Validation**
- ✅ **Username**: Type + length (1-20) + regex `[a-zA-Z0-9_ -]` only
- ✅ **Chat Messages**: Type + length (0-200 chars)
- ✅ **Draw Strokes**: Tool whitelist, bounds (0-1280 × 0-720), point limits (50 partial / 5000 full), size (1-100)
- ✅ **Room IDs**: Regex `[a-zA-Z0-9-]{1,36}` on draw events
- ✅ **Custom Words**: 1-16 chars, alphanumeric + spaces only
- ✅ **Game Config**: Theme allowlist, rounds 1-10, drawTime allowlist, maxPlayers 2-20

**Access Control**
- ✅ Host-only: start game, restart, end game, kick, settings, free draw
- ✅ Drawer-only: draw strokes, reroll, skip turn, clear canvas, undo
- ✅ Self-kick prevention
- ✅ Spectators blocked from guessing (FIXED)
- ✅ Already-guessed players blocked from re-guessing
- ✅ Drawer blocked from chatting

**Anti-Cheat**
- ✅ Server-authoritative scoring (client cannot manipulate points)
- ✅ Hint reveals are server-generated (client only receives, cannot modify)
- ✅ Streak tracking is server-side only
- ✅ Score synced after each correct guess

**Rate Limiting**
- ✅ Per-socket event rate limits on ALL socket events
- ✅ Per-room draw flood limit (120 draws/sec room-wide)
- ✅ Reroll: 1 per 20 seconds
- ✅ Per-IP connection limit (10 connections)
- ✅ Chat: 2 messages per 2 seconds

**XSS Protection**
- ✅ Zero `dangerouslySetInnerHTML`, `innerHTML`, or `eval()` usage
- ✅ All user content rendered via React JSX text interpolation (auto-escaped)

**No SSRF**
- ✅ Server makes zero outbound HTTP requests based on user input
- ✅ All data from local JSON files loaded at startup

### ⚠️ REMAINING ISSUES (Medium/Low Severity)

| # | Severity | Issue | Location | Recommendation |
|---|----------|-------|----------|----------------|
| 1 | MEDIUM | Missing `isValidRoomId` check on most events (join, chat, restart, kick, settings, etc.) — only draw has it | `index.ts` | Add format validation on all events accepting roomId |
| 2 | MEDIUM | `handleLeaveRoom` scans ALL rooms O(n) — DoS with many rooms | `gameManager.ts` | Add `socketToRoom: Map<string,string>` index for O(1) lookup |
| 3 | MEDIUM | Missing `data` null check on several events — throws unhandled if no args | `index.ts` | Add `if (!data) return` guard at top of each handler |
| 4 | MEDIUM | Canvas `canvasStrokes` can hold 2000 strokes × 5000 points each = ~10M points per room | `gameManager.ts` | Add total point budget per room, not just stroke count |
| 5 | LOW | No global room count limit — automated room creation DoS possible | `roomManager.ts` | Add server-wide room cap (e.g., 500) |
| 6 | LOW | `connectionsPerIp` map never cleaned for stale IPs (count=0 entries) | `index.ts` | Add periodic sweep or delete when count reaches 0 |
| 7 | LOW | `kick-player` targetId not format-validated | `index.ts` | Validate targetId is string ≤ 40 chars |
| 8 | LOW | Color field only validated as string ≤ 20 chars, not actual color format | `gameManager.ts` | Optionally validate with `/^#[0-9a-fA-F]{3,8}$/` |
| 9 | LOW | No server-side HTML sanitization of chat (React protects, but defense-in-depth) | `gameManager.ts` | Strip HTML entities server-side before broadcast |
| 10 | LOW | No content moderation / profanity filter | — | Add word filter + regex patterns |

---

## 🚀 Feature Roadmap

### Phase 1: Quick Wins (1-2 days)

#### 1. Achievements System
- **Gamification**: Unlock badges for milestones
- **Examples**:
  - "Speed Demon" - Guess in <5 seconds (5+ times)
  - "Mind Reader" - Guess before hints revealed (10+ times)
  - "Streak Master" - 5+ consecutive correct guesses
  - "Perfect Score" - Win a game with 100% participation
- **Implementation**: Add `achievements: string[]` to player.json, emit on condition met
- **Design**: Trophy/star icons, toast notification on unlock
- **Est. Time**: 4-6 hours

#### 2. Persistent Leaderboards
- **Scope**: Track top 100 players across all games
- **Metrics**: Total points, win rate, average streak, games played
- **UI**: Dedicated leaderboard page with filters (today/week/all-time)
- **Storage**: Move from in-memory to PostgreSQL
- **Est. Time**: 6-8 hours (includes DB schema + backend)

#### 3. Game Replays
- **Feature**: Watch past game drawing sequences
- **MVP**: Store compressed stroke arrays + metadata (answer, players, scores)
- **UI**: Replay board with playback speed control
- **Storage**: Same as leaderboards, store last 1000 replays
- **Est. Time**: 8-10 hours (video encoding optional, stroke playback simpler)

### Phase 2: Enhanced Gameplay (3-5 days)

#### 4. Game Modes
- **Classic**: Current mode (unlimited guesses)
- **Timed**: Must guess within 10s of turn start
- **Blitz**: 1 guess per player per round
- **Survival**: Lose life on wrong guess
- **Implementation**: New room config option, tweaked scoring
- **Est. Time**: 8-10 hours

#### 5. Difficulty Modifiers
- **Easy**: Larger hints (70% revealed by end)
- **Hard**: Smaller hints (20% revealed), faster decay
- **Custom**: Tune hint reveal %, point multiplier, time bonus/penalty
- **Est. Time**: 4-6 hours

#### 6. Custom Cosmetics
- **Player Skins**: Hats, glasses, effects around avatar
- **Canvas Themes**: Brushstroke effects, background patterns
- **Animated Effects**: Particle effects on correct guess
- **Monetization**: Cosmetics purchasable with in-game currency (optional)
- **Est. Time**: 12-16 hours

#### 7. Clan/Team System
- **Feature**: Create teams, track team stats, team-vs-team games
- **Storage**: Add `teams` table + `team_members` junction table
- **UI**: Team profile, member list, team leaderboard
- **Est. Time**: 10-12 hours

### Phase 3: Social & Moderation (2-3 days)

#### 8. Content Moderation Tools
- **Reports**: Players can report toxic drawings/messages
- **Moderation Dashboard**: Review flagged content, ban users
- **Mute List**: Block specific players
- **Storage**: Add `reports` + `muted_players` tables
- **Est. Time**: 8-10 hours

#### 9. User Authentication & Profiles
- **Auth**: OAuth2 (Google/GitHub) or JWT signup
- **Profile**: Stats, bio, profile pic, friend list
- **Friends**: Add friends, play together, see stats
- **Storage**: New `users` + `user_stats` + `friends` tables
- **Est. Time**: 12-14 hours (includes full auth flow)

#### 10. In-Game Chat Moderation
- **Profanity Filter**: Regex-based word replacement
- **Spam Detection**: Detect rapid-fire messages
- **Bot Protection**: CAPTCHA-style challenge on suspicious activity
- **Est. Time**: 4-6 hours

### Phase 4: Advanced (1 week+)

#### 11. AI Drawing Opponent
- **MVP**: Train CNN on player strokes to identify drawings
- **Challenge Mode**: Play solo vs. AI, see if it guesses faster
- **Difficulty**: Tune to player skill level
- **Est. Time**: 20+ hours (ML infrastructure)

#### 12. Drawing Analytics
- **Heatmaps**: Show where players draw on canvas
- **Shape Recognition**: Detect primitives (circle, line, square)
- **Difficulty Scoring**: Rate drawing ease for each answer
- **Est. Time**: 12-16 hours

#### 13. Tournament System
- **Bracket**: Single/double elimination, Swiss
- **Scoring**: Points-based overall ranking
- **Prizes**: In-game rewards, cosmetics, leaderboard badges
- **Est. Time**: 16-20 hours

#### 14. Mobile App
- **Framework**: React Native or Flutter
- **Parity**: Feature-complete with web version
- **Platform**: iOS + Android
- **Est. Time**: 40+ hours (separate from web)

---

## 🔐 Security Roadmap (Recommended)

### Immediate (This Sprint)
- [ ] Add socket.io rate limiting middleware (express-rate-limit or similar)
- [ ] Implement basic event logging to JSON file
- [ ] Add profanity filter to chat

### Short-term (Next 2 sprints)
- [ ] Set up PostgreSQL for persistence + audit logs
- [ ] Implement JWT session tokens (optional, for casual play)
- [ ] Add user feedback system for reports

### Medium-term (Month 2)
- [ ] Full user authentication (OAuth)
- [ ] Moderation dashboard
- [ ] Advanced analytics/monitoring

### Long-term (Month 3+)
- [ ] Kubernetes deployment for scaling
- [ ] DDoS protection (Cloudflare)
- [ ] SOC 2 compliance (if monetized)

---

## 📊 Suggested Implementation Order

1. **Achievements** (high impact, low complexity) → ⭐⭐⭐
2. **Security improvements** (socket throttling) → ⭐⭐⭐
3. **Game Replays** (satisfying feature) → ⭐⭐⭐
4. **Persistent Leaderboards** (with DB setup) → ⭐⭐
5. **Game Modes** (expands replayability) → ⭐⭐
6. **User Auth** (enables social features) → ⭐⭐⭐ (prerequisite for #7-9)
7. **In-Game Moderation** (safety feature) → ⭐⭐⭐
8. **Cosmetics** (monetization) → ⭐

---

## 🎯 Player Retention Metrics (Success Criteria)

- **DAU/MAU**: Track daily/monthly active users
- **Retention**: % of players returning after 1 day, 7 days
- **Session Length**: Average game duration
- **Churn Rate**: % of players who quit after first game
- **Engagement**: Average guesses/game, chat frequency, reroll usage

---

## 💡 Quick Feature Ideas (1-2 hour implementations)

- **Emoji Reactions**: Quick 👍👎 voting on drawings (already exists!)
- **Drawing Hints**: Show "circle", "square" suggestions while drawing
- **Sound Toggle**: Per-event sound control (already have)
- **Darkmode**: Already implemented via theme system
- **Colorblind Mode**: Alternative hint rendering (underscore + symbol)
- **Accessibility**: Screen reader support for leaderboard
- **Benchmark Tool**: Compare drawing recognition speeds across browsers
- **Hotkey Hints**: F1 overlay showing all keyboard shortcuts

---

## 🚨 Known Bugs to Fix

- [ ] Timer sometimes shows negative values (race condition at round end)
- [ ] Chat scroll not always at bottom on mobile
- [ ] Canvas touch input on iPad feels sluggish
- [ ] Spectator mode doesn't sync drawing history on join
- [ ] Reroll button text sizing inconsistent on mobile
- [ ] Hint updates sometimes arrive out-of-order on 4G

---

## 📝 Testing Recommendations

### Security Tests
```bash
# 1. Rate Limit Testing
# Send 100 draw events/second, verify rate limit kicks in

# 2. Input Fuzzing
# Send malformed strokes, invalid usernames, oversized chat

# 3. Access Control
# Verify drawer can't chat, already-guessed can't guess

# 4. Scoring Audit
# Manually calculate points for various times, verify server matches
```

### Load Testing
```bash
# 1. 100 concurrent players in single room
# 2. 1000 rooms with 2 players each
# 3. Stress test with 10k stroke events/second
# Use Artillery or k6 for load testing
```

### UI/UX Tests
- [ ] Mobile (iPhone SE, iPad Pro, Android)
- [ ] Different network speeds (3G, 4G, 5G, cable)
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Accessibility (WCAG 2.1 AA)

---

## 📞 Support & Monitoring

### Recommended Tools
- **Logging**: Winston or Bunyan (structured logging)
- **Error Tracking**: Sentry (production error tracking)
- **Performance**: New Relic or DataDog APM
- **Monitoring**: Uptime Robot + Prometheus metrics
- **Chat Moderation**: WebHooks to Discord for admin alerts

---

**Document Version**: 2.0  
**Last Updated**: December 2024  
**Status**: Living document - update as features ship
