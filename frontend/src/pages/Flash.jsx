import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { likeVideo } from '../api';
import FlashCard from '../components/FlashCard';
import AmbientBackdrop from '../components/AmbientBackdrop';
import DesktopSidebar from '../components/DesktopSidebar';
import CommentsDrawer from '../components/CommentsDrawer';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { FlashSkeleton } from '../components/Skeleton';
import { Flame, Star, ChevronUp, ChevronDown, Sparkles, Zap, Users } from 'lucide-react';
import NativeFeedAd from '../components/ads/NativeFeedAd';

// Services
import { adaptiveEngine } from '../services/adaptiveEngine';
import { adaptiveDiscovery } from '../services/adaptiveDiscovery';
import { metricsManager } from '../services/metricsManager';
import { feedManager } from '../services/feedManager';
import { trackingManager } from '../services/trackingManager';

import s from './Flash.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatClips = (raw, layerResponse) => {
    const ranked = adaptiveDiscovery.reRankBatch(raw, layerResponse);
    return ranked.map(v => ({
        ...v,
        liked: v.liked_by_user,
        owner_followed: v.owner?.is_following || false,
    }));
};

const dedupeById = (existing, incoming) => {
    const seen = new Set(existing.map(v => v.id));
    return incoming.filter(v => !seen.has(v.id));
};

// ─── Component ────────────────────────────────────────────────────────────────

