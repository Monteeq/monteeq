import { StyleSheet } from 'react-native';

/**
 * Monteeq Typography System
 * Primary: Outfit (Headings)
 * Secondary: Inter (Body)
 */

export const TYPOGRAPHY = StyleSheet.create({
  h1: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  h2: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    fontWeight: '700',
  },
  h3: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  mono: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 12,
  }
});
