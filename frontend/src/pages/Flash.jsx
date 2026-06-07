import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { likeVideo, shareVideo, getCategories, getCategoryVideos, getVideoById } from '../api';
import FlashCard from '../components/FlashCard';
import AmbientBackdrop from '../components/AmbientBackdrop';
import DesktopSidebar from '../components/DesktopSidebar';
import CommentsDrawer from '../components/CommentsDrawer';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { FlashSkeleton } from '../components/Skeleton';
import { Flame, Star, ChevronUp, ChevronDown, Sparkles, Zap, Users } from 'lucide-react';
import NativeFeedAd from '../components/ads/NativeFeedAd';
import SEO from '../components/SEO';

// Services
import { adaptiveEngine } from '../services/adaptiveEngine';
import { adaptiveDiscovery } from '../services/adaptiveDiscovery';
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
    const { id: urlVideoId } = useParams();

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
    const [scrollVelocity, setScrollVelocity] = useState(0);

    // ── Navigation / filtering state ──────────────────────────────────────────
    const [feedType, setFeedType] = useState('foryou');
    const [activeCategory, setActiveCategory] = useState('');
    const [categories, setCategories] = useState([]);

    const handleFeedTypeChange = (type) => {
        setFeedType(type);
        setActiveCategory('');
    };

    // Fetch dynamic categories on mount
    useEffect(() => {
        getCategories().then(cats => {
            if (Array.isArray(cats)) setCategories(cats);
        }).catch(() => {});
    }, []);

    // ── Layout ────────────────────────────────────────────────────────────────
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const containerRef = useRef(null);
    const lastScrollPos = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const layerResponseRef = useRef(layerResponse);
    layerResponseRef.current = layerResponse;

    // Stable refs for values used inside keydown handler (avoids re-registering listeners)
    const mutedRef = useRef(muted);
    mutedRef.current = muted;
    const activeVideoIdRef = useRef(activeVideoId);
    activeVideoIdRef.current = activeVideoId;
    const activeCommentVideoIdRef = useRef(activeCommentVideoId);
    activeCommentVideoIdRef.current = activeCommentVideoId;

    // Touch swipe tracking
    const touchStartY = useRef(null);
    const touchStartX = useRef(null);
    const SWIPE_THRESHOLD = 40; 

    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        trackingManager.setToken(token || null);
    }, [token]);

    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        const handleOnline  = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('resize', handleResize);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        adaptiveEngine.startMonitoring(newTier => setTier(newTier));

        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

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
                    if (activeCard) {
                        const wrapper = activeCard.querySelector('[class*="videoWrapper"]');
                        if (wrapper) wrapper.click();
                    }
                    break;
                }
                case 'm':
                    e.preventDefault();
                    setMuted(prev => !prev);
                    break;
                case 'l':
                    e.preventDefault();
                    if (activeVideoIdRef.current) handleLike(activeVideoIdRef.current);
                    break;
                case 'c':
                    e.preventDefault();
                    if (activeCommentVideoIdRef.current) {
                        setActiveCommentVideoId(null);
                    } else if (activeVideoIdRef.current) {
                        setActiveCommentVideoId(activeVideoIdRef.current);
                    }
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
    }, []); // Stable — uses refs for mutable values

    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        feedManager.configure({ token, videoType: 'flash', mood: activeCategory });
    }, [token, activeCategory, feedType]);

    useEffect(() => {
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
    const fetchInitialFeed = useCallback(async () => {
        setLoading(true);

        // YouTube Shorts Style - Fetch specific video by ID first if specified in URL
        if (urlVideoId) {
            try {
                const targetVid = await getVideoById(urlVideoId, token);
                if (targetVid) {
                    const formattedTarget = {
                        ...targetVid,
                        liked: targetVid.liked_by_user,
                        owner_followed: targetVid.owner?.is_following || false
                    };

                    feedManager.configure({ 
                        token, 
                        videoType: 'flash', 
                        mood: activeCategory, 
                        feedType 
                    });

                    const recommendedRaw = await feedManager.fetchFeed(15, activeCategory);
                    const formattedRecommended = formatClips(recommendedRaw || [], layerResponseRef.current);
                    const filteredRecommended = formattedRecommended.filter(v => v.id !== targetVid.id);

                    const combined = [formattedTarget, ...filteredRecommended];
                    setClips(combined);
                    setActiveVideoId(targetVid.id);
                    setLoading(false);
                    feedManager.resetConsumption();
                    return;
                }
            } catch (err) {
                console.error('[Flash] Specific video fetch failed:', err.message);
                // Fallback to normal loading if dynamic video fetch fails
            }
        }

        // If a category is active, use semantic category endpoint
        if (activeCategory) {
            try {
                const raw = await getCategoryVideos(activeCategory, 'flash', 30);
                if (Array.isArray(raw) && raw.length > 0) {
                    const formatted = formatClips(raw, layerResponseRef.current);
                    setClips(formatted);
                    setActiveVideoId(formatted[0].id);
                } else {
                    setClips([]);
                }
            } catch (err) {
                console.error('[Flash] Category fetch failed:', err.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        // Normal feed flow
        feedManager.configure({ 
            token, 
            videoType: 'flash', 
            mood: activeCategory, 
            feedType 
        });

        const stale = feedManager.fetchWithStaleWhileRevalidate((freshVideos) => {
            const formatted = formatClips(freshVideos, layerResponseRef.current);
            setClips(formatted);
            if (formatted.length > 0) setActiveVideoId(formatted[0].id);
        });

        if (stale && stale.length > 0) {
            const formatted = formatClips(stale, layerResponseRef.current);
            setClips(formatted);
            setActiveVideoId(formatted[0].id);
            setLoading(false);
        } else {
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
    }, [activeCategory, feedType, token, urlVideoId]);

    useEffect(() => {
        fetchInitialFeed();
    }, [feedType, activeCategory]); 

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
    const handleTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        if (touchStartY.current === null) return;

        const deltaY = touchStartY.current - e.changedTouches[0].clientY;
        const deltaX = touchStartX.current - e.changedTouches[0].clientX;

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
            ? Math.min(currentIndex + 1, clips.length - 1)  
            : Math.max(currentIndex - 1, 0);                

        container.scrollTo({
            top: targetIndex * cardHeight,
            behavior: 'smooth',
        });

        touchStartY.current = null;
    };

    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (loading || clips.length === 0) return;

        const handleIntersection = (entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const id = entry.target.getAttribute('data-id');
                if (activeVideoId?.toString() !== id?.toString()) {
                    setLayerResponse(adaptiveDiscovery.recordSkip(id, activeCategory));
                    trackingManager.trackSkip(id);
                    setActiveVideoId(id);
                }

                const currentIndex = clips.findIndex(c => c.id.toString() === id?.toString());
                const remaining = clips.length - currentIndex;

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
    const visibleClips = useMemo(() => {
        const activeIndex = clips.findIndex(c => c.id.toString() === activeVideoId?.toString());
        const buffer = scrollVelocity > 1.5 ? 3 : 1;
        return clips.map((clip, index) => ({
            ...clip,
            shouldRender: Math.abs(activeIndex - index) <= buffer,
        }));
    }, [clips, activeVideoId, scrollVelocity]);

    const activeClip = useMemo(() => clips.find(c => c.id.toString() === activeVideoId?.toString()), [clips, activeVideoId]);

    useEffect(() => {
        if (activeClip?.title) {
            window.dispatchEvent(new CustomEvent('monteeq:update-title', { detail: activeClip.title }));
        }
    }, [activeClip?.title]);

    // Dynamic URL Sync (YouTube Shorts behavior)
    useEffect(() => {
        if (activeVideoId) {
            const currentPath = window.location.pathname;
            const expectedPath = `/flash/${activeVideoId}`;
            if (currentPath.startsWith('/flash') && currentPath !== expectedPath) {
                window.history.replaceState(null, '', expectedPath);
            }
        }
    }, [activeVideoId]);

    // ─────────────────────────────────────────────────────────────────────────
    const handleLike = useCallback(async (id) => {
        if (!token) {
            showNotification('info', 'Please log in to like videos');
            return;
        }
        setClips(prev => prev.map(c =>
            c.id === id
                ? { ...c, liked: !c.liked, likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1 }
                : c
        ));
        try {
            await likeVideo(id, token);
        } catch (err) {
            setClips(prev => prev.map(c =>
                c.id === id
                    ? { ...c, liked: !c.liked, likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1 }
                    : c
            ));
            showNotification('error', err?.message || 'Failed to like video');
        }
    }, [token, showNotification]);

    const handleShare = useCallback(async (id) => {
        const url = `${window.location.origin}/watch/${id}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Check this out on Monteeq', url });
            } else {
                await navigator.clipboard.writeText(url);
                showNotification('success', 'Link copied to clipboard!');
            }
            shareVideo(id).catch(() => {});
        } catch {}
    }, [showNotification]);

    const handleComment = useCallback((id) => {
        setActiveCommentVideoId(id);
    }, []);

    const handleToggleMute = useCallback(() => {
        setMuted(m => !m);
    }, []);

    const scrollNext = () => containerRef.current?.scrollBy({ top: containerRef.current.clientHeight, behavior: 'smooth' });
    const scrollPrev = () => containerRef.current?.scrollBy({ top: -containerRef.current.clientHeight, behavior: 'smooth' });

    // ─────────────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className={s.container}>
            {isDesktop && <DesktopSidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} feedType={feedType} setFeedType={handleFeedTypeChange} categories={categories} />}
            <div className={s.mainContent}><div className={s.feed}><FlashSkeleton /></div></div>
        </div>
    );

    return (
        <div className={s.container}>
            <SEO 
                title="Flash"
                description="Watch short, engaging vertical videos on Monteeq Flash. Discover the latest trends, creative edits, and amazing clips."
                canonical={`${window.location.origin}/flash`}
            />
            {isDesktop && <DesktopSidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} feedType={feedType} setFeedType={handleFeedTypeChange} categories={categories} />}

            <div className={s.mainContent}>
                <AmbientBackdrop videoThumbnail={activeClip?.thumbnail_url} tier={tier} />

                {isOffline && (
                    <div className={s.offlineBanner}>
                        📡 You're offline — showing cached feed
                    </div>
                )}

                <div
                    className={`${s.moodHint} ${layerResponse.shouldSuggestMoodSwitch ? s.moodHintVisible : ''}`}
                    onClick={() => setActiveCategory(layerResponse.suggestedMood)}
                >
                    <Sparkles size={20} color="var(--accent-primary)" />
                    <span>Switching to {layerResponse.suggestedMood?.toUpperCase()}? ⚡</span>
                </div>

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
                                    isActive={activeVideoId?.toString() === clip.id.toString()}
                                    onLike={handleLike}
                                    onComment={handleComment}
                                    onShare={handleShare}
                                    muted={muted}
                                    toggleMute={handleToggleMute}
                                    shouldRender={clip.shouldRender}
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
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', opacity: 0.5 }}>
                            <Zap size={24} className="animate-spin" />
                        </div>
                    )}
                </div>

                <div className={s.navControls}>
                    <button className={s.navBtn} onClick={scrollPrev}><ChevronUp size={28} /></button>
                    <button className={s.navBtn} onClick={scrollNext}><ChevronDown size={28} /></button>
                </div>
            </div>

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
