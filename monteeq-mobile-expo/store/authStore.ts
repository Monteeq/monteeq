import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/types/api';
import { authApi } from '@/lib/api/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setError: (error: string | null) => void;
  
  login: (username: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setError: (error) => set({ error }),

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login(username, password);
      await SecureStore.setItemAsync('access_token', data.access_token);
      set({ isAuthenticated: true });
      await get().refreshUser();
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Login failed' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  googleLogin: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.googleAuth(credential);
      await SecureStore.setItemAsync('access_token', data.access_token);
      set({ isAuthenticated: true });
      await get().refreshUser();
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Google Login failed' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshUser: async () => {
    try {
      const user = await authApi.getMe();
      set({ user });
    } catch (err) {
      console.error('Failed to refresh user profile', err);
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        set({ isAuthenticated: true });
        await get().refreshUser();
      }
    } catch (error) {
      console.error('Auth initialization failed', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
