'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Bell, CheckCircle, Info, AlertCircle, Check, Clock, ChevronRight,
    Heart, MessageCircle, UserPlus, Zap, Sun, Trophy, ChevronDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import {
    getAllNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    isAbortOrNetworkError,
} from '@/lib/browserApi';
import s from '@/styles/components/NotificationDropdown.module.css';

const PAGE_SIZE = 15;
const POLL_INTERVAL = 15000;

const TYPE_CONFIG = {
    like:        { icon: Heart,        color: '#ff3b30', label: 'Like' },
    comment:     { icon: MessageCircle, color: '#2196f3', label: 'Comment' },
    follower:    { icon: UserPlus,     color: '#4caf50', label: 'Follower' },
    achievement: { icon: Trophy,       color: '#ffd700', label: 'Achievement' },
    status_change: { icon: Zap,        color: '#ff9500', label: 'Update' },
    morning:     { icon: Sun,          color: '#f59e0b', label: 'For You' },
    error:       { icon: AlertCircle,  color: '#ff3b30', label: 'Error' },
    info:        { icon: Info,         color: '#2196f3', label: 'Info' },
};

const getTypeConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.info;

const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const NotificationDropdown = ({ isOpen, onClose }) => {
    const { token } = useAuth();
    const { unreadCount, fetchUnreadCount, showAchievementCelebration } = useNotification();
    const router = useRouter();
    const dropdownRef = useRef(null);
    const listRef = useRef(null);

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    const fetchPage = useCallback(async (pageNum, replace = false) => {
        if (!token) return;
        try {
            const data = await getAllNotifications(token, pageNum * PAGE_SIZE, PAGE_SIZE);
            const items = Array.isArray(data) ? data : [];
            if (replace) {
                setNotifications(items);
            } else {
                setNotifications((prev) => [...prev, ...items]);
            }
            setHasMore(items.length === PAGE_SIZE);
        } catch (err) {
            if (!isAbortOrNetworkError(err)) {
                console.error('Failed to fetch notifications:', err);
            }
        }
    }, [token]);

    // Initial fetch + 15s poll while open
    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        setPage(0);
        setHasMore(true);
        fetchPage(0, true).finally(() => setLoading(false));

        const interval = setInterval(() => {
            fetchPage(0, true);
            fetchUnreadCount();
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [isOpen, fetchPage, fetchUnreadCount]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const handleLoadMore = useCallback(async () => {
        const nextPage = page + 1;
        setLoadingMore(true);
        await fetchPage(nextPage, false);
        setPage(nextPage);
        setLoadingMore(false);
    }, [page, fetchPage]);

    const handleMarkRead = useCallback(async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await markNotificationRead(token, id);
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
            fetchUnreadCount();
        } catch (err) {
            console.error('Failed to mark read:', err);
        }
    }, [token, fetchUnreadCount]);

    const handleMarkAllRead = useCallback(async () => {
        try {
            await markAllNotificationsRead(token);
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            fetchUnreadCount();
        } catch (err) {
            console.error('Failed to mark all read:', err);
        }
    }, [token, fetchUnreadCount]);

    const handleClick = useCallback((note) => {
        if (!note.is_read) {
            markNotificationRead(token, note.id).catch(() => {});
            setNotifications((prev) => prev.map((n) => (n.id === note.id ? { ...n, is_read: true } : n)));
            fetchUnreadCount();
        }
        onClose();
        if (note.type === 'achievement') {
            showAchievementCelebration(note);
            return;
        }
        if (note.link) router.push(note.link);
    }, [token, fetchUnreadCount, onClose, showAchievementCelebration, router]);

    if (!isOpen) return null;

    const hasUnread = notifications.some((n) => !n.is_read);

    return (
        <div className={s.dropdown} ref={dropdownRef}>
            <div className={s.header}>
                <div className={s.headerLeft}>
                    <span className={s.title}>Notifications</span>
                    {unreadCount > 0 && (
                        <span className={s.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </div>
                {hasUnread && (
                    <button className={s.markAllBtn} onClick={handleMarkAllRead}>
                        <Check size={13} />
                        Mark all read
                    </button>
                )}
            </div>

            <div className={s.list} ref={listRef}>
                {loading ? (
                    <div className={s.skeletonWrap}>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className={s.skeletonItem}>
                                <div className={s.skeletonIcon} />
                                <div className={s.skeletonText}>
                                    <div className={s.skeletonLine} style={{ width: `${70 + (i % 3) * 10}%` }} />
                                    <div className={s.skeletonLine} style={{ width: '40%' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className={s.empty}>
                        <Bell size={36} className={s.emptyIcon} />
                        <p className={s.emptyTitle}>No notifications yet</p>
                        <p className={s.emptySub}>We&apos;ll let you know when something happens.</p>
                    </div>
                ) : (
                    <>
                        {notifications.map((note) => {
                            const cfg = getTypeConfig(note.type);
                            const Icon = cfg.icon;
                            return (
                                <button
                                    key={note.id}
                                    className={`${s.item} ${note.is_read ? '' : s.unread}`}
                                    onClick={() => handleClick(note)}
                                >
                                    <div className={s.itemIcon} style={{ background: `${cfg.color}18` }}>
                                        <Icon size={15} style={{ color: cfg.color }} />
                                    </div>
                                    <div className={s.itemContent}>
                                        <p className={s.itemMessage}>{note.message}</p>
                                        <div className={s.itemMeta}>
                                            <Clock size={10} />
                                            <span>{timeAgo(note.created_at)}</span>
                                        </div>
                                    </div>
                                    {!note.is_read && <span className={s.unreadDot} />}
                                </button>
                            );
                        })}

                        {hasMore && (
                            <button
                                className={s.loadMoreBtn}
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? (
                                    <span className={s.loadMoreSpinner} />
                                ) : (
                                    <>
                                        <ChevronDown size={14} />
                                        Load more
                                    </>
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>

            <button className={s.viewAllBtn} onClick={() => { onClose(); router.push('/notifications'); }}>
                View all notifications
                <ChevronRight size={15} />
            </button>
        </div>
    );
};

export default NotificationDropdown;
