'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Vite App.jsx: auth routes render `<Navigate to="/" />` when token is present.
 * Client-side only until httpOnly cookie + middleware (Batch 3).
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
