import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';

export const SkeletonCard = () => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.thumbnail, { opacity }]} />
      <View style={styles.infoRow}>
        <Animated.View style={[styles.avatar, { opacity }]} />
        <View style={styles.textContainer}>
          <Animated.View style={[styles.titleLine, { opacity }]} />
          <Animated.View style={[styles.metaLine, { opacity }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.BG_ELEVATED,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.BG_ELEVATED,
  },
  textContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
    gap: 8,
  },
  titleLine: {
    width: '80%',
    height: 16,
    borderRadius: 4,
    backgroundColor: COLORS.BG_ELEVATED,
  },
  metaLine: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: COLORS.BG_ELEVATED,
  },
});
