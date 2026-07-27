'use client';

import { useRef, useEffect, useCallback } from 'react';
import { getClientApiBaseUrl } from '@/lib/streamUrl';

const FLUSH_INTERVAL_MS = 5000;

let globalQueue = [];
let globalTimer = null;

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function flushQueue() {
  if (globalQueue.length === 0) return;
  const batch = globalQueue.splice(0, globalQueue.length);
  try {
    await fetch(`${getClientApiBaseUrl()}/events/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Silent — events are best-effort
  }
}

function ensureTimer() {
  if (globalTimer) return;
  globalTimer = setInterval(() => {
    flushQueue();
  }, FLUSH_INTERVAL_MS);
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      clearInterval(globalTimer);
      globalTimer = null;
      flushQueue();
    });
  }
}

export function useVideoEvents(videoId, userId, sessionId) {
  const firedRef = useRef({
    view: false,
    watch_25: false,
    watch_50: false,
    watch_75: false,
    complete: false,
  });

  const pushEvent = useCallback(
    (eventType, watchSeconds) => {
      if (!userId || !videoId) return;
      globalQueue.push({
        user_id: userId,
        video_id: videoId,
        event_type: eventType,
        watch_seconds: watchSeconds != null ? Math.floor(watchSeconds) : null,
        session_id: sessionId || null,
      });
      ensureTimer();
    },
    [videoId, userId, sessionId]
  );

  const fireOnce = useCallback(
    (eventType, watchSeconds) => {
      if (firedRef.current[eventType]) return;
      firedRef.current[eventType] = true;
      pushEvent(eventType, watchSeconds);
    },
    [pushEvent]
  );

  const checkThresholds = useCallback(
    (currentTime, duration) => {
      if (!duration || duration <= 0) return;
      const pct = currentTime / duration;
      if (pct >= 0.25) fireOnce('watch_25', currentTime);
      if (pct >= 0.50) fireOnce('watch_50', currentTime);
      if (pct >= 0.75) fireOnce('watch_75', currentTime);
      if (pct >= 0.95) fireOnce('complete', currentTime);
    },
    [fireOnce]
  );

  const fireView = useCallback(() => {
    fireOnce('view', 0);
  }, [fireOnce]);

  const fireSkip = useCallback(
    (watchSeconds) => {
      if (firedRef.current.view && !firedRef.current.watch_25) {
        fireOnce('skip', watchSeconds);
      }
    },
    [fireOnce]
  );

  const fireLike = useCallback(() => {
    pushEvent('like', null);
  }, [pushEvent]);

  const fireShare = useCallback(() => {
    pushEvent('share', null);
  }, [pushEvent]);

  const flush = useCallback(() => {
    flushQueue();
  }, []);

  // Flush on unmount + fire skip if user leaves early
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return {
    fireView,
    fireSkip,
    checkThresholds,
    fireLike,
    fireShare,
    flush,
  };
}

export function generateSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
