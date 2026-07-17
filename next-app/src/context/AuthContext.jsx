'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchMe,
  loginWithPassword,
  registerUser,
  googleAuth,
  verifyLogin2FA as verifyLogin2FARequest,
} from '@/lib/clientApi';

async function registerPushSafe(accessToken) {
  try {
    const { registerPushSubscription } = await import('@/utils/pushSubscription');
    registerPushSubscription(accessToken);
  } catch (err) {
    console.warn('Push subscription skipped:', err?.message || err);
  }
}

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  googleLogin: async () => {},
  verifyLogin2FA: async () => {},
  logout: () => {},
  refreshUser: async () => {},
  updateAuthToken: () => {},
  setUser: () => {},
});

/**
 * Auth — same localStorage key (`token`) as the Vite app.
 * Registers web push after login when push utils are available.
 */
function readStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Prefer localStorage on the client so like/follow aren't blocked while /users/me loads.
  // Server render stays null (window undefined) to avoid leaking auth into SSR HTML.
  const [token, setToken] = useState(readStoredToken);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (authToken) => {
    const current = authToken ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!current) {
      setUser(null);
      return null;
    }
    try {
      const me = await fetchMe(current);
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setToken(stored);
    if (!stored) {
      setUser(null);
      setLoading(false);
      return;
    }
    await fetchUser(stored);
    setLoading(false);
  }, [fetchUser]);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    setToken(null);
    setUser(null);
  }, []);

  const updateAuthToken = useCallback((newToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', newToken);
    }
    setToken(newToken);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const data = await loginWithPassword(credentials);
      if (data?.two_factor_required) return data;
      const { access_token } = data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      registerPushSafe(access_token);
      return fetchUser(access_token);
    },
    [fetchUser]
  );

  const signup = useCallback(async (userData) => {
    return registerUser(userData);
  }, []);

  const googleLogin = useCallback(
    async (credential) => {
      const data = await googleAuth(credential);
      if (data?.two_factor_required) return data;
      const { access_token } = data;
      if (access_token) {
        localStorage.setItem('token', access_token);
        setToken(access_token);
        registerPushSafe(access_token);
        return fetchUser(access_token);
      }
      return data;
    },
    [fetchUser]
  );

  const verifyLogin2FA = useCallback(
    async (username, code) => {
      const data = await verifyLogin2FARequest(username, code);
      const { access_token } = data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      registerPushSafe(access_token);
      return fetchUser(access_token);
    },
    [fetchUser]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      if (localStorage.getItem('token')) logout();
    };
    window.addEventListener('monteeq:session-expired', handler);
    return () => window.removeEventListener('monteeq:session-expired', handler);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        googleLogin,
        verifyLogin2FA,
        logout,
        refreshUser: load,
        updateAuthToken,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
