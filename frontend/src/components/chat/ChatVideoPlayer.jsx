import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import './ChatVideoPlayer.css';

const ChatVideoPlayer = ({ src }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const progressBarRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
        }
    }, [isMuted]);

    const togglePlay = useCallback((e) => {
        if (e) e.stopPropagation();
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
        } else {
            videoRef.current.pause();
        }
    }, []);

    const toggleMute = useCallback((e) => {
        if (e) e.stopPropagation();
        if (!videoRef.current) return;
        const newMuted = !videoRef.current.muted;
        videoRef.current.muted = newMuted;
        setIsMuted(newMuted);
    }, []);

    const jump = useCallback((secs, e) => {
        if (e) e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + secs));
        }
    }, []);

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const cur = videoRef.current.currentTime;
        const dur = videoRef.current.duration;
        setCurrentTime(cur);
        setDuration(dur || 0);
        setProgress(dur ? (cur / dur) * 100 : 0);
    };

    const handleProgressBarClick = (e) => {
        e.stopPropagation();
        if (!progressBarRef.current || !videoRef.current || !duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pos * duration;
    };

    const toggleFullscreen = (e) => {
        if (e) e.stopPropagation();
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const formatTime = (s) => {
        if (!s || isNaN(s)) return '0:00';
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <div 
            ref={containerRef} 
            className="chat-video-wrapper"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={togglePlay}
        >
            <video
                ref={videoRef}
                className="chat-video-element"
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onCanPlay={() => setIsBuffering(false)}
                playsInline
            />

            {isBuffering && (
                <div className="chat-video-buffering">
                    <Loader2 className="chat-video-spinner" size={24} />
                </div>
            )}

            <div className={`chat-video-central-play ${!isPlaying ? 'visible' : ''}`}>
                <Play size={28} fill="white" />
            </div>

            <div className={`chat-video-controls ${showControls || !isPlaying ? 'visible' : ''}`} onClick={e => e.stopPropagation()}>
                <div 
                    ref={progressBarRef}
                    className="chat-video-seekbar-container"
                    onClick={handleProgressBarClick}
                >
                    <div className="chat-video-seekbar-bg" />
                    <div className="chat-video-seekbar-progress" style={{ width: `${progress}%` }} />
                    <div className="chat-video-seekbar-handle" style={{ left: `${progress}%` }} />
                </div>

                <div className="chat-video-bottom-controls">
                    <div className="chat-video-control-group">
                        <button className="chat-video-btn" onClick={togglePlay}>
                            {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                        </button>
                        <button className="chat-video-btn" onClick={(e) => jump(-5, e)}>
                            <RotateCcw size={14} />
                        </button>
                        <button className="chat-video-btn" onClick={(e) => jump(5, e)}>
                            <RotateCw size={14} />
                        </button>
                        <button className="chat-video-btn" onClick={toggleMute}>
                            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <span className="chat-video-time">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    <div className="chat-video-control-group">
                        <button className="chat-video-btn" onClick={toggleFullscreen}>
                            <Maximize size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatVideoPlayer;
