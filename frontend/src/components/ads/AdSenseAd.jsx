import React, { useEffect } from 'react';

const AdSenseAd = ({ client, slot, layoutKey, format = 'auto', responsive = 'true', style = {} }) => {
    useEffect(() => {
        try {
            // Check if adsbygoogle is available and execute
            if (window.adsbygoogle) {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            }
        } catch (e) {
            console.error('AdSense Error:', e);
        }
    }, []);

    // Placeholder if IDs are not provided
    const isPlaceholder = !client || client.includes('XXX');

    return (
        <div className="adsense-container" style={{ 
            minHeight: '100px', 
            width: '100%', 
            margin: '1rem 0',
            textAlign: 'center',
            background: isPlaceholder ? 'rgba(255,255,255,0.02)' : 'transparent',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: isPlaceholder ? '1px dashed rgba(255,255,255,0.1)' : 'none',
            overflow: 'hidden',
            ...style 
        }}>
            {isPlaceholder ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', padding: '2rem' }}>
                    AdSense Space
                </div>
            ) : (
                <ins 
                    className="adsbygoogle"
                    style={{ display: 'block', width: '100%', ...style }}
                    data-ad-client={client}
                    data-ad-slot={slot}
                    data-ad-format={format}
                    data-ad-layout-key={layoutKey}
                    data-full-width-responsive={responsive}
                ></ins>
            )}
        </div>
    );
};

export default AdSenseAd;
