import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  Animated 
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
}

export const MonteeqInput = ({ 
  label, 
  value, 
  onChangeText, 
  secureTextEntry, 
  placeholder,
  error,
  multiline
}: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedValue = new Animated.Value(value || isFocused ? 1 : 0);

  const onFocus = () => {
    setIsFocused(true);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const onBlur = () => {
    setIsFocused(false);
    if (!value) {
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const labelStyle = {
    position: 'absolute' as const,
    left: 0,
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [18, -10],
    }),
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [COLORS.TEXT_MUTED, COLORS.GOLD],
    }),
  };

  return (
    <View style={styles.container}>
      <Animated.Text style={labelStyle}>{label}</Animated.Text>
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          multiline && styles.multiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        secureTextEntry={secureTextEntry}
        placeholder={isFocused ? placeholder : ''}
        placeholderTextColor={COLORS.TEXT_MUTED}
        selectionColor={COLORS.GOLD}
        multiline={multiline}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  input: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT_PRIMARY,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.TEXT_MUTED,
    paddingVertical: SPACING.sm,
    height: 48,
  },
  inputFocused: {
    borderBottomColor: COLORS.GOLD,
  },
  inputError: {
    borderBottomColor: COLORS.ERROR,
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.ERROR,
    marginTop: SPACING.tiny,
  },
});
