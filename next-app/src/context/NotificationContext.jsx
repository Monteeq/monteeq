'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext({
  unreadCount: 0,
  showNotification: () => {},
});

/**
 * Minimal stub matching the Vite NotificationContext surface used by ModernHeader.
 * Full toast/polling migrates with /notifications later.
 */
export function NotificationProvider({ children }) {
  const [unreadCount] = useState(0);

  const showNotification = useCallback(() => {
    /* no-op stub until notifications page migrates */
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, showNotification, notifications: [] }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}
