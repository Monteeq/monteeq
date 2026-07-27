"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import { Heart, MessageCircle, Share2, Trophy, Volume2, VolumeX, Loader2, Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { viewVideo } from '@/lib/clientApi';
import { getStreamUrl, fetchStreamSignedUrl } from '@/lib/streamUrl';
import { useTrackHistory } from '@/hooks/useLibrary';
import { useReport } from '@/context/ReportContext';

// Services
import { adaptiveDiscovery } from '@/services/adaptiveDiscovery';
import { trackingManager } from '@/services/trackingManager';

import s from '@/styles/components/FlashCard.module.css';

const FlashCard = ({
    video,
    isActive,
    onLike,
    onComment,
    onShare,
    muted,
    toggleMute,
    shouldRender = true,
    isWarm = false,
    prefetchedStreamUrl = null,
    isFastStart = false,
    onPrefetchComments,
}) => {
    const router = useRouter();
    const trackHistory = useTrackHistory();
    const { openReportModal } = useReport();
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
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const hlsRef = useRef(null);
    const wasRenderedRef = useRef(shouldRender);
    const wasWarmRef = useRef(isWarm);
    const hlsUrlRef = useRef(null);

    // Interaction Tracking
    const entryTime = useRef(0);

    // Smart Replay Config
    const isSmartMode = video.smart_replay || true;
    const smartStart = 0.25;
    const smartEnd = 0.85;

    // Stream URL — prefer prefetched signed URL, fall back to legacy proxy
    const legacyStreamUrl = useMemo(() => getStreamUrl(video.video_url, video.id), [video.video_url, video.id]);
    const streamUrl = prefetchedStreamUrl || legacyStreamUrl;

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

    const handleLoadedData = useCallback(() => {
        setHasLoadedOnce(true);
    }, []);

    // ─── Effect 1a: HLS Initialisation ──────────────────────────────────────
    // Creates HLS when shouldRender is true and no instance exists.
    // Instance is preserved when shouldRender toggles (warm pool).
    // Destroyed only on unmount (1b) or when leaving warm/render window (1c).
    useEffect(() => {
        if (!videoRef.current || !shouldRender || hlsRef.current) return;

        const url = prefetchedStreamUrl || legacyStreamUrl;
        if (!url) return;

        if (Hls.isSupported() && url?.includes('.m3u8')) {
            const hls = new Hls({
                capLevelToPlayerSize: false,
                startLevel: 0,
                maxBufferLength: isFastStart ? 5 : 10,
                maxMaxBufferLength: isFastStart ? 15 : 30,
                maxBufferSize: isFastStart ? 5 * 1024 * 1024 : 10 * 1024 * 1024,
                abrEwmaDefaultEstimate: 3000000,
                startFragPrefetch: true,
                lowLatencyMode: false,
                progressive: true,
                autoStartLoad: true,
            });
            hls.loadSource(url);
            hls.attachMedia(videoRef.current);
            hlsRef.current = hls;
            hlsUrlRef.current = url;

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (!data.fatal) return;
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR: {
                        // 403 → signed URL expired: refetch and reload
                        if (data.response?.code === 403) {
                            fetchStreamSignedUrl(video.id, null, null)
                                .then((result) => {
                                    if (hlsRef.current && videoRef.current) {
                                        hlsRef.current.destroy();
                                        const fresh = new Hls({
                                            capLevelToPlayerSize: false,
                                            startLevel: 0,
                                            maxBufferLength: isFastStart ? 5 : 10,
                                            maxMaxBufferLength: isFastStart ? 15 : 30,
                                            maxBufferSize: isFastStart ? 5 * 1024 * 1024 : 10 * 1024 * 1024,
                                            abrEwmaDefaultEstimate: 3000000,
                                            startFragPrefetch: true,
                                            lowLatencyMode: false,
                                            progressive: true,
                                            autoStartLoad: true,
                                        });
                                        fresh.loadSource(result.url);
                                        fresh.attachMedia(videoRef.current);
                                        hlsRef.current = fresh;
                                        hlsUrlRef.current = result.url;
                                    }
                                })
                                .catch(() => {});
                            break;
                        }
                        hls.startLoad();
                        break;
                    }
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        break;
                }
            });
        } else if (url) {
            videoRef.current.src = url;
            videoRef.current.load();
        }
    }, [legacyStreamUrl, prefetchedStreamUrl, shouldRender, isFastStart, video.id]);

    // ─── Effect 1b: HLS cleanup on unmount only ─────────────────────────────
    useEffect(() => {
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, []);

    // ─── Effect 1c: Destroy HLS when leaving warm or render window ───────────
    useEffect(() => {
        const leftRenderWindow = wasRenderedRef.current && !shouldRender;
        const leftWarmWindow = wasWarmRef.current && !isWarm;
        wasRenderedRef.current = shouldRender;
        wasWarmRef.current = isWarm;

        if ((leftRenderWindow || leftWarmWindow) && hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
            hlsUrlRef.current = null;
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
            setPlaying(false);
            setProgress(0);
            setHasLoadedOnce(false);
        }
    }, [shouldRender, isWarm]);

    // ─── Effect 2: Play / Pause Control ──────────────────────────────────────
    // When active: resume from current position (HLS already loaded).
    // When inactive AND warm: just pause, preserve position.
    // When inactive AND not warm: full reset (also handled by Effect 1c).
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
            if (!isWarm) {
                videoRef.current.currentTime = 0;
            }
            setPlaying(false);
            if (!isWarm) {
                setProgress(0);
            }
            setIsEngaged(false);
        }

        return () => {
            if (viewTimer) clearTimeout(viewTimer);
        };
    }, [isActive, muted, video.id, video.status, isWarm]);

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
                {/* Thumbnail poster — always behind video, fades out once first frame loads */}
                <div
                    className={`${s.thumbnailPoster} ${hasLoadedOnce ? s.thumbnailHidden : ''}`}
                    style={video.thumbnail_url
                        ? { backgroundImage: `url(${video.thumbnail_url})` }
                        : { backgroundColor: '#1c1c1e' }
                    }
                />

                {shouldRender ? (
                    <video
                        ref={videoRef}
                        preload="none"
                        loop={!isSmartMode}
                        playsInline
                        muted={muted}
                        onLoadedMetadata={handleMetadata}
                        onLoadedData={handleLoadedData}
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
                            backgroundImage: video.thumbnail_url ? `url(${video.thumbnail_url})` : undefined,
                            backgroundColor: video.thumbnail_url ? undefined : '#1c1c1e',
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

                {/* Cold-start loading indicator — small spinner, no dark background */}
                {isActive && !hasLoadedOnce && shouldRender && (
                    <div className={s.loadingOverlay}>
                        <Loader2 className={s.spinner} size={28} />
                    </div>
                )}

                {/* Mid-playback buffering — only after first frame has loaded */}
                {isBuffering && hasLoadedOnce && (
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

                <div className={s.action} onClick={(e) => { e.stopPropagation(); openReportModal('flash', video.id); }}>
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
