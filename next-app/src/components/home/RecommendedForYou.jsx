'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import VirtualizedFeed from '@/components/VirtualizedFeed';
import { VideoSkeleton } from '@/components/Skeleton';
import { useRecommendations } from '@/hooks/useRecommendations';

const ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_RECOMMENDATIONS === '1' ||
  process.env.NEXT_PUBLIC_ENABLE_RECOMMENDATIONS === 'true';

export default function RecommendedForYou({ userId, columnCount = 3 }) {
  const router = useRouter();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRecommendations(userId, { enabled: !!ENABLED && !!userId });

  const { ref, inView } = useInView({ threshold: 0, rootMargin: '400px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleVideoClick = useCallback(
    (videoId) => {
      console.log('[Recommendations] Video clicked', { videoId, source: 'recommendations' });
      router.push(`/watch/${videoId}`);
    },
    [router],
  );

  const flashItems = data.filter((v) => v.video_type === 'flash');
  const homeItems = data.filter((v) => v.video_type !== 'flash');

  const formatViews = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  };

  if (!ENABLED || !userId) return null;

  if (isLoading && data.length === 0) {
    return (
      <div className="feed-section" style={{ marginBottom: '2rem' }}>
        <div
          className="section-title"
          style={{ justifyContent: 'space-between', marginBottom: '1rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <Sparkles size={22} color="var(--accent-primary)" />
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Recommended for You</h2>
          </div>
        </div>
        <div className="video-grid">
          {Array.from({ length: columnCount }, (_, i) => (
            <VideoSkeleton key={`recs-skel-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error || data.length === 0) return null;

  return (
    <div className="feed-section" style={{ marginBottom: '2rem' }}>
      <div
        className="section-title"
        style={{ justifyContent: 'space-between', marginBottom: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Sparkles size={22} color="var(--accent-primary)" />
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Recommended for You</h2>
        </div>
      </div>
      <VirtualizedFeed videos={data} onVideoClick={handleVideoClick} />
      {hasNextPage && (
        <div
          ref={ref}
          style={{
            height: 20,
            margin: '1.5rem 0',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {isFetchingNextPage ? (
            <Loader2 className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          ) : null}
        </div>
      )}
    </div>
  );
}
