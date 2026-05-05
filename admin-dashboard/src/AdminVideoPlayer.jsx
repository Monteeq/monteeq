import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw } from 'lucide-react';
import './AdminVideoPlayer.css';

const AdminVideoPlayer = ({ 
  src, 
  title,
  creator,
  poster, 
  autoPlay = false,
  isHls: initialIsHls = false
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const controlsTimeout = useRef(null);

  // UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Initialize HLS / Video Source
  useEffect(() => {
    if (!videoRef.current || !src) return;

    const video = videoRef.current;
    const isHls = src.includes('.m3u8') || initialIsHls;
    let hls = null;

    if (Hls.isSupported() && isHls) {
      hls = new Hls({ capLevelToPlayerSize: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {});
      });
      
      return () => {
        if (hls) hls.destroy();
      };
    } else {
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
    }
  }, [src, autoPlay, initialIsHls]);

  // UI Helpers
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress((cur / dur) * 100);
  };

  const jump = (secs) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + secs));
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
      containerRef.current.requestFullscreen().catch(() => {});
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
      className="adminPlayerWrapper"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={(e) => e.target === e.currentTarget && togglePlay()}
    >
      <video
        ref={videoRef}
        className="adminVideoElement"
        poster={poster}
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
      />

      {/* Top Overlay (Credits) */}
      <div className={`adminTopOverlay ${showControls ? 'visible' : ''}`}>
        <h2 className="adminVideoTitle">{title}</h2>
        <p className="adminCreatorName">@{creator}</p>
      </div>

      {/* Center OSB */}
      <div className={`adminCentralControl ${!isPlaying ? 'visible' : ''}`}>
         <Play size={32} fill="white" />
      </div>

      {/* Controls Overlay */}
      <div className={`adminControlsOverlay ${showControls || !isPlaying ? 'visible' : ''}`}>
        
        {/* Progress Bar */}
        <div 
          ref={progressBarRef}
          className="adminSeekBarContainer"
          onClick={handleProgressBarClick}
        >
          <div className="adminSeekBarBg" />
          <div className="adminSeekBarProgress" style={{ width: `${progress}%` }} />
          <div className="adminSeekBarHandle" style={{ left: `${progress}%` }} />
        </div>

        {/* Bottom Bar */}
        <div className="adminBottomControls">
          <div className="adminControlGroup">
            <button className="adminControlBtn" onClick={togglePlay}>
              {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
            </button>
            <button className="adminControlBtn" onClick={() => jump(-10)}><RotateCcw size={18} /></button>
            <button className="adminControlBtn" onClick={() => jump(10)}><RotateCw size={18} /></button>
            
            <div className="adminVolumeWrapper">
              <button className="adminControlBtn" onClick={() => {
                const newMuted = !isMuted;
                setIsMuted(newMuted);
                videoRef.current.muted = newMuted;
              }}>
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                  if (v > 0) setIsMuted(false);
                }}
                className="adminVolumeSlider"
              />
            </div>

            <span className="adminTimeDisplay">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="adminControlGroup">
            <button className="adminControlBtn" onClick={toggleFullscreen}><Maximize size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVideoPlayer;
