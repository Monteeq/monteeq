'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';

const NotificationManager = () => {
    const { token, user } = useAuth();
    const { showNotification, activeAchievement, showAchievementCelebration, fetchUnreadCount } = useNotification();
    const seenRef = useRef(new Set());
    const activeAchievementRef = useRef(activeAchievement);
    activeAchievementRef.current = activeAchievement;

    const handleNewNotifications = useCallback(async () => {
        try {
            const notifications = await fetchUnreadCount();
            if (!notifications || notifications.length === 0) return;

            for (const note of notifications) {
                if (seenRef.current.has(note.id)) continue;
                seenRef.current.add(note.id);

                if (note.type === 'achievement') {
                    if (!activeAchievementRef.current) {
                        showAchievementCelebration(note);
                    }
                } else {
                    showNotification(note.type || 'info', note.message, { link: note.link });
                }
            }
        } catch (error) {
            console.error('Failed to poll notifications:', error);
        }
    }, [fetchUnreadCount, showNotification, showAchievementCelebration]);

    useEffect(() => {
        if (!user || !token) return;

        // Initial check on mount — mark all current notifications as "seen" so we
        // don't blast toasts for old ones. Only truly new ones (arriving after mount)
        // will trigger toasts.
        fetchUnreadCount().then((notifications) => {
            if (notifications && Array.isArray(notifications)) {
                for (const note of notifications) {
                    seenRef.current.add(note.id);
                }
            }
        }).catch(() => {});

    }, [user, token, fetchUnreadCount]);

    return null;
};

export default NotificationManager;
