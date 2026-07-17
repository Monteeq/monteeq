'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Flame, Star, ChevronUp, ChevronDown, Sparkles, Loader2, Users } from 'lucide-react';
import FlashCard from '@/components/flash/FlashCard';
import AmbientBackdrop from '@/components/flash/AmbientBackdrop';
import DesktopSidebar from '@/components/flash/DesktopSidebar';
import CommentsDrawer from '@/components/flash/CommentsDrawer';
import NativeFeedAd from '@/components/ads/NativeFeedAd';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useRouter } from 'next/navigation';
import {
  likeVideo,
  shareVideo,
  getComments,
  fetchCategories,
  fetchCategoryFlashVideos,
  fetchFlashVideosPage,
  fetchRecommendedFlash,
} from '@/lib/clientApi';
import { adaptiveEngine } from '@/services/adaptiveEngine';
import { adaptiveDiscovery } from '@/services/adaptiveDiscovery';
import { flashFeedManager } from '@/services/flashFeedManager';
import { trackingManager } from '@/services/trackingManager';
import s from '@/styles/pages/Flash.module.css';

const formatClips = (raw) =>
  (raw || []).map((v) => ({
    ...v,
    liked: !!v.liked_by_user,
    owner_followed: !!(v.owner_followed || v.owner?.is_following),
  }));

