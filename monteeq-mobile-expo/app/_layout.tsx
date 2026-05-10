import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { 
  useFonts, 
  Inter_400Regular, 
  Inter_500Medium, 
  Inter_600SemiBold, 
  Inter_700Bold 
} from '@expo-google-fonts/inter';
import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold
} from '@expo-google-fonts/outfit';
import {
  JetBrainsMono_500Medium
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants/colors';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    JetBrainsMono_500Medium,
  });

  const { isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.BG_PRIMARY },
            animation: 'fade',
          }}
        >
          {/* Main Public Routes (Tabs) */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Stack Screens */}
          <Stack.Screen 
            name="watch" 
            options={{ 
              presentation: 'card',
              animation: 'slide_from_right'
            }} 
          />
          <Stack.Screen 
            name="auth" 
            options={{ 
              presentation: 'modal',
              animation: 'slide_from_bottom'
            }} 
          />
          <Stack.Screen 
            name="onboarding" 
            options={{ 
              gestureEnabled: false,
              animation: 'fade'
            }} 
          />
          <Stack.Screen 
            name="screens/UserProfileScreen" 
            options={{ 
              animation: 'slide_from_right' 
            }} 
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
