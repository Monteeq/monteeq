'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getStreamUrl } from '@/utils/streamUrl';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import VideoCardMenu from './VideoCardMenu';

const HlsPool = {
    count: 0,
    MAX_CONCURRENT: 2,
    release() {
        this.count = Math.max(0, this.count - 1);
    },
    reset() {
        this.count = 0;
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => HlsPool.reset(), { once: false });
}

const VideoPreviewCard = React.memo(React.forwardRef(({ video, onClick, variant = 'grid' }, ref) => {
    const router = useRouter();
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const watchHistoryFromCache = React.useMemo(() => {
        if (!token) return null;
        const historyQueries = queryClient.getQueriesData({ queryKey: ['history'] });
        for (const [_, data] of historyQueries) {
            if (data?.pages) {
                const item = data.pages.flatMap(page => page.items || [])
                    .find(i => String(i.video?.id) === String(video.id));
                if (item) return item;
            } else if (data?.items) {
                const item = data.items.find(i => String(i.video?.id) === String(video.id));
                if (item) return item;
            }
        }
        return null;
    }, [queryClient, video.id, token]);

    const progressSeconds = video.progress_seconds ?? video.history?.progress_seconds ?? watchHistoryFromCache?.progress_seconds;
    const durationSeconds = video.duration_seconds ?? video.duration ?? video.history?.duration_seconds ?? watchHistoryFromCache?.duration_seconds ?? watchHistoryFromCache?.video?.duration;
    const isCompleted = video.is_completed ?? video.history?.is_completed ?? watchHistoryFromCache?.is_completed;

    const progressPercentage = React.useMemo(() => {
        if (!progressSeconds || !durationSeconds) return 0;
        const pct = (progressSeconds / durationSeconds) * 100;
        return Math.min(100, Math.max(0, pct));
    }, [progressSeconds, durationSeconds]);

    const [showPreview, setShowPreview] = useState(false);
    const videoRef = useRef(null);
    const hoverTimerRef = useRef(null);
    const cardRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const hlsRef = useRef(null);

    const hasPreviewUrl = !!(video.preview_url && video.preview_url.startsWith('http'));

    // ── Scroll-triggered preview via IntersectionObserver ──
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    if (!hasPreviewUrl && HlsPool.count >= HlsPool.MAX_CONCURRENT) return;
                    setShowPreview(true);
                } else {
                    setShowPreview(false);
                    setIsLoaded(false);
                }
            },
            { rootMargin: '200px', threshold: 0 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasPreviewUrl]);

    // ── Hover-triggered preview (kept for deliberate hover) ──
    const handleMouseEnter = useCallback(() => {
        if (!hasPreviewUrl && HlsPool.count >= HlsPool.MAX_CONCURRENT) return;
        hoverTimerRef.current = setTimeout(() => {
            if (!hasPreviewUrl && HlsPool.count >= HlsPool.MAX_CONCURRENT) return;
            setShowPreview(true);
        }, 300);
    }, [hasPreviewUrl]);

    const handleMouseLeave = useCallback(() => {
        clearTimeout(hoverTimerRef.current);
    }, []);

    useEffect(() => {
        return () => clearTimeout(hoverTimerRef.current);
    }, []);

    // ── Video source effect — MP4 preview or HLS fallback ──
    useEffect(() => {
        let manifestParsed = false;

        if (!showPreview || !videoRef.current) {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
                HlsPool.release();
            }
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.removeAttribute('src');
                videoRef.current.load();
            }
            return;
        }

        const el = videoRef.current;

        // Fast path: dedicated preview MP4 — no HLS.js needed
        if (hasPreviewUrl) {
            el.src = video.preview_url;
            el.load();
            return () => {
                el.pause();
                el.removeAttribute('src');
                el.load();
            };
        }

        // Fallback: full HLS manifest (old videos without preview asset)
        const streamUrl = getStreamUrl(video.video_url, video.id);
        if (!streamUrl) return;

        if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
            const hls = new Hls({
                capLevelToPlayerSize: true,
                autoStartLoad: true,
                maxBufferLength: 8,
                maxMaxBufferLength: 16,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(el);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                manifestParsed = true;
                HlsPool.count++;
                el.play().catch(() => {});
            });

            hls.on(Hls.Events.FRAG_LOADED, () => {
                hls.stopLoad();
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    hls.destroy();
                    hlsRef.current = null;
                }
            });
        } else {
            el.src = streamUrl;
            el.play().catch(() => {});
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
                if (manifestParsed) HlsPool.release();
            }
            el.pause();
            el.removeAttribute('src');
            el.load();
        };
    }, [showPreview, hasPreviewUrl, video.preview_url, video.video_url, video.id]);

    const formatDuration = (seconds) => {
        if (!seconds) return "";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatViews = (num) => {
        if (!num) return '0 views';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K views';
        return num + ' views';
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return "Just now";
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return "Just now";
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) return `${diffInDays}d ago`;
        if (diffInDays < 365) return Math.floor(diffInDays / 30) + 'mo ago';
        return Math.floor(diffInDays / 365) + 'y ago';
    };

    const handleAvatarClick = (e) => {
        e.stopPropagation();
        if (video.owner?.username) {
            router.push(`/profile/${video.owner.username}`);
        }
    };

    return (
        <div
            ref={(node) => {
                cardRef.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
            }}
            className={`video-card-v2 ${variant === 'list' ? 'vc-list' : 'vc-grid'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
        >
            {/* Thumbnail Section */}
            <div className="vc-thumbnail-area">
                <div className="vc-thumb-inner" style={{ aspectRatio: '16 / 9', background: 'var(--bg-raised)', overflow: 'hidden', position: 'relative' }}>
                    <img
                        src={video.thumbnail_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=60"}
                        alt={video.title}
                        className={`vc-img ${showPreview && isLoaded ? 'vc-img-hide' : ''}`}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    {showPreview && (
                        <video
                            ref={videoRef}
                            muted
                            loop
                            playsInline
                            onLoadedData={() => setIsLoaded(true)}
                            onWaiting={() => setIsBuffering(true)}
                            onPlaying={() => setIsBuffering(false)}
                            onCanPlay={() => setIsBuffering(false)}
                            className={`vc-video ${isLoaded ? 'vc-video-visible' : ''}`}
                            crossOrigin={hasPreviewUrl ? undefined : 'anonymous'}
                        />
                    )}

                    {isBuffering && showPreview && (
                        <div className="vc-buffering-overlay">
                            <Loader2 className="vc-spinner" size={24} />
                        </div>
                    )}

                    {video.duration > 0 && (
                        <div className="vc-duration">
                            {formatDuration(video.duration)}
                        </div>
                    )}

                    {(progressPercentage > 0 || isCompleted) && (
                        <div className="vc-progress-bar-container">
                            <div
                                className="vc-progress-bar-fill"
                                style={{ width: `${isCompleted ? 100 : progressPercentage}%` }}
                            />
                        </div>
                    )}

                    {video.status === 'pending' && (
                        <div className="vc-status pending">
                            <Loader2 className="vc-spin" size={24} />
                            <span>PROCESSING</span>
                        </div>
                    )}
                    {video.status === 'failed' && (
                        <div className="vc-status failed">
                            <AlertTriangle size={24} />
                            <span>FAILED</span>
                        </div>
                    )}

                    {showPreview && isLoaded && (
                        <div className="vc-play-indicator">
                            <Play size={12} fill="white" />
                        </div>
                    )}

                </div>
            </div>

            {/* Metadata Section */}
            <div className="vc-info-area">
                <div className="vc-info-flex">
                    {variant === 'grid' && (
                        <div className="vc-avatar" onClick={handleAvatarClick}>
                            {video.owner?.profile_pic ? (
                                <img src={video.owner.profile_pic} alt="" loading="lazy" />
                            ) : (
                                <span>{video.owner?.username?.[0].toUpperCase()}</span>
                            )}
                        </div>
                    )}

                    <div className="vc-text">
                        <h3 className="vc-title">{video.title}</h3>
                        <div className="vc-meta-wrap">
                            <div className="vc-channel" onClick={handleAvatarClick}>
                                {video.owner?.username || 'Unknown'}
                            </div>
                            <div className="vc-stats">
                                {formatViews(video.views)} • {formatTimeAgo(video.created_at)}
                            </div>
                        </div>
                    </div>

                    <VideoCardMenu videoId={video.id} placement="meta" />
                </div>
            </div>
        </div>
    );
}));

VideoPreviewCard.displayName = 'VideoPreviewCard';

export default VideoPreviewCard;
