import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { Heart, MessageCircle, Share2, Trophy, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { viewVideo } from '../api';
import { getStreamUrl } from '../utils/streamUrl';
import { useTrackHistory } from '../hooks/useLibrary';

// Services
import { metricsManager } from '../services/metricsManager';
import { adaptiveDiscovery } from '../services/adaptiveDiscovery';
import { trackingManager } from '../services/trackingManager';

import s from './FlashCard.module.css';

const FlashCard = ({
    video,
    isActive,
    onLike,
    onComment,
    onShare,
    muted,
    toggleMute,
    shouldRender = true
}) => {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const trackHistory = useTrackHistory();
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [hookProgress, setHookProgress] = useState(0);
    const [isEngaged, setIsEngaged] = useState(false);
    const [showHaptic, setShowHaptic] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const hlsRef = useRef(null);

    // Interaction Tracking
    const entryTime = useRef(0);

    // Smart Replay Config
    const isSmartMode = video.smart_replay || true;
    const smartStart = 0.25;
    const smartEnd = 0.85;

    useEffect(() => {
        if (!videoRef.current) return;
        let viewTimer = null;

        if (isActive) {
            videoRef.current.muted = muted;
            videoRef.current.play().catch(() => { });

            setPlaying(true);
            entryTime.current = Date.now();
            const vDuration = videoRef.current.duration || video.duration || 0;
            trackingManager.startSession(video.id, vDuration);

            // Count view after 3 seconds of active watching
            viewTimer = setTimeout(async () => {
                try {
                    await viewVideo(video.id);
                } catch (err) {
                    console.error("Failed to count view", err);
                }
            }, 3000);
        } else {
            if (playing && entryTime.current > 0) {
                const watchMs = Date.now() - entryTime.current;
                const curTime = Math.floor(videoRef.current?.currentTime || 0);
                const durTime = Math.floor(videoRef.current?.duration || video.duration || 0);

                metricsManager.trackWatchTime(video.id, watchMs);
                adaptiveDiscovery.recordWatch(video.id, watchMs, durTime * 1000, video.mood);
                trackingManager.endSession(video.id);

                // Persist history on exit
                if (curTime > 2) {
                    trackHistory.mutate({
                        video_id: video.id,
                        progress_seconds: curTime,
                        duration_seconds: durTime,
                        is_completed: curTime >= durTime * 0.9 && durTime > 0
                    });
                }
            }
            if (viewTimer) clearTimeout(viewTimer);

            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            setPlaying(false);
            setProgress(0);
            setIsEngaged(false);
        }

        return () => {
            if (viewTimer) clearTimeout(viewTimer);
        };
    }, [isActive, video.status, video.id, muted]);

    const handleTimeUpdate = (e) => {
        const { currentTime, duration } = e.target;
        if (duration > 0) {
            const ratio = currentTime / duration;
            setProgress(ratio * 100);
            setHookProgress(Math.min(currentTime / 3, 1) * 100);

            if (!isEngaged && ratio > 0.5) setIsEngaged(true);

            if (isSmartMode && currentTime >= duration * smartEnd) {
                const startTime = duration * smartStart;
                videoRef.current.currentTime = startTime;
            }
        }
    };

    const triggerHaptic = () => {
        setShowHaptic(true);
        setTimeout(() => setShowHaptic(false), 400);
    };

    const tapRef = useRef(0);
    const handleMainClick = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;

        const now = Date.now();
        if (now - tapRef.current < 300) {
            triggerHaptic();
            if (!video.liked) onLike(video.id);
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

    return (
        <div className={s.card}>
            <div className={s.ambientGlow} style={{ backgroundImage: `url(${video.thumbnail_url})` }} />
            <div className={s.hookBar} style={{ width: `${hookProgress}%`, opacity: hookProgress === 100 ? 0 : 1 }} />

            <div
                className={s.videoWrapper}
                onClick={handleMainClick}
            >
                {/* Background Layer (Static fallback if needed) */}

                <video
                    ref={videoRef}
                    loop={!isSmartMode}
                    playsInline
                    autoPlay
                    muted={muted}
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

                {isBuffering && (
                    <div className={s.bufferingOverlay}>
                        <Loader2 className={s.spinner} size={48} />
                    </div>
                )}

                <div className={`${s.hapticFlash} ${showHaptic ? s.flashActive : ''}`} />

                {video.status === 'pending' && (
                    <div className={s.statusOverlay}>
                        <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
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

                <div className={s.action} onClick={(e) => { e.stopPropagation(); onComment(video.id); }}>
                    <div className={s.iconCircle}><MessageCircle size={26} /></div>
                    <span className={s.label}>{video.comments_count || 0}</span>
                </div>

                <div className={s.action} onClick={(e) => { e.stopPropagation(); onShare(video.id); }}>
                    <div className={s.iconCircle}><Share2 size={24} /></div>
                    <span className={s.label}>{video.shares || 0}</span>
                </div>

                {video.tags?.includes('challenge') && (
                    <div className={s.action} onClick={(e) => { e.stopPropagation(); navigate('/challenges'); }}>
                        <div className={s.iconCircle}><Trophy size={26} color="#ffd700" /></div>
                        <span className={s.label}>Join</span>
                    </div>
                )}
            </div>

            {/* Overlay Info */}
            <div className={s.overlay}>
                <div className={s.usernameRow} onClick={(e) => { e.stopPropagation(); if (video.owner?.username) navigate(`/profile/${video.owner.username}`); }}>
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

            {/* Premium Progress Bar */}
            <div className={s.progressBar}>
                <div
                    className={`${s.progressFill} ${isEngaged ? s.progressEngaged : ''}`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Desktop Mute Control */}
            <button className={s.muteToggle} onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
                {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
        </div>
    );
};

export default FlashCard;
