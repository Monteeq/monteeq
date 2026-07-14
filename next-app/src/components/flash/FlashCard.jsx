"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import { Heart, MessageCircle, Share2, Trophy, Volume2, VolumeX, Loader2, Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { viewVideo } from '@/lib/clientApi';
import { getStreamUrl } from '@/lib/streamUrl';

// Services
import { adaptiveDiscovery } from '@/services/adaptiveDiscovery';
import { trackingManager } from '@/services/trackingManager';

import s from '@/styles/components/FlashCard.module.css';

const trackHistory = { mutate: () => {} };

const FlashCard = ({
    video,
    isActive,
    onLike,
    onComment,
    onShare,
    muted,
    toggleMute,
    shouldRender = true,
    onPrefetchComments,
}) => {
    const router = useRouter();
    const videoRef = useRef(null);
    const progressBarRef = useRef(null);
    const videoWasPlayingRef = useRef(false);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [hookProgress, setHookProgress] = useState(0);
    const [isEngaged, setIsEngaged] = useState(false);
    const [showHaptic, setShowHaptic] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [hearts, setHearts] = useState([]);
    const [videoDimensions, setVideoDimensions] = useState(null);
    const hlsRef = useRef(null);

    // Interaction Tracking
    const entryTime = useRef(0);

    // Smart Replay Config
    const isSmartMode = video.smart_replay || true;
    const smartStart = 0.25;
    const smartEnd = 0.85;

    // Stream Proxy URL
    const streamUrl = useMemo(() => getStreamUrl(video.video_url, video.id), [video.video_url, video.id]);

    useEffect(() => {
        setVideoDimensions(null);
    }, [video.id]);

    const handleMetadata = useCallback(() => {
        if (!videoRef.current) return;
        const { videoWidth, videoHeight } = videoRef.current;
        if (videoWidth > 0 && videoHeight > 0) {
            setVideoDimensions({ width: videoWidth, height: videoHeight });
        }
    }, []);

    // ─── Effect 1: HLS Initialisation ────────────────────────────────────────
    // Runs only when the video source or render eligibility changes.
    // Loads the manifest + starts buffering immediately, even before this card is active.
    useEffect(() => {
        if (!videoRef.current || !shouldRender) return;

        if (Hls.isSupported() && streamUrl?.includes('.m3u8')) {
            const hls = new Hls({
                capLevelToPlayerSize: false,
                startLevel: 0,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                lowLatencyMode: false,
                progressive: true,
                autoStartLoad: true,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(videoRef.current);
            hlsRef.current = hls;

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            break;
                    }
                }
            });
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = streamUrl;
            videoRef.current.load();
        } else {
            videoRef.current.src = streamUrl;
            videoRef.current.load();
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamUrl, shouldRender]);

    // ─── Effect 2: Play / Pause Control ──────────────────────────────────────
    // Runs when active state or mute changes. HLS is already loaded; just play or pause.
    useEffect(() => {
        if (!videoRef.current) return;
        let viewTimer = null;

        if (isActive) {
            videoRef.current.muted = muted;

            const hls = hlsRef.current;
            if (hls) {
                if (hls.media?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    videoRef.current.play().catch(() => {});
                } else {
                    hls.once(Hls.Events.MANIFEST_PARSED, () => {
                        videoRef.current?.play().catch(() => {});
                    });
                }
            } else {
                videoRef.current.play().catch(() => {});
            }

            setPlaying(true);
            entryTime.current = Date.now();
            const vDuration = videoRef.current.duration || video.duration || 0;
            trackingManager.startSession(video.id, vDuration);

            viewTimer = setTimeout(async () => {
                try {
                    await viewVideo(video.id);
                } catch (err) {
                    console.error('Failed to count view', err);
                }
            }, 3000);
        } else {
            if (playing && entryTime.current > 0) {
                const watchMs = Date.now() - entryTime.current;
                const curTime = Math.floor(videoRef.current?.currentTime || 0);
                const durTime = Math.floor(videoRef.current?.duration || video.duration || 0);

                trackingManager.trackWatchTime(video.id, watchMs);
                adaptiveDiscovery.recordWatch(video.id, watchMs, durTime * 1000, video.mood);
                trackingManager.endSession(video.id);

                if (curTime > 2) {
                    trackHistory.mutate({
                        video_id: video.id,
                        progress_seconds: curTime,
                        duration_seconds: durTime,
                        is_completed: curTime >= durTime * 0.9 && durTime > 0,
                    });
                }
            }

            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            setPlaying(false);
            setProgress(0);
            setIsEngaged(false);
        }

        return () => {
            if (viewTimer) clearTimeout(viewTimer);
        };
    }, [isActive, muted, video.id, video.status]);

    const handleTimeUpdate = (e) => {
        const { currentTime: curTime, duration: dur } = e.target;
        if (!isScrubbing) {
            if (dur > 0) {
                const ratio = curTime / dur;
                setProgress(ratio * 100);
                setHookProgress(Math.min(curTime / 3, 1) * 100);

                if (!isEngaged && ratio > 0.5) setIsEngaged(true);

                if (isSmartMode && curTime >= dur * smartEnd) {
                    const startTime = dur * smartStart;
                    videoRef.current.currentTime = startTime;
                }
            }
        }
    };

    const handlePointerDown = (e) => {
        if (!videoRef.current || !progressBarRef.current) return;
        const dur = videoRef.current.duration;
        if (!dur || dur === Infinity) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        setIsScrubbing(true);
        videoWasPlayingRef.current = !videoRef.current.paused;
        videoRef.current.pause();

        const rect = progressBarRef.current.getBoundingClientRect();
        let ratio = (e.clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        videoRef.current.currentTime = ratio * dur;
        setProgress(ratio * 100);
    };

    const handlePointerMove = (e) => {
        if (!isScrubbing || !videoRef.current || !progressBarRef.current) return;
        const dur = videoRef.current.duration;
        if (!dur || dur === Infinity) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        let ratio = (e.clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        videoRef.current.currentTime = ratio * dur;
        setProgress(ratio * 100);
    };

    const handlePointerUp = (e) => {
        if (!isScrubbing) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {
            console.error("Pointer capture release error", err);
        }
        setIsScrubbing(false);
        if (videoWasPlayingRef.current && videoRef.current) {
            videoRef.current.play().catch(() => {});
        }
    };

    const triggerHaptic = () => {
        setShowHaptic(true);
        setTimeout(() => setShowHaptic(false), 400);
    };

    const triggerDoubleTapLike = (e) => {
        if (!video.liked) {
            onLike(video.id);
        }

        const id = Date.now() + Math.random();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newHeart = {
            id,
            x,
            y,
            rotation: Math.random() * 40 - 20
        };

        setHearts((prev) => [...prev, newHeart]);

        setTimeout(() => {
            setHearts((prev) => prev.filter((h) => h.id !== id));
        }, 800);
    };

    const tapRef = useRef(0);
    const handleMainClick = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;

        const now = Date.now();
        if (now - tapRef.current < 300) {
            triggerHaptic();
            triggerDoubleTapLike(e);
        } else {
            if (videoRef.current) {
                if (videoRef.current.paused) {
                    videoRef.current.play();
                } else {
                    videoRef.current.pause();
                }
            }
        }
        tapRef.current = now;
    };

    const cardStyle = useMemo(() => {
        if (!videoDimensions) return {};
        const { width, height } = videoDimensions;
        return { aspectRatio: `${width} / ${height}` };
    }, [videoDimensions]);

    return (
        <div className={s.card} style={cardStyle}>
            <div className={s.ambientGlow} style={{ backgroundImage: `url(${video.thumbnail_url})` }} />
            <div className={s.hookBar} style={{ width: `${hookProgress}%`, opacity: hookProgress === 100 ? 0 : 1 }} />

            <div
                className={s.videoWrapper}
                onClick={handleMainClick}
            >
                {/* Background Layer (Static fallback if needed) */}

                {shouldRender ? (
                    <video
                        ref={videoRef}
                        preload="none"
                        loop={!isSmartMode}
                        playsInline
                        muted={muted}
                        onLoadedMetadata={handleMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        onWaiting={() => setIsBuffering(true)}
                        onPlaying={() => setIsBuffering(false)}
                        onCanPlay={() => setIsBuffering(false)}
                        onPlay={() => { setPlaying(true); setIsBuffering(false); }}
                        onPause={() => setPlaying(false)}
                        onEnded={() => { if (isActive) trackingManager.markReplayed(video.id); }}
                        className={s.video}
                        crossOrigin="anonymous"
                    />
                ) : (
                    <div 
                        style={{ 
                            backgroundImage: `url(${video.thumbnail_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            width: '100%',
                            height: '100%',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: 1
                        }} 
                    />
                )}

                {isBuffering && (
                    <div className={s.bufferingOverlay}>
                        <Loader2 className={s.spinner} size={48} />
                    </div>
                )}

                <div className={`${s.hapticFlash} ${showHaptic ? s.flashActive : ''}`} />

                {hearts.map((h) => (
                    <div
                        key={h.id}
                        className={s.doubleTapHeart}
                        style={{
                            left: `${h.x}px`,
                            top: `${h.y}px`,
                            transform: `translate(-50%, -50%) rotate(${h.rotation}deg)`
                        }}
                    >
                        <Heart size={80} fill="var(--accent-primary)" color="var(--accent-primary)" />
                    </div>
                ))}

                {video.status === 'pending' && (
                    <div className={s.statusOverlay}>
                        <Loader2 className={s.spinner} size={40} color="var(--accent-primary)" />
                    </div>
                )}
            </div>

            {/* Sidebar Actions */}
            <div className={s.sidebar}>
                <div className={`${s.action} ${video.liked ? s.liked : ''}`} onClick={(e) => { e.stopPropagation(); trackingManager.markLiked(video.id); onLike(video.id); }}>
                    <div className={s.iconCircle}>
                        <Heart size={26} fill={video.liked ? 'currentColor' : 'none'} />
                    </div>
                    <span className={s.label}>{video.likes_count || 0}</span>
                </div>

                <div
                    className={s.action}
                    onClick={(e) => { e.stopPropagation(); onComment(video.id); }}
                    onMouseEnter={() => onPrefetchComments?.(video.id)}
                    onPointerDown={() => onPrefetchComments?.(video.id)}
                >
                    <div className={s.iconCircle}><MessageCircle size={26} /></div>
                    <span className={s.label}>{video.comments_count || 0}</span>
                </div>

                <div className={s.action} onClick={(e) => { e.stopPropagation(); onShare(video.id); }}>
                    <div className={s.iconCircle}><Share2 size={24} /></div>
                    <span className={s.label}>{video.shares || 0}</span>
                </div>

                <div className={s.action} onClick={(e) => { e.stopPropagation(); console.log('Report flash', video.id); }}>
                    <div className={s.iconCircle}><Flag size={24} /></div>
                    <span className={s.label}>Report</span>
                </div>

                {video.tags?.includes('challenge') && (
                    <div className={s.action} onClick={(e) => { e.stopPropagation(); router.push('/challenges'); }}>
                        <div className={s.iconCircle}><Trophy size={26} color="#ffd700" /></div>
                        <span className={s.label}>Join</span>
                    </div>
                )}
            </div>

            {/* Overlay Info */}
            <div className={s.overlay}>
                <div className={s.usernameRow} onClick={(e) => { e.stopPropagation(); if (video.owner?.username) router.push(`/profile/${video.owner.username}`); }}>
                    <div className={s.avatar}>
                        {video.owner?.profile_pic ? (
                            <img src={video.owner.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{(video.owner?.username || '?')[0].toUpperCase()}</span>
                        )}
                    </div>
                    <span className={s.username}>@{video.owner?.username || 'user'}</span>
                </div>
                {(video.title || video.description) && (
                    <p className={s.caption}>{video.title || video.description}</p>
                )}
            </div>

            {/* Premium Progress Bar & Scrubbing Zone */}
            <div 
                ref={progressBarRef}
                className={`${s.progressBarContainer} ${isScrubbing ? s.scrubbing : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div className={s.progressBar}>
                    <div
                        className={`${s.progressFill} ${isEngaged ? s.progressEngaged : ''}`}
                        style={{ width: `${progress}%` }}
                    />
                    <div 
                        className={s.progressKnob} 
                        style={{ left: `${progress}%` }}
                    />
                </div>
            </div>



            {/* Desktop Mute Control */}
            <button className={s.muteToggle} onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
                {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
        </div>
    );
};

export default React.memo(FlashCard);
