import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Monitor, Square, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import styles from './VideoPlayer.module.css';
import { initView, sendHeartbeat, API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import PreRollPlayer from './ads/PreRollPlayer';
import PauseOverlayAd from './ads/PauseOverlayAd';

const VideoPlayer = ({ 
  src, 
  poster, 
  autoPlay = false, 
  onTimeUpdate, 
  isTheaterMode = false, 
  toggleTheaterMode,
  videoId
}) => {
  const { token, user } = useAuth();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const progressBarRef = useRef(null);
  
  // View Tracking Refs
  const viewTicketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [osd, setOsd] = useState({ icon: null, visible: false });
  const [isBuffering, setIsBuffering] = useState(false);
  
  const isPremium = user?.is_premium;
  const [showPreRoll, setShowPreRoll] = useState(false);
  
  useEffect(() => {
    if (isPremium) setShowPreRoll(false);
  }, [isPremium]);

  const controlsTimeout = useRef(null);

  // Use direct CDN URL for streaming (consistent with VideoPlayerV2)
  const streamUrl = useMemo(() => src, [src]);

  // Initialize HLS
  useEffect(() => {
    if (!videoRef.current) return;

    const sourceToUse = streamUrl;

    if (Hls.isSupported() && sourceToUse?.includes('.m3u8')) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });
      let recoveryAttempts = 0;
      hls.loadSource(sourceToUse);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) videoRef.current.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (recoveryAttempts >= 3) return;
          recoveryAttempts++;
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

      return () => {
        hls.destroy();
      };
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoRef.current.src = sourceToUse;
      if (autoPlay) videoRef.current.play().catch(() => {});
    } else {
      // Fallback for standard MP4
      videoRef.current.src = sourceToUse;
    }
  }, [streamUrl, autoPlay]);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'k':
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
          e.preventDefault();
          seek(-10);
          break;
        case 'l':
          e.preventDefault();
          seek(10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
          e.preventDefault();
          toggleTheaterMode?.();
          break;
        case ',': // Frame Back
          e.preventDefault();
          stepFrame(-1);
          break;
        case '.': // Frame Forward
          e.preventDefault();
          stepFrame(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheaterMode]);

  // Heartbeat Mechanism
  useEffect(() => {
    if (!videoId) return;

    const startHeartbeat = async () => {
      if (!viewTicketRef.current || !sessionIdRef.current) {
        try {
          const res = await initView(videoId, token);
          if (res.ticket) {
            viewTicketRef.current = res.ticket;
            sessionIdRef.current = res.session_id;
            console.log("View session initialized:", res.session_id);
          }
        } catch (err) {
          console.error("Failed to initialize view session:", err);
          return;
        }
      }

      // Send immediate first heartbeat or wait 10s
      heartbeatIntervalRef.current = setInterval(async () => {
        if (viewTicketRef.current && sessionIdRef.current) {
          try {
            await sendHeartbeat(videoId, sessionIdRef.current, viewTicketRef.current);
          } catch (err) {
            console.error("Heartbeat failed:", err);
            // If session expired, we might want to re-init
          }
        }
      }, 10000);
    };

    if (isPlaying) {
      startHeartbeat();
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isPlaying, videoId, token]);

  // Methods
  const togglePlay = useCallback(() => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      triggerOSD(<Play fill="white" />);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerOSD(<Pause fill="white" />);
    }
  }, []);

  const seek = (seconds) => {
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
    triggerOSD(seconds > 0 ? <ChevronRight /> : <ChevronLeft />);
  };

  const stepFrame = (frames) => {
    const FPS = 24; // Standard cinematic framerate
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + (frames / FPS)));
    triggerOSD(<Monitor size={20} />);
  };

  const triggerOSD = (icon) => {
    setOsd({ icon, visible: true });
    setTimeout(() => setOsd({ icon: null, visible: false }), 800);
  };

  const handleTimeUpdate = () => {
    const current = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(current);
    setDuration(dur);
    setProgress((current / dur) * 100);
    onTimeUpdate?.({ target: videoRef.current });
  };

  const handleProgressBarClick = (e) => {
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  const handleMouseMove = (e) => {
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = x / rect.width;
    setHoverTime(pos * videoRef.current.duration);
    setHoverX(x);

    // Show controls on mouse move
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      ref={containerRef}
      className={`${styles.playerWrapper} ${isTheaterMode ? styles.theaterMode : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className={styles.videoElement}
        poster={poster}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        playsInline
        crossOrigin="anonymous"
      />

      {isBuffering && (
        <div className={styles.bufferingOverlay}>
          <Loader2 className={styles.spinner} size={48} />
        </div>
      )}

      {/* Strategic Ads */}
      {showPreRoll && (
        <PreRollPlayer onComplete={() => {
            setShowPreRoll(false);
            videoRef.current.play();
            setIsPlaying(true);
        }} />
      )}

      {!isPlaying && !showPreRoll && currentTime > 0 && !isPremium && <PauseOverlayAd />}

      {/* OSD */}
      <div className={`${styles.osd} ${osd.visible ? styles.osdActive : ''}`}>
        {osd.icon}
      </div>

      {/* Custom Controls */}
      <div className={`${styles.controlsOverlay} ${showControls ? styles.visible : ''}`}>
        
        {/* Seek Bar */}
        <div 
          ref={progressBarRef}
          className={styles.seekBarContainer}
          onClick={handleProgressBarClick}
          onMouseMove={handleMouseMove}
        >
          <div className={styles.seekBarBg} />
          <div className={styles.seekBarProgress} style={{ width: `${progress}%` }} />
          <div className={styles.seekBarHandle} style={{ left: `${progress}%` }} />
          
          {hoverTime !== null && (
            <div className={styles.hoverPreview} style={{ left: hoverX }}>
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        <div className={styles.bottomControls}>
          <div className={styles.leftControls}>
            <button className={styles.controlButton} onClick={togglePlay}>
              {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
            </button>
            
            <div className={styles.volumeContainer}>
              <button className={styles.controlButton} onClick={() => {
                videoRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }}>
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange}
                className={styles.volumeSlider}
              />
            </div>

            <span className={styles.timeDisplay}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className={styles.rightControls}>
            <button 
              className={styles.controlButton} 
              onClick={toggleTheaterMode}
              title="Theater Mode (t)"
            >
              {isTheaterMode ? <Square size={20} /> : <Monitor size={20} />}
            </button>
            
            <button className={styles.controlButton} onClick={toggleFullscreen}>
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
