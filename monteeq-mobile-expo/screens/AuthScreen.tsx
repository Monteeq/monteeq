import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  TextInput,
  Image,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming
} from 'react-native-reanimated';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqButton } from '@/components/MonteeqButton';
import { useAuthStore } from '@/store/authStore';

const { width } = Dimensions.get('window');

export const AuthScreen = () => {
  const router = useRouter();
  const { setAuthenticated, setUser } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isFocused, setIsFocused] = useState<'email' | 'password' | null>(null);

  const handleAuth = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Real auth logic would hit /api/v1/auth/token or /register
    setAuthenticated(true);
  };

  const GoogleButton = () => (
    <TouchableOpacity style={styles.googleBtn} activeOpacity={0.8}>
      <Ionicons name="logo-google" size={20} color={COLORS.WHITE} />
      <Text style={styles.googleBtnText}>CONTINUE WITH GOOGLE</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.header}>
          <Text style={styles.wordmark}>Monteeq</Text>
          <Text style={styles.tagline}>THE CINEMATIC REVOLUTION</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.form}>
          <View style={styles.inputWrapper}>
            <Text style={[styles.label, isFocused === 'email' && styles.labelActive]}>EMAIL</Text>
            <TextInput
              style={[styles.input, isFocused === 'email' && styles.inputActive]}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setIsFocused('email')}
              onBlur={() => setIsFocused(null)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={[styles.label, isFocused === 'password' && styles.labelActive]}>PASSWORD</Text>
            <TextInput
              style={[styles.input, isFocused === 'password' && styles.inputActive]}
              placeholder="••••••••"
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setIsFocused('password')}
              onBlur={() => setIsFocused(null)}
              secureTextEntry
            />
          </View>

          <MonteeqButton 
            label={mode === 'login' ? 'LOGIN' : 'SIGN UP'}
            onPress={handleAuth}
            style={styles.authBtn}
          />

          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.line} />
          </View>

          <GoogleButton />

          <TouchableOpacity 
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={styles.switchBtn}
          >
            <Text style={styles.switchText}>
              {mode === 'login' ? "DON'T HAVE AN ACCOUNT? " : "ALREADY HAVE AN ACCOUNT? "}
              <Text style={styles.switchHighlight}>
                {mode === 'login' ? 'SIGN UP' : 'LOGIN'}
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  wordmark: {
    fontSize: 44,
    fontFamily: 'Outfit_800ExtraBold',
    color: COLORS.ACCENT,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 4,
    marginTop: 8,
  },
  form: {
    gap: 24,
  },
  inputWrapper: {
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 1.5,
  },
  labelActive: {
    color: COLORS.ACCENT,
  },
  input: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_SUBTLE,
    color: COLORS.WHITE,
    fontSize: 15,
    paddingVertical: 8,
  },
  inputActive: {
    borderBottomColor: COLORS.ACCENT,
  },
  authBtn: {
    marginTop: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.BORDER_SUBTLE,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 2,
  },
  googleBtn: {
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.BG_SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  googleBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.WHITE,
    letterSpacing: 1,
  },
  switchBtn: {
    alignItems: 'center',
    marginTop: 12,
  },
  switchText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 0.5,
  },
  switchHighlight: {
    color: COLORS.ACCENT,
    fontWeight: '900',
  },
});
