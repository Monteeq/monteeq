'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { markNotificationRead } from '@/lib/browserApi';

const NotificationManager = () => {
    const { token, user } = useAuth();
    const { showNotification, activeAchievement, showAchievementCelebration, fetchUnreadCount } = useNotification();

    useEffect(() => {
        if (!user || !token) return;

        const pollNotifications = async () => {
            try {
                // Use the centralized fetch which also updates unreadCount
                const notifications = await fetchUnreadCount();
                if (notifications && notifications.length > 0) {
                    for (const note of notifications) {
                        // If it's an achievement and we aren't already showing one
                        if (note.type === 'achievement') {
                            if (!activeAchievement) {
                                showAchievementCelebration(note);
                                // Don't mark as read yet, wait for user to see it
                            }
                        } else {
                            // Standard notification - show toast
                            showNotification(note.type || 'info', note.message, { link: note.link });

                            // Mark as read immediately after showing toast
                            try {
                                await markNotificationRead(token, note.id);
                            } catch (err) {
                                console.error("Failed to mark notification read:", err);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to poll notifications:", error);
            }
        };

        // Initial check on mount
        pollNotifications();

    }, [user, token, showNotification, activeAchievement, fetchUnreadCount, showAchievementCelebration]);

    return null;
};

export default NotificationManager;

