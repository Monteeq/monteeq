'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAllNotifications, markNotificationRead, markAllNotificationsRead, isAbortOrNetworkError } from '@/lib/browserApi';
import { useNotification } from '@/context/NotificationContext';
import { Bell, CheckCircle, Info, AlertCircle, Calendar, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NotificationSkeleton } from '@/components/Skeleton';

const Notifications = () => {
    const { token, user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showAchievementCelebration } = useNotification();

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const data = await getAllNotifications(token);
                setNotifications(data);
            } catch (error) {
                if (!isAbortOrNetworkError(error)) {
                    console.error("Failed to fetch notifications:", error);
                }
            } finally {
                setLoading(false);
            }
        };

        if (user && token) {
            fetchNotifications();
        }
    }, [user, token]);

    

const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation(); // Don't trigger navigation if clicking mark read
    try {
        await markNotificationRead(token, id);
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, is_read: true } : n
        ));
    } catch (error) {
        console.error("Failed to mark read:", error);
    }
};

const handleMarkAllRead = async () => {
    try {
        await markAllNotificationsRead(token);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
        console.error("Failed to mark all read:", error);
    }
};

const handleNotificationClick = (note) => {
    if (!note.is_read) {
        handleMarkAsRead(note.id);
    }

    if (note.type === 'achievement') {
        showAchievementCelebration(note);
        return;
    }

    if (note.link) {
        router.push(note.link);
    }
};

const getIcon = (type) => {
    switch (type) {
        case 'achievement': return <CheckCircle size={24} color="#4caf50" />;
        case 'error': return <AlertCircle size={24} color="var(--accent-primary)" />;
        case 'info': return <Info size={24} color="#2196f3" />;
        default: return <Bell size={24} color="var(--text-primary)" />;
    }
};

if (loading) {
    return <NotificationSkeleton />;
}

return (
    <div className="page-container">
        <div className="notifications-header">
            <div className="header-icon-container">
                <Bell size={32} color="var(--accent-primary)" />
            </div>
            <div style={{ flex: 1 }}>
                <h1>Notifications</h1>
                <p>Stay updated with your latest activity</p>
            </div>
            {notifications.some(n => !n.is_read) && (
                <button className="mark-all-btn glass" onClick={handleMarkAllRead}>
                    Mark all as read
                </button>
            )}
        </div>

        <div className="notifications-list">
            {notifications.length === 0 ? (
                <div className="empty-state-box">
                    <Bell size={48} className="empty-icon" />
                    <h3>No notifications yet</h3>
                    <p>We'll let you know when something important happens!</p>
                </div>
            ) : (
                notifications.map((note) => (
                    <div
                        key={note.id}
                        className={`notification-item glass ${note.is_read ? 'read' : 'unread'} ${note.link ? 'clickable' : ''}`}
                        onClick={() => handleNotificationClick(note)}
                    >
                        <div className="notification-icon">
                            {getIcon(note.type)}
                        </div>
                        <div className="notification-content">
                            <p className="notification-message">{note.message}</p>
                            <div className="notification-meta">
                                <Calendar size={12} />
                                <span>{new Date(note.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                        {!note.is_read && (
                            <button
                                className="mark-read-btn"
                                onClick={(e) => handleMarkAsRead(note.id, e)}
                                title="Mark as read"
                            >
                                <Check size={16} />
                            </button>
                        )}
                    </div>
                ))
            )}
        </div>

        <style>{`
                .notifications-header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                    padding: 2rem;
                    background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%);
                    border-radius: 24px;
                    border: 1px solid var(--border-glass);
                }
                .header-icon-container {
                    width: 64px;
                    height: 64px;
                    background: rgba(245, 158, 11, 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
                }
                .notifications-header h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                }
                .notifications-header p {
                    color: var(--text-secondary);
                    font-size: 1.1rem;
                }

                .notifications-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .notification-item {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    padding: 1.5rem;
                    border-radius: 16px;
                    background: var(--bg-surface);
                    border: 1px solid var(--border-glass);
                    transition: all 0.2s ease;
                }
                
                .notification-item.clickable {
                    cursor: pointer;
                }
                
                .notification-item.clickable:hover {
                    background: rgba(255, 255, 255, 0.05);
                    transform: translateX(5px);
                }

                .notification-item.unread {
                    background: linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, rgba(255,255,255,0.02) 100%);
                    border-left: 4px solid var(--accent-primary);
                }

                .notification-icon {
                    min-width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .notification-content {
                    flex: 1;
                }

                .notification-message {
                    font-size: 1.1rem;
                    margin-bottom: 0.5rem;
                    line-height: 1.4;
                }

                .notification-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }

                .mark-read-btn {
                    padding: 8px;
                    border-radius: 50%;
                    border: 1px solid var(--border-glass);
                    background: rgba(255,255,255,0.05);
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .mark-read-btn:hover {
                    background: var(--accent-primary);
                    color: white;
                    border-color: var(--accent-primary);
                }

                .empty-state-box {
                    background: rgba(255,255,255,0.02);
                    border: 1px dashed var(--border-glass);
                    border-radius: 16px;
                    padding: 4rem 2rem;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }
                .empty-icon {
                    opacity: 0.2;
                    margin-bottom: 0.5rem;
                }
                
                .mark-all-btn {
                    padding: 0.8rem 1.5rem;
                    border-radius: 50px;
                    border: 1px solid var(--border-glass);
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .mark-all-btn:hover {
                    background: var(--accent-primary);
                    color: white;
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 20px rgba(255, 62, 62, 0.4);
                }
            `}</style>
        </div>
    );
};

export default Notifications;
