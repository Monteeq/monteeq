import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Pressable 
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/spacing';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 320;

interface AuthPromptSheetProps {
  isVisible: boolean;
  onClose: () => void;
  message?: string;
}

export function AuthPromptSheet({ isVisible, onClose, message }: AuthPromptSheetProps) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);
  const router = useRouter();

  useEffect(() => {
    if (isVisible) {
      translateY.value = withSpring(SCREEN_HEIGHT - SHEET_HEIGHT, { damping: 15 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [isVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleLogin = () => {
    onClose();
    router.push('/auth');
  };

  if (!isVisible && opacity.value === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? 'auto' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.sheet, animatedStyle]}>
        <View style={styles.handle} />
        
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={32} color={COLORS.ACCENT} />
          </View>
          
          <Text style={styles.title}>Sign in to Monteeq</Text>
          <Text style={styles.message}>
            {message || "Join our community to like videos, follow your favorite creators, and join the conversation."}
          </Text>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Sign In / Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.BG_SURFACE,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.BORDER_GLASS,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.BORDER_GLASS,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  message: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  loginButton: {
    width: '100%',
    backgroundColor: COLORS.ACCENT,
    height: 52,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: COLORS.WHITE,
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
});
