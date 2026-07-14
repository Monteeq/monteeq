"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, SkipForward, Volume2, VolumeX } from 'lucide-react';

const PreRollPlayer = ({ onComplete, adUrl }) => {
    const [timeLeft, setTimeLeft] = useState(10);
    const [canSkip, setCanSkip] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef(null);

    useEffect(() => {
        if (!adUrl) {
            onComplete();
        }
    }, [adUrl, onComplete]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onComplete();
                    return 0;
                }
                if (prev <= 7) setCanSkip(true); // Allow skip after 3 seconds
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onComplete]);

    const handleSkip = (e) => {
        e.stopPropagation();
        onComplete();
    };

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            fontFamily: "'Outfit', sans-serif"
        }}>
            <video
                ref={videoRef}
                src={adUrl || ''}
                autoPlay
                muted={isMuted}
                playsInline
                onError={onComplete}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* Top Info Area - Glassmorphic */}
            <div style={{
                position: 'absolute',
                top: '2rem',
                left: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                background: 'rgba(18, 20, 24, 0.4)',
                padding: '0.8rem 1.5rem',
                borderRadius: '16px',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
                <div style={{ 
                    width: '10px', 
                    height: '10px', 
                    borderRadius: '50%', 
                    background: 'var(--accent-primary)',
                    boxShadow: '0 0 15px var(--accent-primary-glow)',
                    animation: 'pulse 2s infinite'
                }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 900, letterSpacing: '2px', color: 'rgba(255,255,255,0.9)' }}>SPONSORED PRE-ROLL</span>
            </div>

            {/* Skip / Timer Section */}
            <div style={{
                position: 'absolute',
                bottom: '4rem',
                right: '3rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '1.2rem'
            }}>
                {canSkip ? (
                    <button 
                        onClick={handleSkip}
                        className="btn-active"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1.2rem 2.5rem',
                            borderRadius: '18px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: 'white',
                            fontWeight: 900,
                            fontSize: '1rem',
                            letterSpacing: '1px',
                            backdropFilter: 'blur(24px)',
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        SKIP AD <SkipForward size={20} fill="white" />
                    </button>
                ) : (
                    <div style={{
                        padding: '1.2rem 2.5rem',
                        borderRadius: '18px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '1rem',
                        backdropFilter: 'blur(10px)',
                        letterSpacing: '0.5px'
                    }}>
                        Video starts in <span style={{ color: 'var(--accent-primary)', marginLeft: '4px' }}>{timeLeft}s</span>
                    </div>
                )}
            </div>

            {/* Mute Toggle - Floating Glass */}
            <button 
                onClick={() => setIsMuted(!isMuted)}
                style={{
                    position: 'absolute',
                    bottom: '4rem',
                    left: '3rem',
                    background: 'rgba(18, 20, 24, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    padding: '1rem',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s ease'
                }}
            >
                {isMuted ? <VolumeX size={26} /> : <Volume2 size={26} />}
            </button>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default PreRollPlayer;
