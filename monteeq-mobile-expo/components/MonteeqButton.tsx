import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle 
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const MonteeqButton = ({ 
  label, 
  onPress, 
  variant = 'filled', 
  size = 'md',
  isLoading,
  disabled,
  style 
}: Props) => {
  const isFilled = variant === 'filled';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const containerStyle = [
    styles.base,
    isFilled && styles.filled,
    isGhost && styles.ghost,
    isDanger && styles.danger,
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    (disabled || isLoading) && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    isFilled && styles.textFilled,
    isGhost && styles.textGhost,
    isDanger && styles.textDanger,
    size === 'sm' && styles.textSm,
  ];

  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      style={containerStyle}
    >
      {isLoading ? (
        <ActivityIndicator color={isFilled ? COLORS.BG_PRIMARY : COLORS.GOLD} />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
  },
  filled: {
    backgroundColor: COLORS.GOLD,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.BORDER_GOLD,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.ERROR,
  },
  sm: { height: 36, paddingHorizontal: SPACING.md },
  md: { height: 52 },
  lg: { height: 60 },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...TYPOGRAPHY.h3,
  },
  textFilled: {
    color: COLORS.BG_PRIMARY,
  },
  textGhost: {
    color: COLORS.GOLD,
  },
  textDanger: {
    color: COLORS.ERROR,
  },
  textSm: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
  },
});
