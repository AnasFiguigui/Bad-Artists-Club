// Theme-specific configuration: colors, display names, reference image aspect ratios

export interface ThemeColors {
  primary: string       // Main accent color
  primaryLight: string  // Lighter variant
  primaryDark: string   // Darker variant
  secondary: string     // Secondary accent
  bg: string           // Background tint (with alpha)
  border: string       // Border color (with alpha)
  text: string         // Primary text color
  textMuted: string    // Muted text
  gradient: string     // CSS gradient for buttons/accents
}

export interface ThemeConfig {
  name: string
  emoji: string
  colors: ThemeColors
  referenceAspectRatio: string  // CSS aspect-ratio value e.g. '9/16', '1/1'
}

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
  lol: {
    name: 'League of Legends',
    emoji: '⚔️',
    colors: {
      primary: '#c89b3c',       // LoL gold
      primaryLight: '#f0e6d2',
      primaryDark: '#785a28',
      secondary: '#0397ab',     // LoL teal
      bg: 'rgba(200, 155, 60, 0.08)',
      border: 'rgba(200, 155, 60, 0.3)',
      text: '#f0e6d2',
      textMuted: '#a09b8c',
      gradient: 'linear-gradient(135deg, rgba(200, 155, 60, 0.4), rgba(120, 90, 40, 0.4))',
    },
    referenceAspectRatio: '9/16',
  },
  'elden-ring': {
    name: 'Elden Ring',
    emoji: '🗡️',
    colors: {
      primary: '#d4a843',       // Elden Ring amber/gold
      primaryLight: '#f5deb3',
      primaryDark: '#8b6914',
      secondary: '#4a6741',     // Dark green/swamp
      bg: 'rgba(212, 168, 67, 0.08)',
      border: 'rgba(212, 168, 67, 0.3)',
      text: '#f5deb3',
      textMuted: '#a89a78',
      gradient: 'linear-gradient(135deg, rgba(212, 168, 67, 0.4), rgba(139, 105, 20, 0.4))',
    },
    referenceAspectRatio: '1/1',
  },
  dbd: {
    name: 'Dead by Daylight',
    emoji: '🔪',
    colors: {
      primary: '#c41e1e',       // Blood red
      primaryLight: '#ff6b6b',
      primaryDark: '#8b0000',
      secondary: '#ff4444',
      bg: 'rgba(196, 30, 30, 0.08)',
      border: 'rgba(196, 30, 30, 0.3)',
      text: '#ffcccc',
      textMuted: '#cc9999',
      gradient: 'linear-gradient(135deg, rgba(196, 30, 30, 0.4), rgba(139, 0, 0, 0.4))',
    },
    referenceAspectRatio: '1/1',
  },
  'game-titles': {
    name: 'Game Titles',
    emoji: '🎮',
    colors: {
      primary: '#7c3aed',       // Purple/gaming
      primaryLight: '#a78bfa',
      primaryDark: '#5b21b6',
      secondary: '#06b6d4',     // Cyan accent
      bg: 'rgba(124, 58, 237, 0.08)',
      border: 'rgba(124, 58, 237, 0.3)',
      text: '#e0d4ff',
      textMuted: '#a78bfa',
      gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.4), rgba(91, 33, 182, 0.4))',
    },
    referenceAspectRatio: '16/9',
  },
}

export function getThemeConfig(theme: string): ThemeConfig {
  return THEME_CONFIGS[theme] || THEME_CONFIGS['lol']
}
