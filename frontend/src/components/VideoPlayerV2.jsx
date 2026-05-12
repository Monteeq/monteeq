import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Square, Monitor, Settings, RotateCcw, RotateCw, AlertCircle, Loader2 } from 'lucide-react';
import './VideoPlayerV2.css';
import { initView, sendHeartbeat } from '../api';
import { useAuth } from '../context/AuthContext';
import PreRollPlayer from './ads/PreRollPlayer';
import PauseOverlayAd from './ads/PauseOverlayAd';
import { useTrackHistory } from '../hooks/useLibrary';

const VideoPlayerV2 = ({ 
  src, 
  videoId,
  title,
  creator,
  poster, 
  autoPlay = false,
  isTheaterMode = false,
  isCinematic = false,
  toggleTheaterMode,
  toggleCinematic
}) => {
  const { token, user } = useAuth();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const progressBarRef = useRef(null);
  const trackHistory = useTrackHistory();
  
  // Analytics & Sessions
  const viewTicketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  // UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(() => {
    return parseFloat(localStorage.getItem('monteeq_volume')) || 1;
  });
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState(null);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const isPremium = user?.is_premium;
  const [isPreRollActive, setIsPreRollActive] = useState(false);
  
  useEffect(() => {
    if (isPremium) setIsPreRollActive(false);
  }, [isPremium]);

  const [showTopCredits, setShowTopCredits] = useState(true);
  const controlsTimeout = useRef(null);

  // Sync volume with element on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, []);

  // Initialize HLS / Video Source
  useEffect(() => {
    if (!videoRef.current || !src) return;
    setError(null);

    const playVideo = () => {
        if (autoPlay && !isPreRollActive) {
            videoRef.current.play().catch(err => {
                console.log("Autoplay blocked or failed:", err);
            });
        }
    };

    if (Hls.isSupported() && src.endsWith('.m3u8')) {
      if (hlsRef.current) hlsRef.current.destroy();
      const hls = new Hls({ capLevelToPlayerSize: true });
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        playVideo();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError("Failed to load video stream.");
        }
      });

      return () => hls.destroy();
    } else {
      videoRef.current.src = src;
      playVideo();
    }
  }, [src, autoPlay, isPreRollActive]);

  // Analytics: View & Heartbeat + History Tracking
  useEffect(() => {
    if (!videoId || !isPlaying) {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      return;
    }

    const startSession = async () => {
      if (!viewTicketRef.current) {
        try {
          const res = await initView(videoId, token);
          viewTicketRef.current = res.ticket;
          sessionIdRef.current = res.session_id;
        } catch (err) { console.error("Session init failed", err); }
      }

      heartbeatIntervalRef.current = setInterval(async () => {
        if (!videoRef.current) return;
        
        const curTime = Math.floor(videoRef.current.currentTime);
        const durTime = Math.floor(videoRef.current.duration);
        const isComp = curTime >= durTime * 0.9 && durTime > 0;

        // Heartbeat for analytics
        if (viewTicketRef.current && sessionIdRef.current) {
          try {
            await sendHeartbeat(videoId, sessionIdRef.current, viewTicketRef.current);
          } catch (err) { console.error("Heartbeat fail", err); }
        }

        // History tracking persistence
        if (token && curTime > 0) {
            trackHistory.mutate({
                video_id: videoId,
                progress_seconds: curTime,
                duration_seconds: durTime,
                is_completed: isComp
            });
        }
      }, 10000); // Sync history every 10s
    };

    startSession();
    return () => clearInterval(heartbeatIntervalRef.current);
  }, [isPlaying, videoId, token]);

  // Track on Exit
  useEffect(() => {
    return () => {
        if (videoRef.current && videoId && token) {
            const curTime = Math.floor(videoRef.current.currentTime);
            const durTime = Math.floor(videoRef.current.duration);
            if (curTime > 5) { // Only track if watched more than 5s
                trackHistory.mutate({
                    video_id: videoId,
                    progress_seconds: curTime,
                    duration_seconds: durTime,
                    is_completed: curTime >= durTime * 0.9 && durTime > 0
                });
            }
        }
    };
  }, [videoId, token]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          jump(5);
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          jump(-5);
          break;
        case 'arrowup':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
        case 'c':
          e.preventDefault();
          if (toggleCinematic) toggleCinematic();
          break;
        case 't':
          e.preventDefault();
          if (toggleTheaterMode) toggleTheaterMode();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTheaterMode, isCinematic, toggleTheaterMode, toggleCinematic, isPlaying, isMuted, volume]); 

  // UI Helpers
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, []);

  const changeVolume = (delta) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    videoRef.current.volume = newVol;
    localStorage.setItem('monteeq_volume', newVol.toString());
    if (newVol > 0) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress((cur / dur) * 100);
  };

  const jump = (secs) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + secs));
    }
  };

  const handleProgressBarClick = (e) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * duration;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const toggleFullscreen = () => {
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

  useEffect(() => {
    const t = setTimeout(() => setShowTopCredits(false), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`v2Wrapper ${isTheaterMode ? 'theater' : ''}`}
      onMouseMove={handleMouseMove}
      onClick={(e) => e.target === e.currentTarget && togglePlay()}
      itemScope 
      itemType="https://schema.org/VideoObject"
    >
      <meta itemProp="name" content={title} />
      <meta itemProp="thumbnailUrl" content={poster} />
      <meta itemProp="uploadDate" content={new Date().toISOString()} />
      
      <video
        ref={videoRef}
        className="videoElement"
        poster={poster}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onVolumeChange={(e) => {
          setVolume(e.target.volume);
          setIsMuted(e.target.muted);
        }}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => setError("Error loading video. Please try again.")}
        onClick={togglePlay}
        playsInline
        crossOrigin="anonymous"
        itemProp="contentUrl"
      />

      {isBuffering && (
        <div className="bufferingOverlayV2">
          <Loader2 className="spinnerV2" size={48} />
        </div>
      )}

      {error && (
        <div className="videoErrorOverlay">
          <AlertCircle size={48} color="#ff3b30" />
          <p>{error}</p>
          <button className="retryBtn" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {isPreRollActive && (
        <PreRollPlayer onComplete={() => {
          setIsPreRollActive(false);
          if (videoRef.current) {
              videoRef.current.play().catch(() => {});
          }
          setIsPlaying(true);
        }} />
      )}

      {!isPlaying && !isPreRollActive && currentTime > 0 && !isPremium && <PauseOverlayAd />}

      <div className={`topOverlay ${showTopCredits || showControls ? 'visible' : ''}`}>
        <h2 className="videoTitle">{title}</h2>
        <p className="creatorName">@{creator}</p>
      </div>

      <div className={`centralControl ${!isPlaying && !isPreRollActive ? 'visible' : ''}`}>
         <Play size={40} fill="white" />
      </div>

      <div className={`controlsOverlay ${showControls || !isPlaying ? 'visible' : ''}`}>
        
        <div 
          ref={progressBarRef}
          className="seekBarContainer"
          onClick={handleProgressBarClick}
        >
          <div className="seekBarBg" />
          <div className="seekBarProgress" style={{ width: `${progress}%` }} />
          <div className="seekBarHandle" style={{ left: `${progress}%` }} />
        </div>

        <div className="bottomControls">
          <div className="group">
            <button className="controlBtn" onClick={togglePlay}>
              {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
            </button>
            <button className="controlBtn" onClick={() => jump(-10)}><RotateCcw size={20} /></button>
            <button className="controlBtn" onClick={() => jump(10)}><RotateCw size={20} /></button>
            
            <div className="volumeWrapper">
              <button className="controlBtn" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    localStorage.setItem('monteeq_volume', v.toString());
                    if (v > 0) {
                        videoRef.current.muted = false;
                        setIsMuted(false);
                    }
                  }
                }}
                className="volumeSlider"
              />
            </div>

            <span className="timeDisplay">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="group">
            <button className="controlBtn" onClick={toggleTheaterMode} title="Theater Mode">
              {isTheaterMode ? <Square size={20} /> : <Monitor size={20} />}
            </button>
            <button className="controlBtn" onClick={toggleFullscreen}><Maximize size={22} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerV2;
