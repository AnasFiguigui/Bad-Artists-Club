// Placeholder sound effects using Web Audio API oscillators
// Replace with actual audio files later

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.value = volume
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Silently fail if audio context not available
  }
}

export function playCorrectGuess() {
  playTone(880, 0.15, 'sine', 0.12)
  setTimeout(() => playTone(1100, 0.2, 'sine', 0.1), 100)
}

export function playPlayerJoined() {
  playTone(622, 0.1, 'sine', 0.08)
  setTimeout(() => playTone(784, 0.15, 'sine', 0.1), 100)
}

export function playTimerTick() {
  playTone(600, 0.05, 'square', 0.06)
}

export function playRoundStart() {
  playTone(523, 0.12, 'triangle', 0.1)
  setTimeout(() => playTone(659, 0.12, 'triangle', 0.1), 120)
  setTimeout(() => playTone(784, 0.2, 'triangle', 0.12), 240)
}

export function playGameEnd() {
  playTone(523, 0.15, 'triangle', 0.1)
  setTimeout(() => playTone(659, 0.15, 'triangle', 0.1), 150)
  setTimeout(() => playTone(784, 0.15, 'triangle', 0.1), 300)
  setTimeout(() => playTone(1047, 0.3, 'triangle', 0.12), 450)
}

export function playVote() {
  playTone(440, 0.08, 'sine', 0.06)
}

export function playSpeedBonus() {
  playTone(1200, 0.1, 'sine', 0.08)
  setTimeout(() => playTone(1500, 0.15, 'sine', 0.1), 80)
}

export function playStreakSound(streak: number) {
  const baseFreq = 600 + streak * 100
  playTone(baseFreq, 0.1, 'sawtooth', 0.06)
  setTimeout(() => playTone(baseFreq + 200, 0.15, 'sawtooth', 0.08), 80)
}