const Flash = () => {
    const { showNotification } = useNotification();
    const { token, user } = useAuth();

    // ── Feed state ────────────────────────────────────────────────────────────
    const [clips, setClips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState(null);
    const [muted, setMuted] = useState(true);
    const [activeCommentVideoId, setActiveCommentVideoId] = useState(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // ── Adaptive engine state ─────────────────────────────────────────────────
    const [tier, setTier] = useState(adaptiveEngine.getTier());
    const [layerResponse, setLayerResponse] = useState({ tier: 0 });
    const [is2x, setIs2x] = useState(false);
    const [scrollVelocity, setScrollVelocity] = useState(0);

    // ── Navigation / filtering state ──────────────────────────────────────────
    const [feedType, setFeedType] = useState('foryou');
    const [activeCategory, setActiveCategory] = useState('');

    /**
     * Selecting a feed type (For You / Trending / Following) clears any active
     * category filter so the recommendation engine runs unconstrained.
     */
    const handleFeedTypeChange = (type) => {
        setFeedType(type);
        setActiveCategory('');
    };

    // ── Layout ────────────────────────────────────────────────────────────────
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const containerRef = useRef(null);
    const lastScrollPos = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const layerResponseRef = useRef(layerResponse);
    layerResponseRef.current = layerResponse;

    // Touch swipe tracking
    const touchStartY = useRef(null);
    const touchStartX = useRef(null);
    const SWIPE_THRESHOLD = 40; // min px vertical movement to count as a swipe

    // ─────────────────────────────────────────────────────────────────────────
    // Initialise token in trackingManager whenever it changes
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        trackingManager.setToken(token || null);
    }, [token]);

    // ─────────────────────────────────────────────────────────────────────────
    // Adaptive engine + resize + online/offline watcher
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        const handleOnline  = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('resize', handleResize);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        adaptiveEngine.startMonitoring(newTier => setTier(newTier));
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            adaptiveEngine.stopMonitoring();
        };
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // feedManager: configure + register prefetch callback
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        feedManager.configure({ token, videoType: 'flash', mood: activeCategory });
    }, [token, activeCategory, feedType]);

    useEffect(() => {
        // When feedManager pre-fetches more clips in the background, append them
        const unsubscribe = feedManager.onPrefetch(newVideos => {
            setClips(prev => {
                const fresh = dedupeById(prev, formatClips(newVideos, layerResponseRef.current));
                if (fresh.length === 0) return prev;
                return [...prev, ...fresh];
            });
            setLoadingMore(false);
        });
        return unsubscribe;
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Initial fetch — stale-while-revalidate for instant cold load
    // ─────────────────────────────────────────────────────────────────────────
    const fetchInitialFeed = useCallback(async () => {
        setLoading(true);
        feedManager.configure({ 
            token, 
            videoType: 'flash', 
            mood: activeCategory, 
            feedType 
        });

        // Show stale cache immediately, then silently update with fresh data
        const stale = feedManager.fetchWithStaleWhileRevalidate((freshVideos) => {
            const formatted = formatClips(freshVideos, layerResponseRef.current);
            setClips(formatted);
            if (formatted.length > 0) setActiveVideoId(formatted[0].id);
        });

        if (stale && stale.length > 0) {
            // Instant render from cache — hide the loading skeleton immediately
            const formatted = formatClips(stale, layerResponseRef.current);
            setClips(formatted);
            setActiveVideoId(formatted[0].id);
            setLoading(false);
        } else {
            // No cache — wait for real data
            try {
                const raw = await feedManager.fetchFeed(15, activeCategory);
                if (Array.isArray(raw) && raw.length > 0) {
                    const formatted = formatClips(raw, layerResponseRef.current);
                    setClips(formatted);
                    setActiveVideoId(formatted[0].id);
                }
            } catch (err) {
                console.error('[Flash] Initial feed fetch failed:', err.message);
            } finally {
                setLoading(false);
            }
        }

        feedManager.resetConsumption();
    }, [activeCategory, feedType, token]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchInitialFeed();
    }, [feedType, activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─────────────────────────────────────────────────────────────────────────
    // Scroll velocity — used for render-buffer tuning
    // ─────────────────────────────────────────────────────────────────────────
    const handleScroll = (e) => {
        const now = Date.now();
        const currentPos = e.target.scrollTop;
        const dt = now - lastScrollTime.current;
        if (dt > 0) setScrollVelocity(Math.abs(currentPos - lastScrollPos.current) / dt);
        lastScrollPos.current = currentPos;
        lastScrollTime.current = now;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Swipe navigation — programmatically snap to next/prev card
    // CSS snap alone is unreliable on low-end mobile; this guarantees it.
    // ─────────────────────────────────────────────────────────────────────────
    const handleTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        if (touchStartY.current === null) return;

        const deltaY = touchStartY.current - e.changedTouches[0].clientY;
        const deltaX = touchStartX.current - e.changedTouches[0].clientX;

        // Ignore if horizontal swipe is dominant (could be category scroller etc.)
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            touchStartY.current = null;
            return;
        }

        if (Math.abs(deltaY) < SWIPE_THRESHOLD) {
            touchStartY.current = null;
            return;
        }

        const container = containerRef.current;
        if (!container) return;

        const cardHeight = container.clientHeight;
        const currentIndex = Math.round(container.scrollTop / cardHeight);
        const targetIndex = deltaY > 0
            ? Math.min(currentIndex + 1, clips.length - 1)  // swipe up → next
            : Math.max(currentIndex - 1, 0);                // swipe down → prev

        container.scrollTo({
            top: targetIndex * cardHeight,
            behavior: 'smooth',
        });

        touchStartY.current = null;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Intersection observer — advances active video, tracks skip, triggers prefetch
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (loading || clips.length === 0) return;

        const handleIntersection = (entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const id = parseInt(entry.target.getAttribute('data-id'), 10);
                if (activeVideoId !== id) {
                    // Adaptive layer: record skip for category-mood adaptation
                    setLayerResponse(adaptiveDiscovery.recordSkip(id, activeCategory));
                    // Legacy metrics (kept for existing analytics pipeline)
                    metricsManager.trackSkip(id);
                    // Advance active video
                    setActiveVideoId(id);
                }

                // Calculate remaining videos from this clip onward
                const currentIndex = clips.findIndex(c => c.id === id);
                const remaining = clips.length - currentIndex;

                // Tell feedManager: auto-prefetches when remaining ≤ 7
                feedManager.recordConsumption(remaining);
            });
        };

        const observer = new IntersectionObserver(handleIntersection, {
            root: containerRef.current,
            threshold: 0.7,
        });

        document.querySelectorAll(`.${s.cardContainer}`).forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [loading, clips, activeVideoId, activeCategory]);

    // ─────────────────────────────────────────────────────────────────────────
    // Derived state
    // ─────────────────────────────────────────────────────────────────────────
    const visibleClips = useMemo(() => {
        const activeIndex = clips.findIndex(c => c.id === activeVideoId);
        // Render fewer neighbours at high scroll velocity to avoid jank
        const buffer = scrollVelocity > 1.5 ? 3 : 1;
        return clips.map((clip, index) => ({
            ...clip,
            shouldRender: Math.abs(activeIndex - index) <= buffer,
        }));
    }, [clips, activeVideoId, scrollVelocity]);

    const activeClip = useMemo(() => clips.find(c => c.id === activeVideoId), [clips, activeVideoId]);

    // ─────────────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────────────
    const handleLike = async (id) => {
        if (!token) {
            showNotification('Please log in to like videos', 'info');
            return;
        }
        // Optimistic UI update
        setClips(prev => prev.map(c =>
            c.id === id
                ? { ...c, liked: !c.liked, likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1 }
                : c
        ));
        try {
            await likeVideo(id, token);
        } catch {
            // Revert on failure
            setClips(prev => prev.map(c =>
                c.id === id
                    ? { ...c, liked: !c.liked, likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1 }
                    : c
            ));
            showNotification('Failed to like video', 'error');
        }
    };

    const scrollNext = () => containerRef.current?.scrollBy({ top: containerRef.current.clientHeight, behavior: 'smooth' });
    const scrollPrev = () => containerRef.current?.scrollBy({ top: -containerRef.current.clientHeight, behavior: 'smooth' });

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className={s.container}>
            {isDesktop && <DesktopSidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} feedType={feedType} setFeedType={handleFeedTypeChange} />}
            <div className={s.mainContent}><div className={s.feed}><FlashSkeleton /></div></div>
        </div>
    );

    return (
        <div className={s.container}>
            {isDesktop && <DesktopSidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} feedType={feedType} setFeedType={handleFeedTypeChange} />}

            <div className={s.mainContent}>
                <AmbientBackdrop videoThumbnail={activeClip?.thumbnail_url} tier={tier} />

                {/* Offline banner — slides in from top when disconnected */}
                {isOffline && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
                        background: 'rgba(255,80,80,0.92)', backdropFilter: 'blur(8px)',
                        color: '#fff', textAlign: 'center', padding: '0.5rem 1rem',
                        fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.02em',
                        animation: 'slideDown 0.3s ease',
                    }}>
                        📡 You're offline — showing cached feed
                    </div>
                )}

                {/* Mood-switch hint toast */}
                <div
                    className={`${s.moodHint} ${layerResponse.shouldSuggestMoodSwitch ? s.moodHintVisible : ''}`}
                    onClick={() => setActiveCategory(layerResponse.suggestedMood)}
                >
                    <Sparkles size={20} color="var(--accent-primary)" />
                    <span>Switching to {layerResponse.suggestedMood?.toUpperCase()}? ⚡</span>
                </div>

                {/* Top Nav — mobile only */}
                {!isDesktop && (
                    <div className={s.topNav}>
                        <div className={`${s.navItem} ${feedType === 'foryou' ? s.active : ''}`} onClick={() => handleFeedTypeChange('foryou')}>
                            <Flame size={18} /><span>For You</span>
                        </div>
                        <div className={`${s.navItem} ${feedType === 'trending' ? s.active : ''}`} onClick={() => handleFeedTypeChange('trending')}>
                            <Star size={18} /><span>Trending</span>
                        </div>
                        <div className={`${s.navItem} ${feedType === 'following' ? s.active : ''}`} onClick={() => handleFeedTypeChange('following')}>
                            <Users size={18} /><span>Following</span>
                        </div>
                    </div>
                )}

                {/* Feed */}
                <div
                    className={s.feed}
                    ref={containerRef}
                    onScroll={handleScroll}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                {clips.length === 0 && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', zIndex: 10 }}>
                        <Flame size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: '1rem' }} />
                        {isOffline
                            ? <><h3>You're offline</h3><p style={{ opacity: 0.6 }}>Check your connection and pull to refresh</p></>
                            : <><h3>No clips found</h3><p style={{ opacity: 0.6 }}>Try a different category or upload some!</p></>
                        }
                    </div>
                )}

                    {visibleClips.map((clip, index) => (
                        <React.Fragment key={clip.id}>
                            <div className={s.cardContainer} data-id={clip.id}>
                                <FlashCard
                                    video={clip}
                                    isActive={activeVideoId === clip.id}
                                    onLike={handleLike}
                                    onComment={id => setActiveCommentVideoId(id)}
                                    muted={muted}
                                    toggleMute={() => setMuted(m => !m)}
                                    shouldRender={clip.shouldRender}
                                    onSpeedChange={state => setIs2x(state)}
                                />
                            </div>
                            {(index + 1) % 5 === 0 && !user?.is_premium && (
                                <div className={s.cardContainer} data-id={`ad-${index}`}>
                                    <NativeFeedAd variant="flash" />
                                </div>
                            )}
                        </React.Fragment>
                    ))}

                    {/* Loading-more indicator (shown when feedManager is prefetching) */}
                    {loadingMore && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', opacity: 0.5 }}>
                            <Zap size={24} className="animate-spin" />
                        </div>
                    )}
                </div>

                {/* Floating nav controls */}
                <div className={s.navControls}>
                    <button className={s.navBtn} onClick={scrollPrev}><ChevronUp size={28} /></button>
                    <button className={s.navBtn} onClick={scrollNext}><ChevronDown size={28} /></button>
                    <div className={s.perfOverlay}>TIER: {tier}</div>
                </div>
            </div>

            {/* 2× speed overlay */}
            <div className={`${s.speedOverlay} ${is2x ? s.speedVisible : ''}`}>
                <Zap size={32} fill="var(--accent-primary)" />
                <span>2X PLAYBACK</span>
            </div>

            {/* Comments drawer */}
            {activeCommentVideoId && (
                <CommentsDrawer
                    videoId={activeCommentVideoId}
                    onClose={() => setActiveCommentVideoId(null)}
                />
            )}
        </div>
    );
};

export default Flash;
