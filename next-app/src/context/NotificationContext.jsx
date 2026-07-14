'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, Info, Loader2, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getUnreadNotifications, isAbortOrNetworkError } from '@/lib/browserApi';
import AchievementCelebrationModal from '@/components/AchievementCelebrationModal';

const NotificationContext = createContext(null);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const { token, user } = useAuth();
    const [activeAchievement, setActiveAchievement] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const unreadPollRef = useRef(null);
    const isMountedRef = useRef(true);

    const handleCloseAchievement = useCallback(async () => {
        if (activeAchievement && token) {
            try {
                // Background update, don't await/block UI
                const { markNotificationRead } = await import('@/lib/browserApi');
                markNotificationRead(token, activeAchievement.id).catch(err => {
                    console.error("Failed to mark achievement read:", err);
                });
            } catch (err) {
                console.error("Failed to load api for markNotificationRead:", err);
            }
        }
        setActiveAchievement(null);
    }, [activeAchievement, token]);

    useEffect(() => {
        return () => { isMountedRef.current = false; };
    }, []);

    // Centralized unread notification polling (single source of truth)
    const fetchUnreadCount = useCallback(async () => {
        if (!token) return;
        try {
            const data = await getUnreadNotifications(token);
            // Guard: if token was cleared while the request was in flight, discard the result
            if (!token) return;
            if (!isMountedRef.current) return;
            setUnreadCount(Array.isArray(data) ? data.length : 0);
            return data;
        } catch (e) {
            if (!token) return; // suppress 401s that fire after logout
            if (isAbortOrNetworkError(e)) {
                return [];
            }
            console.error('Failed to fetch unread notifications', e);
            return [];
        }
    }, [token]);

    useEffect(() => {
        if (!token || !user) {
            setUnreadCount(0);
            if (unreadPollRef.current) {
                clearInterval(unreadPollRef.current);
                unreadPollRef.current = null;
            }
            return;
        }
        fetchUnreadCount();
        // Poll every 120s — much lighter on the server
        unreadPollRef.current = setInterval(fetchUnreadCount, 120000);
        return () => {
            clearInterval(unreadPollRef.current);
            unreadPollRef.current = null;
        };
    }, [token, user, fetchUnreadCount]);

    const showNotification = useCallback((type, message, options = {}) => {
        const id = Math.random().toString(36).substr(2, 9);
        const { duration = 5000, progress = null, status = null, link = null } = options;

        const newNotification = { id, type, message, duration, progress, status, link };
        setNotifications(prev => [...prev, newNotification]);

        if (duration !== Infinity && type !== 'loading' && type !== 'processing') {
            setTimeout(() => {
                removeNotification(id);
            }, duration);
        }

        return id;
    }, []);

    const updateNotification = useCallback((id, updates) => {
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, ...updates } : n
        ));
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    return (
        <NotificationContext.Provider value={{
            showNotification,
            updateNotification,
            removeNotification,
            notifications,
            clearAll,
            activeAchievement,
            showAchievementCelebration: setActiveAchievement,
            unreadCount,
            fetchUnreadCount
        }}>
            {children}
            <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
            {activeAchievement && (
                <AchievementCelebrationModal 
                    achievement={activeAchievement} 
                    onClose={handleCloseAchievement} 
                />
            )}
        </NotificationContext.Provider>
    );
};

const NotificationContainer = ({ notifications, removeNotification }) => {
    return (
        <div style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            zIndex: 9999,
            pointerEvents: 'none'
        }}>
            {notifications.map(n => (
                <NotificationItem key={n.id} notification={n} onClose={() => removeNotification(n.id)} />
            ))}
        </div>
    );
};

const NotificationItem = ({ notification, onClose }) => {
    const { type, message, progress, status, link } = notification;
    const [displayProgress, setDisplayProgress] = useState(progress || 0);
    const navigate = useNavigate();

    // Smoothly increment displayProgress to catch up to actual progress
    useEffect(() => {
        if (progress === null) return;
        
        if (displayProgress < progress) {
            const timer = setInterval(() => {
                setDisplayProgress(prev => {
                    if (prev < progress) return prev + 1;
                    clearInterval(timer);
                    return prev;
                });
            }, 30); // ~33 increments per second
            return () => clearInterval(timer);
        } else if (displayProgress > progress) {
            // If progress resets (e.g. new phase), jump or catch up fast
            setDisplayProgress(progress);
        }
    }, [progress, displayProgress]);

    const getIcon = () => {
        const iconSize = 20;
        switch (type) {
            case 'success': return <CheckCircle size={iconSize} color="#4caf50" />;
            case 'error': return <AlertCircle size={iconSize} color="var(--accent-primary)" />;
            case 'info': return <Info size={iconSize} color="#2196f3" />;
            case 'loading':
            case 'processing': return <Loader2 size={iconSize} className="animate-spin" color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite, pulse-glow 2s ease-in-out infinite' }} />;
            default: return <Bell size={iconSize} />;
        }
    };

    const handleToastClick = () => {
        if (link) {
            navigate(link);
            onClose();
        }
    };

    const isPersistent = type === 'loading' || type === 'processing' || progress !== null;

    return (
        <div
            className={`glass notification-toast ${link ? 'clickable' : ''}`}
            onClick={handleToastClick}
            style={{
                minWidth: '320px',
                padding: '1.2rem',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                pointerEvents: 'auto',
                animation: 'slideIn 0.3s ease-out forwards',
                border: `1px solid ${type === 'error' ? 'rgba(255, 62, 62, 0.3)' : 'var(--border-glass)'}`,
                position: 'relative',
                overflow: 'hidden',
                cursor: link ? 'pointer' : 'default'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    {getIcon()}
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {status || (type === 'processing' ? 'Processing...' : type === 'loading' ? 'Loading...' : (type === 'achievement' ? 'Achievement Unlocked!' : message))}
                    </span>
                </div>
                {!isPersistent && (
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                    }}>×</button>
                )}
            </div>

            {(type === 'processing' || type === 'loading' || progress !== null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {type === 'processing' ? (message || 'Optimizing...') : 'Uploading...'}
                        </span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {progress !== null ? `${displayProgress}%` : ''}
                        </span>
                    </div>
                    
                    <div style={{ 
                        width: '100%', 
                        height: '6px', 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '10px', 
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                        <div style={{
                            width: `${displayProgress || 0}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--accent-primary), #ff6b6b)',
                            transition: 'width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)',
                            boxShadow: '0 0 15px rgba(255, 62, 62, 0.4)',
                            position: 'relative'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0, right: 0, bottom: 0,
                                width: '30px',
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                animation: 'shimmer 2s infinite'
                            }} />
                        </div>
                    </div>
                </div>
            )}

            {!isPersistent && type !== 'loading' && type !== 'processing' && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{message}</p>
            )}

            <style>{`
                @keyframes pulse-glow {
                    0% { filter: drop-shadow(0 0 2px rgba(255, 62, 62, 0.2)); }
                    50% { filter: drop-shadow(0 0 8px rgba(255, 62, 62, 0.6)); }
                    100% { filter: drop-shadow(0 0 2px rgba(255, 62, 62, 0.2)); }
                }
                @keyframes shimmer {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(300%); }
                }
                @keyframes slideIn {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .notification-toast {
                    backdrop-filter: blur(20px);
                    transition: transform 0.2s ease, background 0.2s ease;
                }
                .notification-toast.clickable:hover {
                    transform: scale(1.02);
                    background: rgba(255, 255, 255, 0.05);
                }
            `}</style>
        </div>
    );
};
