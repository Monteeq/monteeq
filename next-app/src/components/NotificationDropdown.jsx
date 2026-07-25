'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCircle, Info, AlertCircle, Check, Clock, ChevronRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import {
    getUnreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    isAbortOrNetworkError,
} from '@/lib/browserApi';
import s from '@/styles/components/NotificationDropdown.module.css';

const getIcon = (type) => {
    switch (type) {
        case 'achievement': return <CheckCircle size={16} className={s.iconAchievement} />;
        case 'error': return <AlertCircle size={16} className={s.iconError} />;
        case 'info': return <Info size={16} className={s.iconInfo} />;
        default: return <Bell size={16} className={s.iconDefault} />;
    }
};

const NotificationDropdown = ({ isOpen, onClose }) => {
    const { token, user } = useAuth();
    const { unreadCount, fetchUnreadCount, showAchievementCelebration } = useNotification();
    const router = useRouter();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setLoading(true);
        setNotifications([]);

        getUnreadNotifications(token)
            .then((data) => {
                if (cancelled) return;
                setNotifications(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                if (!cancelled && !isAbortOrNetworkError(err)) {
                    console.error('Failed to fetch notifications:', err);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [isOpen, token]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const handleMarkAllRead = useCallback(async () => {
        try {
            await markAllNotificationsRead(token);
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            fetchUnreadCount();
        } catch (err) {
            console.error('Failed to mark all read:', err);
        }
    }, [token, fetchUnreadCount]);

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

    const handleClick = useCallback((note) => {
        if (!note.is_read) handleMarkRead(note.id);
        onClose();
        if (note.type === 'achievement') {
            showAchievementCelebration(note);
            return;
        }
        if (note.link) router.push(note.link);
    }, [handleMarkRead, onClose, showAchievementCelebration, router]);

    const handleViewAll = useCallback(() => {
        onClose();
        router.push('/notifications');
    }, [onClose, router]);

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    if (!isOpen) return null;

    return (
        <div className={s.dropdown} ref={dropdownRef}>
            <div className={s.header}>
                <span className={s.title}>Notifications</span>
                {notifications.some((n) => !n.is_read) && (
                    <button className={s.markAllBtn} onClick={handleMarkAllRead}>
                        <Check size={14} />
                        Mark all read
                    </button>
                )}
            </div>

            <div className={s.list}>
                {loading ? (
                    <div className={s.empty}>
                        <div className={s.skeletonItem} />
                        <div className={s.skeletonItem} />
                        <div className={s.skeletonItem} />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className={s.empty}>
                        <Bell size={32} className={s.emptyIcon} />
                        <p className={s.emptyText}>No notifications yet</p>
                    </div>
                ) : (
                    notifications.map((note) => (
                        <button
                            key={note.id}
                            className={`${s.item} ${note.is_read ? '' : s.unread}`}
                            onClick={() => handleClick(note)}
                        >
                            <div className={s.itemIcon}>{getIcon(note.type)}</div>
                            <div className={s.itemContent}>
                                <p className={s.itemMessage}>{note.message}</p>
                                <span className={s.itemTime}>
                                    <Clock size={10} />
                                    {timeAgo(note.created_at)}
                                </span>
                            </div>
                            {!note.is_read && (
                                <span className={s.unreadDot} />
                            )}
                        </button>
                    ))
                )}
            </div>

            {!loading && notifications.length > 0 && (
                <button className={s.viewAllBtn} onClick={handleViewAll}>
                    View all notifications
                    <ChevronRight size={16} />
                </button>
            )}
        </div>
    );
};

export default NotificationDropdown;
