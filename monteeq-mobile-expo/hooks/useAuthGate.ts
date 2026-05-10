import { useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

// We'll use a simple singleton-like pattern for the hook state if needed, 
// or just return the state from the hook to be used in the component.
export function useAuthGate() {
  const { isAuthenticated } = useAuthStore();
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = useCallback((action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      setPendingAction(() => action);
      setIsPromptVisible(true);
    }
  }, [isAuthenticated]);

  const closePrompt = useCallback(() => {
    setIsPromptVisible(false);
    setPendingAction(null);
  }, []);

  return { 
    requireAuth, 
    isPromptVisible, 
    closePrompt 
  };
}
