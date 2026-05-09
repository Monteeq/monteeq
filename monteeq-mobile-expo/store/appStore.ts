import { create } from 'zustand';
import { Video, User } from './api';

interface AppStore {
  // Video state
  videos: Video[];
  setVideos: (videos: Video[]) => void;
  addVideos: (videos: Video[]) => void;
  clearVideos: () => void;

  // User state
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  videos: [],
  setVideos: (videos) => set({ videos }),
  addVideos: (videos) => set((state) => ({ videos: [...state.videos, ...videos] })),
  clearVideos: () => set({ videos: [] }),

  currentUser: null,
  setCurrentUser: (currentUser) => set({ currentUser }),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  error: null,
  setError: (error) => set({ error }),
}));
