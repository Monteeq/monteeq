'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Zap, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useAuth } from '@/context/AuthContext';
import {
  fetchHomeVideosPage,
  fetchFlashShelf,
  fetchCategories,
  HOME_PAGE_SIZE,
} from '@/lib/clientApi';

function formatViews(num) {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function VideoCard({ video }) {
  return (
    <Link
      href={`/watch/${video.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      className="hover-scale"
    >
      <div
        style={{
          aspectRatio: '16/9',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-glass)',
        }}
      >
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt={video.title || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : null}
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>{video.title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
          @{video.owner?.username} · {formatViews(video.views)} views
        </div>
      </div>
    </Link>
  );
}

/**
 * Home feed — first page comes from the server; further pages load via
 * IntersectionObserver (client-only infinite scroll).
 */
export default function HomeFeed({
  initialVideos = [],
  initialFlash = [],
  initialCategories = ['All'],
}) {
  const { token } = useAuth();
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

  // Refresh categories/flash on mount if server sent empty (optional enrichment)
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
    if (inView && hasNextPage && !isFetchingNextPage && activeCategory === 'All') {
      // For "All", continue from SSR skip. For other categories, loadCategory already reset.
      fetchNextPage();
    } else if (inView && hasNextPage && !isFetchingNextPage && activeCategory !== 'All') {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, activeCategory]);

  const firstRowVideos = videos.slice(0, 3);
  const remainingVideos = videos.slice(3);

  return (
    <div className="home-container page-container" style={{ padding: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>
      <div
        className="category-chips-container"
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => loadCategory(cat)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 999,
              border: '1px solid var(--border-glass)',
              background: activeCategory === cat ? 'var(--accent-primary)' : 'var(--bg-raised)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {isCategoryLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <>
          <div
            className="feed-section"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {firstRowVideos.length > 0 ? (
              firstRowVideos.map((v) => <VideoCard key={v.id} video={v} />)
            ) : (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '6rem 2rem',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-raised)',
                  borderRadius: 32,
                  border: '1px solid var(--border-glass)',
                }}
              >
                <Play size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No videos found</h2>
                <p>We couldn&apos;t find any videos in the &quot;{activeCategory}&quot; category.</p>
              </div>
            )}
          </div>

          {flash.length > 0 && (
            <div
              className="flash-shelf-container"
              style={{
                margin: '1.5rem 0',
                padding: '1.5rem 0',
                borderTop: '1px solid var(--border-glass)',
                borderBottom: '1px solid var(--border-glass)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                    <Zap size={24} fill="currentColor" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Flash</h2>
                </div>
                <Link
                  href="/flash"
                  style={{
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    textDecoration: 'none',
                  }}
                >
                  VIEW ALL
                </Link>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {flash.slice(0, 12).map((item) => (
                  <Link
                    key={item.id}
                    href={`/flash/${item.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div
                      style={{
                        aspectRatio: '2/3',
                        borderRadius: 12,
                        overflow: 'hidden',
                        position: 'relative',
                        background: 'var(--bg-raised)',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '0.5rem',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {formatViews(item.views)} views
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {remainingVideos.length > 0 && (
            <div
              className="feed-section"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginTop: '1rem',
              }}
            >
              {remainingVideos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent-primary)' }}>
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
          style={{ height: 40, margin: '2rem 0', display: 'flex', justifyContent: 'center' }}
        >
          {isFetchingNextPage ? (
            <Loader2 className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          ) : null}
        </div>
      )}
    </div>
  );
}
