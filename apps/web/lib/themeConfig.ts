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
  description: string
  colors: ThemeColors
  referenceAspectRatio: string  // CSS aspect-ratio value e.g. '9/16', '1/1'
  thumbnail: string             // Path to thumbnail image in /public/images/thumbnail/
}

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
  lol: {
    name: 'League of Legends',
    description: 'Draw champions from Runeterra — from Ahri to Zed, test your knowledge of the Rift.',
    colors: {
      primary: '#248596',
      primaryLight: '#4fc3d6',
      primaryDark: '#1a6270',
      secondary: '#0397ab',
      bg: 'rgba(36, 133, 150, 0.08)',
      border: 'rgba(36, 133, 150, 0.3)',
      text: '#d0f0f5',
      textMuted: '#7bb8c2',
      gradient: 'linear-gradient(135deg, rgba(36, 133, 150, 0.4), rgba(26, 98, 112, 0.4))',
    },
    referenceAspectRatio: '9/16',
    thumbnail: '/images/thumbnail/lol.webp',
  },
  'elden-ring': {
    name: 'Elden Ring',
    description: 'Sketch the demigods and beasts of the Lands Between. Prepare to draw... and die.',
    colors: {
      primary: '#d4a843',
      primaryLight: '#f5deb3',
      primaryDark: '#8b6914',
      secondary: '#4a6741',
      bg: 'rgba(212, 168, 67, 0.08)',
      border: 'rgba(212, 168, 67, 0.3)',
      text: '#f5deb3',
      textMuted: '#a89a78',
      gradient: 'linear-gradient(135deg, rgba(212, 168, 67, 0.4), rgba(139, 105, 20, 0.4))',
    },
    referenceAspectRatio: '1/1',
    thumbnail: '/images/thumbnail/elden-ring.webp',
  },
  dbd: {
    name: 'Dead by Daylight',
    description: 'Illustrate the killers that haunt the fog. Can your friends guess before the Entity takes them?',
    colors: {
      primary: '#c41e1e',
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
    thumbnail: '/images/thumbnail/dbd.webp',
  },
  'game-titles': {
    name: 'Game Titles',
    description: 'From Minecraft to Elden Ring — draw iconic video games and see who recognizes them first.',
    colors: {
      primary: '#7c3aed',
      primaryLight: '#a78bfa',
      primaryDark: '#5b21b6',
      secondary: '#06b6d4',
      bg: 'rgba(124, 58, 237, 0.08)',
      border: 'rgba(124, 58, 237, 0.3)',
      text: '#e0d4ff',
      textMuted: '#a78bfa',
      gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.4), rgba(91, 33, 182, 0.4))',
    },
    referenceAspectRatio: '2/3',
    thumbnail: '/images/thumbnail/games.webp',
  },
  anime: {
    name: 'Anime',
    description: 'Black ink, white pages — draw your favorite anime characters manga-style.',
    colors: {
      primary: '#666666',
      primaryLight: '#e0e0e0',
      primaryDark: '#cccccc',
      secondary: '#aaaaaa',
      bg: 'rgba(255, 255, 255, 0.04)',
      border: 'rgba(255, 255, 255, 0.5)',
      text: '#f0f0f0',
      textMuted: '#aaaaaa',
      gradient: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(200, 200, 200, 0.1))',
    },
    referenceAspectRatio: '9/16',
    thumbnail: '/images/thumbnail/anime.webp',
  },
  custom: {
    name: 'Custom',
    description: 'Make up your own words — anything goes. Perfect for inside jokes and creative chaos.',
    colors: {
      primary: '#10b981',
      primaryLight: '#6ee7b7',
      primaryDark: '#047857',
      secondary: '#f59e0b',
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.3)',
      text: '#d1fae5',
      textMuted: '#6ee7b7',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(4, 120, 87, 0.4))',
    },
    referenceAspectRatio: 'none',
    thumbnail: '/images/thumbnail/custom.webp',
  },
  crossverse: {
    name: 'Crossverse',
    description: 'A chaotic mix from every universe — champions, killers, bosses, and more collide.',
    colors: {
      primary: '#f97316',
      primaryLight: '#fdba74',
      primaryDark: '#c2410c',
      secondary: '#8b5cf6',
      bg: 'rgba(249, 115, 22, 0.08)',
      border: 'rgba(249, 115, 22, 0.3)',
      text: '#fff7ed',
      textMuted: '#fdba74',
      gradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.4), rgba(194, 65, 12, 0.4))',
    },
    referenceAspectRatio: '1/1',
    thumbnail: '/images/thumbnail/crossverse.webp',
  },
}

export function getThemeConfig(theme: string): ThemeConfig {
  return THEME_CONFIGS[theme] || THEME_CONFIGS['lol']
}
