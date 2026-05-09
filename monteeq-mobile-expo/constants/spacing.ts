/**
 * Monteeq Spacing & Radius System
 * Based on 8pt grid
 */

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
} as const;

export const RADIUS = {
  sm: 8,
  md: 14, // Verified from index.css
  lg: 20, // Verified from index.css
  xl: 24, // Verified from index.css
  pill: 999,
} as const;

export const LAYOUT = {
  HEADER_HEIGHT: 72,
  HEADER_HEIGHT_MOBILE: 64,
  TAB_BAR_HEIGHT: 64,
} as const;
