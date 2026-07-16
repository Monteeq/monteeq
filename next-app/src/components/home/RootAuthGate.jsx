'use client';

import { useAuth } from '@/context/AuthContext';
import HomeFeed from '@/components/home/HomeFeed';

/**
 * Inline auth branch for `/` — both Landing and Home are valid renders of the same path.
 * No middleware redirect. Auth is detected client-side from localStorage (same token
 * key as the Vite app; intentional for cross-site API). Crawlers see the Landing SSR HTML.
 */
export default function RootAuthGate({
  children,
  initialVideos,
  initialFlash,
  initialCategories,
}) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading…</div>
      </div>
    );
  }

  if (token) {
    return (
      <HomeFeed
        initialVideos={initialVideos}
        initialFlash={initialFlash}
        initialCategories={initialCategories}
      />
    );
  }

  return children;
}
