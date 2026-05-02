import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Square, Monitor, Settings, RotateCcw, RotateCw } from 'lucide-react';
import './VideoPlayerV2.css';
import { initView, sendHeartbeat } from '../api';
import { useAuth } from '../context/AuthContext';
import PreRollPlayer from './ads/PreRollPlayer';
import PauseOverlayAd from './ads/PauseOverlayAd';

const VideoPlayerV2 = ({ 
  src, 
  videoId,
  title,
  creator,
  poster, 
  autoPlay = false,
  isTheaterMode = false,
  toggleTheaterMode 
}) => {
  const { token, user } = useAuth();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const progressBarRef = useRef(null);
  
  // Analytics & Sessions
  const viewTicketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  // UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  const isPremium = user?.is_premium;
  const [isPreRollActive, setIsPreRollActive] = useState(false);
  
  useEffect(() => {
    if (isPremium) setIsPreRollActive(false);
  }, [isPremium]);

  const [showTopCredits, setShowTopCredits] = useState(true);
  const controlsTimeout = useRef(null);

  // Initialize HLS
  useEffect(() => {
    if (!videoRef.current || !src) return;

    if (Hls.isSupported() && src.endsWith('.m3u8')) {
      const hls = new Hls({ capLevelToPlayerSize: true });
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay && !isPreRollActive) videoRef.current.play().catch(() => {});
      });

      return () => hls.destroy();
    } else {
      videoRef.current.src = src;
    }
  }, [src, autoPlay, isPreRollActive]);

  // Analytics: View & Heartbeat
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
        if (viewTicketRef.current && sessionIdRef.current) {
          try {
            await sendHeartbeat(videoId, sessionIdRef.current, viewTicketRef.current);
          } catch (err) { console.error("Heartbeat fail", err); }
        }
      }, 10000);
    };

    startSession();
    return () => clearInterval(heartbeatIntervalRef.current);
  }, [isPlaying, videoId, token]);

  // UI Helpers
  const togglePlay = useCallback(() => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = () => {
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress((cur / dur) * 100);
  };

  const jump = (secs) => {
    videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + secs));
  };

  const handleProgressBarClick = (e) => {
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

  // Hide top credits after 5s
  useEffect(() => {
    const t = setTimeout(() => setShowTopCredits(false), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="v2Wrapper"
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
        onClick={togglePlay}
        playsInline
        itemProp="contentUrl"
      />

      {/* Ads Integration */}
      {isPreRollActive && (
        <PreRollPlayer onComplete={() => {
          setIsPreRollActive(false);
          videoRef.current.play();
          setIsPlaying(true);
        }} />
      )}

      {/* Pause Ad */}
      {!isPlaying && !isPreRollActive && currentTime > 0 && !isPremium && <PauseOverlayAd />}

      {/* Top Credits Overlay */}
      <div className={`topOverlay ${showTopCredits || showControls ? 'visible' : ''}`}>
        <h2 className="videoTitle">{title}</h2>
        <p className="creatorName">@{creator}</p>
      </div>

      {/* Center OSB (Optional) */}
      <div className={`centralControl ${!isPlaying && !isPreRollActive ? 'visible' : ''}`}>
         <Play size={40} fill="white" />
      </div>

      {/* Controls */}
      <div className={`controlsOverlay ${showControls || !isPlaying ? 'visible' : ''}`}>
        
        {/* Progress Bar */}
        <div 
          ref={progressBarRef}
          className="seekBarContainer"
          onClick={handleProgressBarClick}
        >
          <div className="seekBarBg" />
          <div className="seekBarProgress" style={{ width: `${progress}%` }} />
          <div className="seekBarHandle" style={{ left: `${progress}%` }} />
        </div>

        {/* Bottom Bar */}
        <div className="bottomControls">
          <div className="group">
            <button className="controlBtn" onClick={togglePlay}>
              {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
            </button>
            <button className="controlBtn" onClick={() => jump(-10)}><RotateCcw size={20} /></button>
            <button className="controlBtn" onClick={() => jump(10)}><RotateCw size={20} /></button>
            
            <div className="volumeWrapper">
              <button className="controlBtn" onClick={() => setIsMuted(!isMuted)}>
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  videoRef.current.volume = v;
                  if (v > 0) setIsMuted(false);
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
