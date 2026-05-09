/**
 * Monteeq Design System - Verified from Production CSS
 * Theme: Gilded Obsidian with Cinematic Red Accent
 */

export const COLORS = {
  // --- Backgrounds
  BG_PRIMARY:      '#000000', // Deep Obsidian
  BG_SURFACE:      '#0a0a0a', // Surface Deep
  BG_ELEVATED:     '#111111', // Raised Surface
  BG_INPUT:        '#0a0a0a', // Input Field BG
  BG_GLASS:        'rgba(0, 0, 0, 0.75)',

  // --- Brand Accents
  ACCENT:          '#FF3B30', // Cinematic Monteeq Red
  ACCENT_GLOW:     'rgba(255, 62, 62, 0.4)',
  ACCENT_ACTIVE:   '#D0021B', // Pressed State
  
  // Backwards compatibility/Fallback (if needed during migration)
  GOLD:            '#FF3B30', 
  NEON:            '#00E5FF', // Cypher Blue secondary accent
  NEON_DIM:        'rgba(0, 229, 255, 0.1)',

  // --- Text
  TEXT_PRIMARY:    '#ffffff',
  TEXT_SECONDARY:  '#f2f2f7',
  TEXT_MUTED:      '#8e8e93',

  // --- Borders
  BORDER_GLASS:    'rgba(255, 255, 255, 0.1)',
  BORDER_SUBTLE:   'rgba(255, 255, 255, 0.05)',
  BORDER_ACCENT:   'rgba(255, 62, 62, 0.2)',

  // --- Semantic
  SUCCESS:         '#22C55E',
  ERROR:           '#FF3B30',
  WARNING:         '#FFCC00',
  PROCESSING:      '#00E5FF', // Pulsing blue for processing

  // --- Utility
  WHITE:           '#ffffff',
  BLACK:           '#000000',
  TRANSPARENT:     'transparent',
} as const;
