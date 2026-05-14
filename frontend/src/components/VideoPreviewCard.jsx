import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStreamUrl } from '../utils/streamUrl';

const VideoPreviewCard = React.memo(React.forwardRef(({ video, onClick, variant = 'grid' }, ref) => {
    const navigate = useNavigate();
    const [showPreview, setShowPreview] = useState(false);
    const videoRef = useRef(null);
    const hoverTimerRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const hlsRef = useRef(null);

    const handleMouseEnter = useCallback(() => {
        // Debounce: only load video preview after 300ms of sustained hover
        hoverTimerRef.current = setTimeout(() => {
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
        if (showPreview && videoRef.current) {
            videoRef.current.play().catch(err => {
                console.warn("Preview autoplay failed:", err);
            });
        } else if (!showPreview && videoRef.current) {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [showPreview]);

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

                    {/* Duration Badge */}
                    {video.duration > 0 && (
                        <div className="vc-duration">
                            {formatDuration(video.duration)}
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

