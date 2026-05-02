import React from 'react';
import { ExternalLink } from 'lucide-react';

const NativeFeedAd = React.memo(({ ad = {}, variant = 'grid' }) => {
    // Default ad content if none provided
    const content = {
        title: ad.title || "Experience Premium Performance",
        brand: ad.brand || "Monteeq Partners",
        image: ad.image || "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=800&q=60",
        cta: ad.cta || "LEARN MORE",
        url: ad.url || "#",
        description: ad.description || "Unleash your creative potential with our next-generation editing suite."
    };

    if (variant === 'flash') {
        return (
            <div 
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    background: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    fontFamily: "'Outfit', sans-serif"
                }}
                onClick={() => window.open(content.url, '_blank')}
            >
                {/* Background Image/Video Placeholder */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                    <img 
                        src={content.image} 
                        alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, transform: 'scale(1.05)', filter: 'blur(2px)' }} 
                    />
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 40%, transparent 60%, rgba(0,0,0,0.7) 100%)'
                    }} />
                </div>

                {/* Top Info Area */}
                <div style={{
                    position: 'absolute',
                    top: '80px',
                    left: '20px',
                    right: '20px',
                    zIndex: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{
                        background: 'rgba(255, 60, 60, 0.25)',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(20px)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid rgba(255, 60, 60, 0.4)',
                        boxShadow: '0 8px 32px rgba(255, 60, 60, 0.2)'
                    }}>
                        <Sparkles size={16} color="#ff3b30" fill="#ff3b30" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>SPONSORED</span>
                    </div>
                </div>

                {/* Sidebar Actions (Mimic FlashCard) */}
                <div style={{
                    position: 'absolute',
                    right: '20px',
                    bottom: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                    zIndex: 30
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(24px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer',
                            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }} className="hover-scale">
                            <ExternalLink size={26} color="white" />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>VISIT</span>
                    </div>
                </div>

                {/* Bottom Info Overlay */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '60px 24px 40px',
                    zIndex: 25,
                    color: '#fff',
                    background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.8) 50%, transparent 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '14px',
                            border: '2px solid var(--accent-primary)',
                            padding: '4px',
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px var(--accent-primary-glow)'
                        }}>
                            <img src="/logo192.png" alt="" style={{ width: '90%', height: '90%', objectFit: 'contain' }} onError={(e) => e.target.src = 'https://ui-avatars.com/api/?name=' + content.brand[0] + '&background=ff3b30&color=fff'} />
                        </div>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.5px' }}>{content.brand}</span>
                    </div>
                    
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: '1.1', marginBottom: '12px', color: '#fff' }}>
                        {content.title}
                    </h3>

                    <p style={{ fontSize: '1rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '90%', fontWeight: 500 }}>
                        {content.description}
                    </p>
                    
                    <button 
                        className="btn-active"
                        style={{
                            width: '100%',
                            padding: '1.4rem',
                            borderRadius: '20px',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            letterSpacing: '1.5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #ff5e57 100%)',
                            boxShadow: '0 12px 40px rgba(255, 60, 60, 0.4)',
                            border: 'none',
                            color: 'white',
                            textTransform: 'uppercase'
                        }}
                    >
                        {content.cta} <ExternalLink size={20} strokeWidth={3} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div 
            className={`video-card-v2 ad-native ${variant === 'list' ? 'vc-list' : 'vc-grid'}`}
            onClick={() => window.open(content.url, '_blank')}
        >
            <div className="vc-thumbnail-area">
                <div className="vc-thumb-inner" style={{ background: 'linear-gradient(45deg, #1a1a1a, #2a2a2a)' }}>
                    <img
                        src={content.image}
                        alt={content.title}
                        className="vc-img"
                        style={{ opacity: 0.8 }}
                    />
                    
                    <div className="vc-status" style={{ 
                        background: 'rgba(255, 60, 60, 0.9)', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        top: '12px',
                        left: '12px',
                        bottom: 'auto',
                        width: 'auto'
                    }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '1px' }}>SPONSORED</span>
                    </div>

                    <div className="vc-play-indicator" style={{ background: 'var(--accent-primary)' }}>
                        <ExternalLink size={14} color="white" />
                    </div>
                </div>
            </div>

            <div className="vc-info-area">
                <div className="vc-info-flex">
                    <div className="vc-text">
                        <h3 className="vc-title" style={{ color: 'var(--text-primary)' }}>{content.title}</h3>
                        <div className="vc-meta-wrap">
                            <div className="vc-channel" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                                {content.brand}
                            </div>
                            <div className="vc-stats">
                                Sponsored Growth
                            </div>
                        </div>
                        <div style={{ marginTop: '0.8rem' }}>
                            <button className="btn-active" style={{ 
                                padding: '6px 16px', 
                                fontSize: '0.75rem', 
                                borderRadius: '50px',
                                background: 'transparent',
                                border: '1px solid var(--accent-primary)',
                                color: 'var(--accent-primary)',
                                fontWeight: 800
                            }}>
                                {content.cta}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

NativeFeedAd.displayName = 'NativeFeedAd';

export default NativeFeedAd;
