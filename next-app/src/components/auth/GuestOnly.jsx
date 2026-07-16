'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Vite App.jsx: auth routes render `<Navigate to="/" />` when token is present.
 * Client-side only — auth is localStorage token + Bearer (intentional; HF Spaces
 * API is cross-site, so httpOnly cookie middleware is not used).
 */
export default function GuestOnly({ children }) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && token) {
      router.replace('/');
    }
  }, [loading, token, router]);

  if (loading) return null;
  if (token) return null;

  return children;
}
