/**
 * Monteeq Environment Configuration
 * Centralized access to Expo Public environment variables.
 */

export const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.monteeq.com';
export const EXPO_PUBLIC_WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.monteeq.com';

export const ENV = {
  API_URL: EXPO_PUBLIC_API_URL,
  WS_URL: EXPO_PUBLIC_WS_URL,
  IS_DEV: __DEV__,
} as const;
