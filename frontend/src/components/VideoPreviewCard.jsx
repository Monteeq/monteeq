import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, AlertTriangle, Loader2, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStreamUrl } from '../utils/streamUrl';
import { useWatchLater, useAddToWatchLater, useRemoveFromWatchLater } from '../hooks/useLibrary';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useQueryClient } from '@tanstack/react-query';

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

// Safety: reset the pool count whenever the page regains focus
// (catches cases where unmount cleanup was skipped during tab switch)
if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => HlsPool.reset(), { once: false });
}

const VideoPreviewCard = React.memo(React.forwardRef(({ video, onClick, variant = 'grid' }, ref) => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { showNotification } = useNotification();
    const { data: watchLaterData } = useWatchLater();
    const addToWatchLater = useAddToWatchLater();
    const removeFromWatchLater = useRemoveFromWatchLater();
    const queryClient = useQueryClient();

    const isSaved = watchLaterData?.items?.some(item => String(item.video.id) === String(video.id)) ?? false;
    const isAddingOrRemoving = addToWatchLater.isPending || removeFromWatchLater.isPending;

    // Cache watch history lookup
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

    const handleWatchLaterClick = async (e) => {
        e.stopPropagation();
        if (!token) {
            showNotification('info', 'Sign in to save videos to Watch Later');
            return;
        }
        try {
            if (isSaved) {
                await removeFromWatchLater.mutateAsync(video.id);
                showNotification('success', 'Removed from Watch Later');
            } else {
                await addToWatchLater.mutateAsync(video.id);
                showNotification('success', 'Saved to Watch Later');
            }
        } catch (err) {
            showNotification('error', err?.message || 'Failed to update Watch Later');
        }
    };

    const [showPreview, setShowPreview] = useState(false);
    const videoRef = useRef(null);
    const hoverTimerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const hlsRef = useRef(null);

    const handleMouseEnter = useCallback(() => {
        if (HlsPool.count >= HlsPool.MAX_CONCURRENT) {
            return;
        }
        // Debounce: only load video preview after 300ms of sustained hover
        hoverTimerRef.current = setTimeout(() => {
            if (HlsPool.count >= HlsPool.MAX_CONCURRENT) {
                return;
            }
            setShowPreview(true);
        }, 300);
    }, []);

    const handleMouseLeave = useCallback(() => {
        clearTimeout(hoverTimerRef.current);
        setShowPreview(false);
        setIsLoaded(false);
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => clearTimeout(hoverTimerRef.current);
    }, []);

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
                videoRef.current.src = '';
                videoRef.current.currentTime = 0;
            }
            return;
        }

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
            hls.attachMedia(videoRef.current);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                manifestParsed = true;
                HlsPool.count++;                          // only count after confirmed init
                videoRef.current?.play().catch(() => {});
            });

            hls.on(Hls.Events.FRAG_LOADED, () => {
                hls.stopLoad();
            });

            // If HLS errors before manifest, release cleanly
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    hls.destroy();
                    hlsRef.current = null;
                }
            });
        } else {
            videoRef.current.src = streamUrl;
            videoRef.current.play().catch(() => {});
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
                if (manifestParsed) HlsPool.release();  // only release if we incremented
            }
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.src = '';
            }
        };
    }, [showPreview, video.video_url, video.id]);

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
            navigate(`/profile/${video.owner.username}`);
        }
    };

    return (
        <div
            ref={ref}
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


                    {/* Video Preview — only mounts after debounced hover */}
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
                            crossOrigin="anonymous"
                        />
                    )}

                    {isBuffering && showPreview && (
                        <div className="vc-buffering-overlay">
                            <Loader2 className="vc-spinner" size={24} />
                        </div>
                    )}

                    {/* Watch Later Button Overlay */}
                    <button
                        type="button"
                        className={`vc-watch-later-btn ${isSaved ? 'saved' : ''}`}
                        onClick={handleWatchLaterClick}
                        title={isSaved ? "Remove from Watch Later" : "Watch Later"}
                        aria-label={isSaved ? "Remove from Watch Later" : "Watch Later"}
                        disabled={isAddingOrRemoving}
                    >
                        {isAddingOrRemoving ? (
                            <Loader2 className="vc-spin" size={14} />
                        ) : (
                            <Bookmark
                                size={34}
                                color="currentColor"
                                stroke="currentColor"
                                fill={isSaved ? "currentColor" : "none"}
                                strokeWidth={2}
                            />
                        )}
                    </button>

                    {/* Duration Badge */}
                    {video.duration > 0 && (
                        <div className="vc-duration">
                            {formatDuration(video.duration)}
                        </div>
                    )}

                    {/* Watch Progress Bar */}
                    {(progressPercentage > 0 || isCompleted) && (
                        <div className="vc-progress-bar-container">
                            <div 
                                className="vc-progress-bar-fill"
                                style={{ width: `${isCompleted ? 100 : progressPercentage}%` }}
                            />
                        </div>
                    )}



                    {/* Status Overlays */}
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

                    {/* Hover indicator */}
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
                </div>
            </div>
        </div>
    );
}));

VideoPreviewCard.displayName = 'VideoPreviewCard';

export default VideoPreviewCard;

