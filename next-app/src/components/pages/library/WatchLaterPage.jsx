'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Play, Trash2, LayoutGrid, List } from 'lucide-react';
import { useWatchLater, useRemoveFromWatchLater, useClearWatchLater } from '@/hooks/useLibrary';
import { formatDuration, formatRelativeTime } from '@/lib/format';
import s from '@/styles/pages/library/Library.module.css';

const WatchLater = () => {
    const router = useRouter();
    const { data, isLoading } = useWatchLater();
    const removeFromWatchLater = useRemoveFromWatchLater();
    const clearAll = useClearWatchLater();

    if (isLoading) return <div className="page-container"><div className="skeleton" style={{ height: '400px' }} /></div>;

    const stats = data?.stats || { total_videos: 0, total_runtime_seconds: 0, new_this_week: 0 };

    const handlePlayAll = () => {
        if (!data?.items || data.items.length === 0) return;

        const [first] = data.items;

        // Next.js has no location.state — hand off full playlist via sessionStorage
        try {
            sessionStorage.setItem('monteeq_watch_queue', JSON.stringify({
                queue: data.items.map(item => ({
                    id: item.video.id,
                    title: item.video.title,
                    thumbnail_url: item.video.thumbnail_url,
                    duration: item.video.duration,
                    creator_name: item.video.creator_name,
                })),
                queueSource: 'watchlater',
            }));
        } catch (_) { /* ignore quota / private mode */ }
        router.push(`/watch/${first.video.id}`);
    };

    return (
        <div className="page-container">
            <header className={s.header}>
                <div className={s.titleGroup}>
                    <h1 className={s.pageTitle}>Watch Later</h1>
                    <span className={s.countBadge}>{stats.total_videos} videos</span>
                </div>
                
                <div className={s.headerActions}>
                    <button
                        className="btn-primary"
                        onClick={handlePlayAll}
                        disabled={!data?.items || data.items.length === 0}
                    >
                        <Play size={18} fill="currentColor" /> Play all
                    </button>
                    <button className="btn-secondary" onClick={() => clearAll.mutate()} disabled={!stats.total_videos}>
                        Clear all
                    </button>
                </div>
            </header>

            <div className={`${s.statsBar} glass`}>
                <div className={s.statCard}>
                    <span className={s.statValue}>{stats.total_videos}</span>
                    <span className={s.statLabel}>Total Videos</span>
                </div>
                <div className={s.statCard}>
                    <span className={s.statValue}>{Math.round(stats.total_runtime_seconds / 60)}m</span>
                    <span className={s.statLabel}>Total Runtime</span>
                </div>
                <div className={s.statCard}>
                    <span className={s.statValue}>{stats.new_this_week}</span>
                    <span className={s.statLabel}>New This Week</span>
                </div>
            </div>

            {stats.total_videos === 0 ? (
                <div className="empty-state">
                    <Clock size={64} color="var(--text-dim)" />
                    <h2>Queue is empty</h2>
                    <p>No videos saved yet. Browse Monteeq and hit the clock icon to save videos.</p>
                    <button className="btn-primary" onClick={() => router.push('/home')}>Explore Videos</button>
                </div>
            ) : (
                <div className={s.gridContainer}>
                    {data.items.map(item => (
                        <div key={item.id} className="video-card-v2 vc-grid">
                            <div className="vc-thumbnail-area" onClick={() => router.push(`/watch/${item.video.id}`)}>
                                <img src={item.video.thumbnail_url} alt={item.video.title} />
                                <div className={s.duration}>{formatDuration(item.video.duration)}</div>
                                <div className={s.playOverlay}><Play size={48} fill="white" /></div>
                            </div>
                            <div className={s.infoArea}>
                                <div className={s.mainInfo}>
                                    <h3 className={s.videoTitle} onClick={() => router.push(`/watch/${item.video.id}`)}>
                                        {item.video.title}
                                    </h3>
                                    <p className={s.videoMeta}>{item.video.creator_name}</p>
                                    <p className={s.videoMeta}>Saved {formatRelativeTime(item.saved_at)}</p>
                                </div>
                                <button 
                                    className="header-icon-btn"
                                    onClick={() => removeFromWatchLater.mutate(item.video.id)}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WatchLater;
