import { create } from 'zustand';

interface PlayerState {
  activeVideoId: string | null;
  isPlaying: boolean;
  isMuted: boolean;
  setActiveVideoId: (id: string | null) => void;
  setPlaying: (value: boolean) => void;
  setMuted: (value: boolean) => void;
  toggleMuted: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  activeVideoId: null,
  isPlaying: true,
  isMuted: false,
  setActiveVideoId: (id) => set({ activeVideoId: id }),
  setPlaying: (value) => set({ isPlaying: value }),
  setMuted: (value) => set({ isMuted: value }),
  toggleMuted: () => set((state) => ({ isMuted: !state.isMuted })),
}));
