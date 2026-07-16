'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Zap, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useAuth } from '@/context/AuthContext';
import {
  fetchHomeVideosPage,
  fetchFlashShelf,
  fetchCategories,
  HOME_PAGE_SIZE,
} from '@/lib/clientApi';
import VirtualizedFeed from '@/components/VirtualizedFeed';
import { VideoSkeleton } from '@/components/Skeleton';
import useWindowWidth from '@/hooks/useWindowWidth';

function formatViews(num) {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

/**
 * Home feed — first page from the server; further pages via infinite scroll.
 * Cards match Vite: VirtualizedFeed → VideoPreviewCard (video-card-v2).
 */
export default function HomeFeed({
  initialVideos = [],
  initialFlash = [],
  initialCategories = ['All'],
}) {
  const router = useRouter();
  const { token } = useAuth();
  const width = useWindowWidth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState(
    initialCategories?.length ? initialCategories : ['All']
  );
  const [videos, setVideos] = useState(initialVideos);
  const [flash, setFlash] = useState(initialFlash);
  const [skip, setSkip] = useState(initialVideos.length);
  const [hasNextPage, setHasNextPage] = useState(initialVideos.length >= HOME_PAGE_SIZE);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [error, setError] = useState(null);

  const { ref, inView } = useInView({ threshold: 0, rootMargin: '200px' });

  useEffect(() => {
    if (categories.length <= 1) {
      fetchCategories()
        .then((cats) => {
          if (Array.isArray(cats) && cats.length > 0) {
            setCategories(['All', ...cats.map((c) => c.name || c)]);
          }
        })
        .catch(() => {});
    }
    if (!flash.length) {
      fetchFlashShelf({ token })
        .then((data) => {
          if (Array.isArray(data)) setFlash(data);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadCategory = useCallback(
    async (category) => {
      setActiveCategory(category);
      setIsCategoryLoading(true);
      setError(null);
      try {
        const mood = category === 'All' ? '' : category;
        const page = await fetchHomeVideosPage({ skip: 0, mood, token });
        const list = Array.isArray(page) ? page : [];
        setVideos(list);
        setSkip(list.length);
        setHasNextPage(list.length >= HOME_PAGE_SIZE);
      } catch (err) {
        setError(err?.message || 'Failed to load feed');
      } finally {
        setIsCategoryLoading(false);
      }
    },
    [token]
  );

  const fetchNextPage = useCallback(async () => {
    if (isFetchingNextPage || !hasNextPage) return;
    setIsFetchingNextPage(true);
    try {
      const mood = activeCategory === 'All' ? '' : activeCategory;
      const page = await fetchHomeVideosPage({ skip, mood, token });
      const list = Array.isArray(page) ? page : [];
      setVideos((prev) => [...prev, ...list]);
      setSkip((s) => s + list.length);
      setHasNextPage(list.length >= HOME_PAGE_SIZE);
    } catch (err) {
      setError(err?.message || 'Failed to load more');
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [activeCategory, hasNextPage, isFetchingNextPage, skip, token]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleVideoClick = (id) => {
    router.push(`/watch/${id}`);
  };

  const columnCount = width >= 1200 ? 3 : width >= 768 ? 2 : 1;
  const firstRowVideos = videos.slice(0, columnCount);
  const remainingVideos = videos.slice(columnCount);
  const flashLimit = width < 768 ? 6 : 18;

  return (
    <div className="home-container page-container">
      <div className="category-chips-container">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => loadCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {isCategoryLoading ? (
        <div className="video-grid" style={{ marginTop: '1rem' }}>
          {[...Array(columnCount)].map((_, i) => (
            <VideoSkeleton key={`cat-skel-${i}`} />
          ))}
        </div>
      ) : (
        <>
          <div className="feed-section">
            {firstRowVideos.length > 0 ? (
              <VirtualizedFeed videos={firstRowVideos} onVideoClick={handleVideoClick} />
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '6rem 2rem',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-raised)',
                  borderRadius: 32,
                  margin: '2rem 0',
                  border: '1px solid var(--border-glass)',
                }}
              >
                <Play size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  No videos found
                </h2>
                <p>
                  We couldn&apos;t find any videos in the &quot;{activeCategory}&quot; category. Try
                  another one!
                </p>
              </div>
            )}
          </div>

          {flash.length > 0 && (
            <div
              className="flash-shelf-container"
              style={{
                margin: '1rem 0',
                padding: '1.5rem 0',
                borderTop: '1px solid var(--border-glass)',
                borderBottom: '1px solid var(--border-glass)',
              }}
            >
              <div className="section-title" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div
                    style={{
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Zap size={24} fill="currentColor" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Flash</h2>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/flash')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  VIEW ALL
                </button>
              </div>

              <div className="flash-shelf-grid">
                {flash.slice(0, flashLimit).map((item) => (
                  <div
                    key={item.id}
                    className="flash-shelf-item hover-scale"
                    onClick={() => router.push(`/flash/${item.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/flash/${item.id}`);
                      }
                    }}
                    role="link"
                    tabIndex={0}
                  >
                    <div className="flash-thumbnail-container">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                      <div className="flash-overlay-info">
                        <div className="flash-item-title">{item.title}</div>
                        <div className="flash-item-views">
                          {formatViews(item.views)} views
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {remainingVideos.length > 0 && (
            <div className="feed-section" style={{ marginTop: '1rem' }}>
              <VirtualizedFeed videos={remainingVideos} onVideoClick={handleVideoClick} />
            </div>
          )}
        </>
      )}

      {isFetchingNextPage && (
        <div className="video-grid" style={{ marginTop: '2rem' }}>
          {[...Array(4)].map((_, i) => (
            <VideoSkeleton key={`more-skel-${i}`} />
          ))}
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--accent-primary)' }}>
          <p>{error}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadCategory(activeCategory)}
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {hasNextPage && (
        <div
          ref={ref}
          style={{ height: 20, margin: '2rem 0', display: 'flex', justifyContent: 'center' }}
        >
          {isFetchingNextPage ? (
            <Loader2 className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          ) : null}
        </div>
      )}
    </div>
  );
}
