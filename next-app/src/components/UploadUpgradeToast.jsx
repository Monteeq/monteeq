'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Zap, X } from 'lucide-react';

const DISMISS_KEY = 'monteeq_pro_toast_dismissed';

export default function UploadUpgradeToast({ isUploading, isPro, delayMs = 6000, onUpgrade }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isUploading || isPro || sessionStorage.getItem(DISMISS_KEY)) {
            setVisible(false);
            return;
        }
        const timer = setTimeout(() => setVisible(true), delayMs);
        return () => clearTimeout(timer);
    }, [isUploading, isPro, delayMs]);

    useEffect(() => {
        if (!isUploading) setVisible(false);
    }, [isUploading]);

    const dismiss = useCallback(() => {
        setVisible(false);
        sessionStorage.setItem(DISMISS_KEY, '1');
    }, []);

    if (!visible || isPro) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
                right: '20px',
                zIndex: 9999,
                maxWidth: '320px',
                width: 'calc(100% - 40px)',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                animation: 'toast-slide-up 0.3s ease-out',
            }}
        >
            <button
                onClick={dismiss}
                aria-label="Dismiss"
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    lineHeight: 1,
                }}
            >
                <X size={14} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div
                    style={{
                        flexShrink: 0,
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(255, 215, 0, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Zap size={16} style={{ color: '#ffd700' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '2px',
                        }}
                    >
                        Tired of waiting?
                    </div>
                    <div
                        style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            lineHeight: '1.4',
                            marginBottom: '10px',
                        }}
                    >
                        Pro members get faster upload processing and skip the queue.
                    </div>
                    <button
                        onClick={onUpgrade}
                        style={{
                            background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}
                    >
                        Upgrade to Pro →
                    </button>
                </div>
            </div>
        </div>
    );
}
