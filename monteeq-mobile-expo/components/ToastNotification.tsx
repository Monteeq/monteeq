import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withDelay,
  runOnJS
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS, SHADOWS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

export const ToastNotification = ({ message, type = 'info', onDismiss }: Props) => {
  const translateY = useSharedValue(-100);

  useEffect(() => {
    translateY.value = withSpring(50);
    
    const timer = setTimeout(() => {
      translateY.value = withTiming(-100, {}, (finished) => {
        if (finished) {
          runOnJS(onDismiss)();
        }
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const iconName = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';
  const iconColor = type === 'success' ? COLORS.SUCCESS : type === 'error' ? COLORS.ERROR : COLORS.GOLD;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <Ionicons name={iconName} size={24} color={iconColor} />
        <Text style={styles.message}>{message}</Text>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    ...SHADOWS.dark,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(24, 24, 36, 0.8)',
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
    gap: SPACING.sm,
  },
  message: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '600',
    flex: 1,
  },
});
