'use client';

import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';

const DashboardBannerAd = ({ title, subtitle, cta, image }) => {
    return (
        <div style={{
            margin: '2rem 0',
            width: '100%',
            height: '140px',
            background: 'linear-gradient(90deg, #0a0a0a, #1a1a1a)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 60, 60, 0.15)',
            overflow: 'hidden',
            display: 'flex',
            position: 'relative'
        }}>
            {/* Background Accent */}
            <div style={{
                position: 'absolute',
                top: '-50%',
                left: '-10%',
                width: '60%',
                height: '200%',
                background: 'radial-gradient(circle, rgba(255, 60, 60, 0.05) 0%, transparent 70%)',
                zIndex: 0
            }} />

            <div style={{ 
                flex: 1, 
                padding: '0 2.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                zIndex: 1
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <Sparkles size={16} color="var(--accent-primary)" fill="var(--accent-primary)" />
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '2px' }}>PARTNER SPOTLIGHT</span>
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, marginBottom: '0.4rem' }}>{title || "Maximize Your Content Reach"}</h2>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{subtitle || "Join our partner network and get featured in the Monteeq Spotlight."}</p>
            </div>

            <div style={{ 
                padding: '0 2.5rem', 
                display: 'flex', 
                alignItems: 'center', 
                zIndex: 1 
            }}>
                <button 
                    onClick={() => window.open('#', '_blank')}
                    className="btn-active"
                    style={{
                        padding: '1rem 2rem',
                        borderRadius: '12px',
                        background: 'transparent',
                        border: '2px solid var(--accent-primary)',
                        color: 'var(--accent-primary)',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.8rem'
                    }}
                >
                    {cta || "GET FEATURED"} <ExternalLink size={18} />
                </button>
            </div>

            {/* Visual Element */}
            <div style={{ 
                width: '200px', 
                height: '100%', 
                background: `url(${image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=60'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.3,
                maskImage: 'linear-gradient(to left, black 60%, transparent)'
            }} />
        </div>
    );
};

export default DashboardBannerAd;
