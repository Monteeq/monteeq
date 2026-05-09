import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface Props {
  uri?: string;
  size?: number;
  accentRing?: boolean;
  goldRing?: boolean; // Legacy alias
  isVerified?: boolean;
}

export const MonteeqAvatar = ({ 
  uri, 
  size = 40, 
  accentRing,
  goldRing, 
  isVerified 
}: Props) => {
  const showRing = accentRing || goldRing;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[
        styles.container, 
        { width: size, height: size, borderRadius: size / 2 },
        showRing && styles.accentRing
      ]}>
        {uri ? (
          <Image 
            source={{ uri }} 
            style={{ width: '100%', height: '100%', borderRadius: size / 2 }} 
          />
        ) : (
          <View style={[styles.placeholder, { borderRadius: size / 2 }]}>
            <Ionicons name="person" size={size * 0.6} color={COLORS.TEXT_MUTED} />
          </View>
        )}
      </View>
      {isVerified && (
        <View style={[styles.badge, { 
          bottom: -2, 
          right: -2, 
          width: size * 0.4, 
          height: size * 0.4, 
          borderRadius: (size * 0.4) / 2 
        }]}>
          <Ionicons name="checkmark-circle" size={size * 0.38} color={COLORS.ACCENT} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.BG_ELEVATED,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  accentRing: {
    borderWidth: 2,
    borderColor: COLORS.ACCENT,
  },
  placeholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    backgroundColor: COLORS.BG_PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
