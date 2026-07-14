"use client";

/**
 * AmbientBackdrop.jsx
 * Dynamic, performance-aware background glow for the vertical feed.
 */
import React, { useMemo } from 'react';
import { TIERS } from '@/services/adaptiveEngine';

const AmbientBackdrop = ({ videoThumbnail, tier }) => {
    
    // Performance Tiers styling mapper
    const styles = useMemo(() => {
        if (tier === TIERS.LOW) {
            return {
                background: 'linear-gradient(135deg, #0a0b0d 0%, #1a1c1e 100%)',
                filter: 'none',
                opacity: 1
            };
        }

        const blurAmount = '40px';

        return {
            backgroundImage: `url(${videoThumbnail})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: `blur(${blurAmount}) saturate(1.5) brightness(0.6)`,
            opacity: 0.4,
            animation: 'none'
        };
    }, [videoThumbnail, tier]);

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            backgroundColor: '#000'
        }}>
            <div style={{
                position: 'absolute',
                inset: '-10%',
                ...styles,
                transition: 'all 1s ease-in-out'
            }} />
            
            {/* Dark overlay to ensure contrast */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                zIndex: 1
            }} />
        </div>
    );
};

export default AmbientBackdrop;
