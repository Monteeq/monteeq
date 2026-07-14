"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Square, Monitor, Settings, RotateCcw, RotateCw, AlertCircle, Loader2, Crown, SkipBack, SkipForward } from 'lucide-react';
import '@/styles/components/VideoPlayerV2.css';
import { initView, sendHeartbeat } from '@/lib/clientApi';
import { getStreamUrl, getClientApiBaseUrl } from '@/lib/streamUrl';
import { useAuth } from '@/context/AuthContext';
import PreRollPlayer from '@/components/ads/PreRollPlayer';
import PauseOverlayAd from '@/components/ads/PauseOverlayAd';

// Resolution definitions: label, quality key for /stream-res, isPro gating
// 'src' key means use the master HLS stream (default)
const RESOLUTION_DEFS = [
  { label: '4K',    quality: '4k',    key: 'url_4k',    pro: true  },
  { label: '2K',    quality: '2k',    key: 'url_2k',    pro: true  },
  { label: '1080p', quality: '1080p', key: 'url_1080p', pro: true  },
  { label: '720p',  quality: '720p',  key: 'url_720p',  pro: false },
  { label: '480p',  quality: '480p',  key: 'url_480p',  pro: false },
];

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
  toggleCinematic,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  // Resolution URLs
  url_480p,
  url_720p,
  url_1080p,
  url_2k,
  url_4k,
}) => {
  const { token, user } = useAuth();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const progressBarRef = useRef(null);
  const trackHistory = { mutate: () => {} };

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
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const isPremium = user?.is_premium;
  const [isPreRollActive, setIsPreRollActive] = useState(!isPremium);
  const isPreRollActiveRef = useRef(isPreRollActive);
  useEffect(() => {
    isPreRollActiveRef.current = isPreRollActive;
  }, [isPreRollActive]);

  // Quality selector state — null means "Auto" (master HLS)
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState(null); // null = Auto/master
  const [currentAutoLabel, setCurrentAutoLabel] = useState('');
  const [detectedResolutions, setDetectedResolutions] = useState([]);
  const qualityMenuRef = useRef(null);
  const pendingSeekRef = useRef(null); // stores time to seek after quality switch

  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null); // 'rewind' | 'forward' | null
  const feedbackTimeoutRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const lastClickTimeRef = useRef(0);

  // Reset resolution states and trigger pre-roll ad when video changes
  useEffect(() => {
    setSelectedQuality(null);
    setDetectedResolutions([]);
    setCurrentAutoLabel('');
    setBufferedPercent(0);
    if (!isPremium) {
      setIsPreRollActive(true);
    } else {
      setIsPreRollActive(false);
    }
  }, [videoId, src, isPremium]);

  // Helper to map height to standard resolution definitions
  const getResolutionDetails = useCallback((height) => {
    if (height >= 2160) return { label: '4K', quality: '4k', pro: true };
    if (height >= 1440) return { label: '2K', quality: '2k', pro: true };
    if (height >= 1080) return { label: '1080p', quality: '1080p', pro: true };
    if (height >= 720) return { label: '720p', quality: '720p', pro: false };
    if (height >= 480) return { label: '480p', quality: '480p', pro: false };
    return { label: `${height}p`, quality: `${height}p`, pro: false };
  }, []);

  // Fallback resolutions from props in case Hls is not loaded/supported (Safari / native)
  const fallbackResolutions = useMemo(() => {
    const urlMap = { url_480p, url_720p, url_1080p, url_2k, url_4k };
    return RESOLUTION_DEFS.filter(r => !!urlMap[r.key]);
  }, [url_480p, url_720p, url_1080p, url_2k, url_4k]);

  // Combine detected and fallback resolutions
  const availableResolutions = useMemo(() => {
    return detectedResolutions.length > 0 ? detectedResolutions : fallbackResolutions;
  }, [detectedResolutions, fallbackResolutions]);

  // Determine the label to show on the settings button
  const selectedLabel = useMemo(() => {
    if (!selectedQuality) {
      return `Auto${currentAutoLabel ? ` (${currentAutoLabel})` : ''}`;
    }
    return availableResolutions.find(r => r.quality === selectedQuality)?.label || selectedQuality;
  }, [selectedQuality, currentAutoLabel, availableResolutions]);

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

  // Close quality menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Initialize HLS / Video Source
  useEffect(() => {
    if (!videoRef.current || !src) return;
    setError(null);

    // Save playback state before switching (should only happen on src/video change)
    const savedTime = videoRef.current.currentTime || 0;
    const wasPlaying = !videoRef.current.paused;

    if (savedTime > 0) {
      pendingSeekRef.current = savedTime;
    }

    const streamSrc = `${getStreamUrl(src, videoId)}${token ? `?token=${token}` : ''}`;
    const srcToUse = streamSrc || src;
    let recoveryAttempts = 0;

    const playAfterLoad = () => {
      if (!videoRef.current) return;
      if (pendingSeekRef.current !== null) {
        videoRef.current.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
      if ((autoPlay && !isPreRollActiveRef.current) || wasPlaying) {
        videoRef.current.play().catch(err => {
          console.log('Autoplay blocked or failed:', err);
        });
      }
    };

    const handleVideoResize = () => {
      if (videoRef.current) {
        const height = videoRef.current.videoHeight;
        if (height > 0) {
          setCurrentAutoLabel(`${height}p`);
        }
      }
    };

    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.addEventListener('resize', handleVideoResize);
    }

    if (Hls.isSupported() && srcToUse.includes('.m3u8')) {
      if (hlsRef.current) hlsRef.current.destroy();
      const hls = new Hls({
        capLevelToPlayerSize: false,
        startLevel: 0,           // start with lowest quality for fastest first frame
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        lowLatencyMode: false,
        progressive: true,       // start playing as soon as first segment arrives
        xhrSetup: (xhr, url) => {
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        }
      });
      hls.loadSource(srcToUse);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hls.startLoad(0); // preload from position 0 even before play
        // Detect exact available resolutions from HLS levels
        if (hls.levels && hls.levels.length > 0) {
          const levelsList = hls.levels.map((level, index) => {
            const details = getResolutionDetails(level.height);
            return {
              ...details,
              height: level.height,
              index,
            };
          });

          // Sort descending (highest quality first)
          levelsList.sort((a, b) => b.height - a.height);
          setDetectedResolutions(levelsList);

          // Cap resolution for free users
          if (!isPremium) {
            let maxAllowedIndex = -1;
            for (let i = 0; i < hls.levels.length; i++) {
              const lvl = hls.levels[i];
              if (lvl.height <= 720) {
                if (maxAllowedIndex === -1 || lvl.height > hls.levels[maxAllowedIndex].height) {
                  maxAllowedIndex = i;
                }
              }
            }
            if (maxAllowedIndex !== -1) {
              hls.autoLevelCapping = maxAllowedIndex;
              console.log(`[HLS] Capped resolution to level index ${maxAllowedIndex} (${hls.levels[maxAllowedIndex].height}p) for free user`);
            }
          }

          // Apply selected quality if one was pre-selected
          if (selectedQuality) {
            const levelIndex = hls.levels.findIndex(lvl => `${lvl.height}p` === selectedQuality);
            if (levelIndex !== -1) {
              hls.currentLevel = levelIndex;
            }
          }
        }
        playAfterLoad();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const levelIndex = data.level;
        const level = hls.levels[levelIndex];
        if (level) {
          setCurrentAutoLabel(`${level.height}p`);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (recoveryAttempts >= 3) {
            setError('Failed to load video stream.');
            return;
          }
          recoveryAttempts++;
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setError('Failed to load video stream.');
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
        if (videoEl) {
          videoEl.removeEventListener('resize', handleVideoResize);
        }
      };
    } else {
      // Direct MP4 / non-HLS stream
      videoRef.current.src = srcToUse;
      const onMeta = () => {
        playAfterLoad();
        videoRef.current.removeEventListener('loadedmetadata', onMeta);
      };
      videoRef.current.addEventListener('loadedmetadata', onMeta);
      videoRef.current.load();
      return () => {
        videoEl?.removeEventListener('loadedmetadata', onMeta);
        if (videoEl) {
          videoEl.removeEventListener('resize', handleVideoResize);
        }
      };
    }
  }, [src, autoPlay, videoId, token, isPremium, getResolutionDetails]);

  // Handle Hls.js level selection smoothly
  useEffect(() => {
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      const hls = hlsRef.current;
      if (!selectedQuality) {
        hls.currentLevel = -1;
        console.log('[HLS] Switched to Auto (ABR)');
      } else {
        const levelIndex = hls.levels.findIndex(lvl => `${lvl.height}p` === selectedQuality);
        if (levelIndex !== -1) {
          hls.currentLevel = levelIndex;
          console.log(`[HLS] Switched to manual level index ${levelIndex} (${hls.levels[levelIndex].height}p)`);
        }
      }
    }
  }, [selectedQuality]);

  // Handle non-HLS quality changes (MP4 direct stream fallback)
  useEffect(() => {
    if (hlsRef.current) return;

    if (videoRef.current && src && !src.includes('.m3u8')) {
      const savedTime = videoRef.current.currentTime || 0;
      const wasPlaying = !videoRef.current.paused;

      let streamSrc;
      if (selectedQuality) {
        const resDef = RESOLUTION_DEFS.find(r => r.quality === selectedQuality);
        const urlMap = { url_480p, url_720p, url_1080p, url_2k, url_4k };
        const qualityUrl = resDef ? urlMap[resDef.key] : null;
        if (qualityUrl) {
          streamSrc = `${getClientApiBaseUrl()}/videos/${videoId}/stream-res?quality=${selectedQuality}${token ? `&token=${token}` : ''}`;
        }
      } else {
        streamSrc = `${getStreamUrl(src, videoId)}${token ? `?token=${token}` : ''}`;
      }

      const srcToUse = streamSrc || src;
      if (srcToUse && videoRef.current.src !== srcToUse) {
        videoRef.current.src = srcToUse;
        videoRef.current.load();
        
        const onMetadata = () => {
          if (savedTime > 0) {
            videoRef.current.currentTime = savedTime;
          }
          if (wasPlaying) {
            videoRef.current.play().catch(e => console.log('Playback resume failed:', e));
          }
          videoRef.current.removeEventListener('loadedmetadata', onMetadata);
        };
        videoRef.current.addEventListener('loadedmetadata', onMetadata);
      }
    }
  }, [selectedQuality, src, videoId, token]);

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
      videoRef.current.play().catch(() => { });
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

    // Track how much is buffered
    if (dur > 0 && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBufferedPercent((bufferedEnd / dur) * 100);
    }
  };

  const jump = (secs) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + secs));
    }
  };

  const showDoubleTapFeedback = (type) => {
    setDoubleTapFeedback(type);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setDoubleTapFeedback(null);
    }, 600);
  };

  const handleVideoClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentTimeVal = Date.now();
    const timeDiff = currentTimeVal - lastClickTimeRef.current;

    if (timeDiff < 300) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;

      if (clickX < width / 2) {
        jump(-5);
        showDoubleTapFeedback('rewind');
      } else {
        jump(5);
        showDoubleTapFeedback('forward');
      }
      lastClickTimeRef.current = 0;
    } else {
      lastClickTimeRef.current = currentTimeVal;
      clickTimeoutRef.current = setTimeout(() => {
        setShowControls(prev => {
          const nextVal = !prev;
          if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
          if (nextVal && isPlaying) {
            controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
          }
          return nextVal;
        });
        clickTimeoutRef.current = null;
      }, 250);
    }
  };

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

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
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowControls(prev => {
            const nextVal = !prev;
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
            if (nextVal && isPlaying) {
              controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
            }
            return nextVal;
          });
        }
      }}
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
        onClick={handleVideoClick}
        playsInline
        crossOrigin="anonymous"
        itemProp="contentUrl"
      />

      {doubleTapFeedback && (
        <div className={`doubleTapFeedback ${doubleTapFeedback}`}>
          <div className="doubleTapIcon">
            {doubleTapFeedback === 'rewind' ? '◀◀ -5s' : '+5s ▶▶'}
          </div>
        </div>
      )}

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
        <PreRollPlayer
          onComplete={() => {
            setIsPreRollActive(false);
            if (videoRef.current) {
              videoRef.current.play().catch(() => { });
            }
            setIsPlaying(true);
          }}
          adUrl={null}
        />
      )}

      {!isPlaying && !isPreRollActive && currentTime > 0 && !isPremium && <PauseOverlayAd />}

      <div className={`topOverlay ${(showTopCredits || showControls) && !isPreRollActive ? 'visible' : ''}`}>
        <h2 className="videoTitle">{title}</h2>
        <p className="creatorName">@{creator}</p>
      </div>

      {/* Central controls overlay (Prev, Rewind 10s, Play/Pause, Forward 10s, Next) */}
      <div className={`centralControlsContainer ${(showControls || !isPlaying) && !isPreRollActive ? 'visible' : ''}`}>
        <button
          className={`centralBtn sideBtn ${!hasPrevious ? 'disabled' : ''}`}
          onClick={(e) => { e.stopPropagation(); if (hasPrevious) onPrevious(); }}
          disabled={!hasPrevious}
          title="Previous Video"
        >
          <SkipBack size={18} />
        </button>

        <button
          className="centralBtn sideBtn"
          onClick={(e) => { e.stopPropagation(); jump(-10); }}
          title="Rewind 10s"
        >
          <RotateCcw size={18} />
        </button>

        <button
          className="centralBtn mainPlayBtn"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" style={{ transform: 'translateX(2px)' }} />}
        </button>

        <button
          className="centralBtn sideBtn"
          onClick={(e) => { e.stopPropagation(); jump(10); }}
          title="Forward 10s"
        >
          <RotateCw size={18} />
        </button>

        <button
          className={`centralBtn sideBtn ${!hasNext ? 'disabled' : ''}`}
          onClick={(e) => { e.stopPropagation(); if (hasNext) onNext(); }}
          disabled={!hasNext}
          title="Next Video"
        >
          <SkipForward size={18} />
        </button>
      </div>

      <div className={`controlsOverlay ${(showControls || !isPlaying) && !isPreRollActive ? 'visible' : ''}`}>

        <div
          ref={progressBarRef}
          className="seekBarContainer"
          onClick={handleProgressBarClick}
        >
          <div className="seekBarBg" />
          <div className="seekBarBuffered" style={{ width: `${bufferedPercent}%` }} />
          <div className="seekBarProgress" style={{ width: `${progress}%` }} />
          <div className="seekBarHandle" style={{ left: `${progress}%` }} />
        </div>

        <div className="bottomControls">
          <div className="group">
            <div className="playControlsGroup">
              <button
                className={`controlBtn navSkipBtn ${!hasPrevious ? 'navSkipDisabled' : ''}`}
                onClick={hasPrevious ? onPrevious : undefined}
                title="Previous video"
                disabled={!hasPrevious}
              >
                <SkipBack size={22} />
              </button>
              <button className="controlBtn btn-playpause" onClick={togglePlay}>
                {isPlaying ? <Pause size={26} fill="white" /> : <Play size={26} fill="white" />}
              </button>
              <button
                className={`controlBtn navSkipBtn ${!hasNext ? 'navSkipDisabled' : ''}`}
                onClick={hasNext ? onNext : undefined}
                title="Next video"
                disabled={!hasNext}
              >
                <SkipForward size={22} />
              </button>
            </div>
            <button className="controlBtn btn-rewind" onClick={() => jump(-10)}><RotateCcw size={22} /></button>
            <button className="controlBtn btn-forward" onClick={() => jump(10)}><RotateCw size={22} /></button>
 
            <div className="volumeWrapper">
              <button className="controlBtn" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
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
            {/* Quality Selector */}
            {availableResolutions.length >= 1 && (
              <div className="qualitySelector" ref={qualityMenuRef}>
                <button
                  className="controlBtn qualityBtn"
                  onClick={(e) => { e.stopPropagation(); setShowQualityMenu(prev => !prev); }}
                  title="Video Quality"
                  id="quality-settings-btn"
                >
                  <Settings size={22} />
                  <span className="qualityLabel">
                    {selectedLabel}
                  </span>
                </button>

                {showQualityMenu && (
                  <div className="qualityMenu" onClick={e => e.stopPropagation()}>
                    <div className="qualityMenuHeader">
                      <Settings size={14} />
                      <span>Video Quality</span>
                    </div>

                    {/* Auto Option */}
                    <button
                      className={`qualityOption ${!selectedQuality ? 'qualityOptionActive' : ''}`}
                      onClick={() => {
                        setSelectedQuality(null);
                        setShowQualityMenu(false);
                      }}
                    >
                      <span className="qualityOptionLabel">
                        Auto{(!selectedQuality && currentAutoLabel) ? ` (${currentAutoLabel})` : ''}
                      </span>
                      {!selectedQuality ? (
                        <span className="qualityCheckmark">✓</span>
                      ) : null}
                    </button>

                    {availableResolutions.map(res => {
                      const isLocked = res.pro && !isPremium;
                      const isActive = selectedQuality === res.quality;
                      return (
                        <button
                          key={res.quality}
                          className={`qualityOption ${isActive ? 'qualityOptionActive' : ''} ${isLocked ? 'qualityOptionLocked' : ''}`}
                          onClick={() => {
                            if (isLocked) return;
                            setSelectedQuality(res.quality);
                            setShowQualityMenu(false);
                          }}
                          title={isLocked ? 'Pro membership required' : ''}
                        >
                          <span className="qualityOptionLabel">{res.label}</span>
                          {res.pro && (
                            <span className="qualityBadge qualityBadgePro">{res.label}</span>
                          )}
                          {isLocked ? (
                            <span className="qualityLockWrap">
                              <Crown size={13} className="qualityCrownIcon" />
                              <span className="qualityProTag">PRO</span>
                            </span>
                          ) : isActive ? (
                            <span className="qualityCheckmark">✓</span>
                          ) : null}
                        </button>
                      );
                    })}
                    {!isPremium && availableResolutions.some(r => r.pro) && (
                      <div className="qualityUpgradeBanner">
                        <Crown size={14} />
                        <span>Upgrade for 1080p, 2K & 4K</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button className="controlBtn btn-theater" onClick={toggleTheaterMode} title="Theater Mode">
              {isTheaterMode ? <Square size={22} /> : <Monitor size={22} />}
            </button>
            <button className="controlBtn btn-fullscreen" onClick={toggleFullscreen}><Maximize size={24} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerV2;