function resolveToken(token) {
  if (token) return token;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

const dedupeById = (existing, incoming) => {
  const seen = new Set(existing.map((v) => v.id));
  return incoming.filter((v) => !seen.has(v.id));
};

/**
 * Vertical Flash feed — HLS, gestures, IntersectionObserver autoplay are client-only.
 * Initial clips come from the Server Component (first screenful / deep-linked video).
 */
export default function FlashFeed({
  initialClips = [],
  initialCategories = [],
  startVideoId = null,
}) {
  const { token, user } = useAuth();
  const { showNotification } = useNotification();
  const router = useRouter();
  const authHydratedRef = useRef(false);

  const [clips, setClips] = useState(() => formatClips(initialClips));
  const [loading, setLoading] = useState(initialClips.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(
    startVideoId || initialClips[0]?.id || null
  );
  const [muted, setMuted] = useState(true);
  const [activeCommentVideoId, setActiveCommentVideoId] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [tier, setTier] = useState(adaptiveEngine.getTier());
  const [layerResponse, setLayerResponse] = useState({ tier: 0 });
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [feedType, setFeedType] = useState('foryou');
  const [activeCategory, setActiveCategory] = useState('');
  const [categories, setCategories] = useState(initialCategories);
  const [isDesktop, setIsDesktop] = useState(false);

  const containerRef = useRef(null);
  const lastScrollPos = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const activeVideoIdRef = useRef(activeVideoId);
  activeVideoIdRef.current = activeVideoId;
  const activeCommentVideoIdRef = useRef(activeCommentVideoId);
  activeCommentVideoIdRef.current = activeCommentVideoId;
  const commentCacheRef = useRef({});
  const prefetchingRef = useRef(new Set());
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const SWIPE_THRESHOLD = 40;
  const bootstrappedRef = useRef(initialClips.length > 0);

  const handleFeedTypeChange = (type) => {
    setFeedType(type);
    setActiveCategory('');
  };

  const prefetchComments = useCallback(
    (videoId) => {
      if (!videoId) return;
      if (commentCacheRef.current[videoId]) return;
      if (prefetchingRef.current.has(videoId)) return;
      prefetchingRef.current.add(videoId);
      getComments({ videoId, token })
        .then((data) => {
          commentCacheRef.current[videoId] = Array.isArray(data) ? data : [];
        })
        .catch(() => {})
        .finally(() => prefetchingRef.current.delete(videoId));
    },
    [token]
  );

  useEffect(() => {
    setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    setIsDesktop(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
  }, []);

  useEffect(() => {
    trackingManager.setToken(token || null);
  }, [token]);

  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories()
        .then((cats) => {
          if (Array.isArray(cats)) setCategories(cats);
        })
        .catch(() => {});
    }
  }, [categories.length]);

  const scrollNext = useCallback(() => {
    containerRef.current?.scrollBy({ top: containerRef.current.clientHeight, behavior: 'smooth' });
  }, []);
  const scrollPrev = useCallback(() => {
    containerRef.current?.scrollBy({ top: -containerRef.current.clientHeight, behavior: 'smooth' });
  }, []);

  const handleLike = useCallback(
    async (id) => {
      const authToken = resolveToken(token);
      if (!authToken) {
        showNotification?.('info', 'Sign in to like videos');
        router.push('/login');
        return;
      }
      setClips((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, liked: !c.liked, likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1 }
            : c
        )
      );
      try {
        const res = await likeVideo(id, authToken);
        if (res && typeof res.liked === 'boolean') {
          setClips((prev) =>
            prev.map((c) =>
              c.id === id
                ? {
                    ...c,
                    liked: res.liked,
                    likes_count: res.likes_count ?? c.likes_count,
                  }
                : c
            )
          );
        }
      } catch {
        setClips((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  liked: !c.liked,
                  likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1,
                }
              : c
          )
        );
      }
    },
    [token, router, showNotification]
  );

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    adaptiveEngine.startMonitoring((newTier) => setTier(newTier));

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          e.preventDefault();
          scrollPrev();
          break;
        case 'arrowdown':
        case 's':
          e.preventDefault();
          scrollNext();
          break;
        case ' ':
        case 'k': {
          e.preventDefault();
          const vid = activeVideoIdRef.current;
          const activeCard = document.querySelector(`.${s.cardContainer}[data-id="${vid}"]`);
          activeCard?.querySelector('[class*="videoWrapper"]')?.click();
          break;
        }
        case 'm':
          e.preventDefault();
          setMuted((prev) => !prev);
          break;
        case 'l':
          e.preventDefault();
          if (activeVideoIdRef.current) handleLike(activeVideoIdRef.current);
          break;
        case 'c':
          e.preventDefault();
          if (activeCommentVideoIdRef.current) setActiveCommentVideoId(null);
          else if (activeVideoIdRef.current) setActiveCommentVideoId(activeVideoIdRef.current);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
      adaptiveEngine.stopMonitoring();
    };
  }, [handleLike, scrollNext, scrollPrev]);

  useEffect(() => {
    flashFeedManager.configure({ token, mood: activeCategory, feedType });
    // configure() resets skip when token changes — restore cursor after SSR seed
    if (clips.length > 0) {
      flashFeedManager.seedSkip(clips.length);
    }
  }, [token, activeCategory, feedType, clips.length]);

  // Merge authenticated liked_by_user flags onto SSR anonymous clips.
  useEffect(() => {
    const authToken = resolveToken(token);
    if (!authToken || authHydratedRef.current || clips.length === 0) return;
    authHydratedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        let raw = [];
        if (feedType === 'foryou' && !activeCategory) {
          raw = await fetchRecommendedFlash({
            limit: Math.max(clips.length, 15),
            mood: activeCategory,
            token: authToken,
          });
        }
        if (!Array.isArray(raw) || raw.length === 0) {
          raw = await fetchFlashVideosPage({
            skip: 0,
            limit: Math.max(clips.length, 15),
            mood: activeCategory,
            token: authToken,
            feedMode: feedType,
          });
        }
        if (cancelled || !Array.isArray(raw)) return;
        const byId = new Map(raw.map((v) => [String(v.id), v]));
        setClips((prev) =>
          prev.map((c) => {
            const fresh = byId.get(String(c.id));
            if (!fresh) return c;
            return {
              ...c,
              liked: !!fresh.liked_by_user,
              likes_count: fresh.likes_count ?? c.likes_count,
              owner_followed: !!(fresh.owner_followed || fresh.owner?.is_following),
            };
          })
        );
      } catch (err) {
        console.error('[Flash] Failed to rehydrate likes:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when auth becomes available
  }, [token]);

  useEffect(() => {
    const unsubscribe = flashFeedManager.onPrefetch((newVideos) => {
      setClips((prev) => {
        const fresh = dedupeById(prev, formatClips(newVideos));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh];
      });
      setLoadingMore(false);
    });
    return unsubscribe;
  }, []);

  const fetchInitialFeed = useCallback(async () => {
    // Keep SSR clips on first mount for /flash and /flash/[id]
    if (bootstrappedRef.current) {
      bootstrappedRef.current = false;
      flashFeedManager.configure({ token, mood: activeCategory, feedType });
      flashFeedManager.seedSkip(initialClips.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    flashFeedManager.configure({ token, mood: activeCategory, feedType });
    flashFeedManager.reset();

    if (activeCategory) {
      try {
        const raw = await fetchCategoryFlashVideos(activeCategory, 30);
        const formatted = formatClips(raw);
        setClips(formatted);
        setActiveVideoId(formatted[0]?.id || null);
      } catch (err) {
        console.error('[Flash] Category fetch failed:', err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const raw = await flashFeedManager.fetchFeed(15, activeCategory);
      const formatted = formatClips(raw);
      setClips(formatted);
      setActiveVideoId(formatted[0]?.id || null);
    } catch (err) {
      console.error('[Flash] Initial feed fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, feedType, token, initialClips.length]);

  useEffect(() => {
    fetchInitialFeed();
  }, [feedType, activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = (e) => {
    const now = Date.now();
    const currentPos = e.target.scrollTop;
    const dt = now - lastScrollTime.current;
    if (dt > 0) setScrollVelocity(Math.abs(currentPos - lastScrollPos.current) / dt);
    lastScrollPos.current = currentPos;
    lastScrollTime.current = now;
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(deltaX) > Math.abs(deltaY) || Math.abs(deltaY) < SWIPE_THRESHOLD) {
      touchStartY.current = null;
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const cardHeight = container.clientHeight;
    const currentIndex = Math.round(container.scrollTop / cardHeight);
    const targetIndex =
      deltaY > 0
        ? Math.min(currentIndex + 1, clips.length - 1)
        : Math.max(currentIndex - 1, 0);
    container.scrollTo({ top: targetIndex * cardHeight, behavior: 'smooth' });
    touchStartY.current = null;
  };

  useEffect(() => {
    if (loading || clips.length === 0) return;

    const handleIntersection = (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('data-id');
        if (id?.startsWith('ad-')) return;
        if (activeVideoId?.toString() !== id?.toString()) {
          setLayerResponse(adaptiveDiscovery.recordSkip(id, activeCategory));
          trackingManager.trackSkip(id);
          setActiveVideoId(id);
        }
        const currentIndex = clips.findIndex((c) => c.id.toString() === id?.toString());
        const remaining = clips.length - currentIndex;
        setLoadingMore(true);
        flashFeedManager.recordConsumption(remaining);
      });
    };

    const observer = new IntersectionObserver(handleIntersection, {
      root: containerRef.current,
      threshold: 0.7,
    });

    document.querySelectorAll(`.${s.cardContainer}`).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, clips, activeVideoId, activeCategory]);

  const visibleClips = useMemo(() => {
    const activeIndex = clips.findIndex((c) => c.id.toString() === activeVideoId?.toString());
    const buffer = scrollVelocity > 1.5 ? 3 : 2;
    return clips.map((clip, index) => ({
      ...clip,
      shouldRender: Math.abs(activeIndex - index) <= buffer,
    }));
  }, [clips, activeVideoId, scrollVelocity]);

  const activeClip = useMemo(
    () => clips.find((c) => c.id.toString() === activeVideoId?.toString()),
    [clips, activeVideoId]
  );

  useEffect(() => {
    if (activeClip?.title) {
      window.dispatchEvent(new CustomEvent('monteeq:update-title', { detail: activeClip.title }));
    }
  }, [activeClip?.title]);

  // Shorts-style URL sync
  useEffect(() => {
    if (!activeVideoId) return;
    const expectedPath = `/flash/${activeVideoId}`;
    if (window.location.pathname.startsWith('/flash') && window.location.pathname !== expectedPath) {
      window.history.replaceState(null, '', expectedPath);
    }
  }, [activeVideoId]);

  useEffect(() => {
    if (activeVideoId) prefetchComments(activeVideoId);
  }, [activeVideoId, prefetchComments]);

  const handleShare = useCallback(async (id) => {
    const url = `${window.location.origin}/flash/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check this out on Monteeq', url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      shareVideo(id).catch(() => {});
    } catch {
      /* ignore abort */
    }
  }, []);

  if (loading) {
    return (
      <div className={s.container}>
        {isDesktop && (
          <DesktopSidebar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            feedType={feedType}
            setFeedType={handleFeedTypeChange}
            categories={categories}
          />
        )}
        <div className={s.mainContent}>
          <div className={s.feed} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.container}>
      {isDesktop && (
        <DesktopSidebar
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          feedType={feedType}
          setFeedType={handleFeedTypeChange}
          categories={categories}
        />
      )}

      <div className={s.mainContent}>
        <AmbientBackdrop videoThumbnail={activeClip?.thumbnail_url} tier={tier} />

        {isOffline && <div className={s.offlineBanner}>You&apos;re offline — showing loaded feed</div>}

        <div
          className={`${s.moodHint} ${layerResponse.shouldSuggestMoodSwitch ? s.moodHintVisible : ''}`}
          onClick={() => layerResponse.suggestedMood && setActiveCategory(layerResponse.suggestedMood)}
          onKeyDown={() => {}}
          role="presentation"
        >
          <Sparkles size={20} color="var(--accent-primary)" />
          <span>Switching to {layerResponse.suggestedMood?.toUpperCase()}?</span>
        </div>

        {!isDesktop && (
          <div className={s.topNav}>
            <div
              className={`${s.navItem} ${feedType === 'foryou' ? s.active : ''}`}
              onClick={() => handleFeedTypeChange('foryou')}
              onKeyDown={() => {}}
              role="button"
              tabIndex={0}
            >
              <Flame size={18} />
              <span>For You</span>
            </div>
            <div
              className={`${s.navItem} ${feedType === 'trending' ? s.active : ''}`}
              onClick={() => handleFeedTypeChange('trending')}
              onKeyDown={() => {}}
              role="button"
              tabIndex={0}
            >
              <Star size={18} />
              <span>Trending</span>
            </div>
            <div
              className={`${s.navItem} ${feedType === 'following' ? s.active : ''}`}
              onClick={() => handleFeedTypeChange('following')}
              onKeyDown={() => {}}
              role="button"
              tabIndex={0}
            >
              <Users size={18} />
              <span>Following</span>
            </div>
          </div>
        )}

        <div
          className={s.feed}
          ref={containerRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {clips.length === 0 && (
            <div className={s.emptyState}>
              <Flame size={48} className={s.emptyStateIcon} />
              <h3 className={s.emptyStateTitle}>Nothing here yet</h3>
              <p className={s.emptyStateSubline}>Try a different mood or be the first to post</p>
            </div>
          )}

          {visibleClips.map((clip, index) => (
            <React.Fragment key={clip.id}>
              <div className={s.cardContainer} data-id={clip.id}>
                <FlashCard
                  video={clip}
                  isActive={activeVideoId?.toString() === clip.id.toString()}
                  onLike={handleLike}
                  onComment={(id) => setActiveCommentVideoId(id)}
                  onShare={handleShare}
                  muted={muted}
                  toggleMute={() => setMuted((m) => !m)}
                  shouldRender={clip.shouldRender}
                  onPrefetchComments={prefetchComments}
                />
              </div>
              {(index + 1) % 5 === 0 && !user?.is_premium && (
                <div className={s.cardContainer} data-id={`ad-${index}`}>
                  <NativeFeedAd variant="flash" />
                </div>
              )}
            </React.Fragment>
          ))}

          {loadingMore && (
            <div className={s.loadingMore}>
              <Loader2 size={24} className={s.loadingIcon} />
            </div>
          )}
        </div>

        <div className={s.navControls} title="↑↓ or W/S • Space/K pause • M mute • L like • C comments">
          <button type="button" className={s.navBtn} onClick={scrollPrev}>
            <ChevronUp size={28} />
          </button>
          <button type="button" className={s.navBtn} onClick={scrollNext}>
            <ChevronDown size={28} />
          </button>
        </div>
      </div>

      {activeCommentVideoId && (
        <CommentsDrawer
          videoId={activeCommentVideoId}
          onClose={() => setActiveCommentVideoId(null)}
          initialComments={commentCacheRef.current[activeCommentVideoId] ?? null}
        />
      )}

    </div>
  );
}
