import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    Trash2, 
    Search as SearchIcon, 
    MoreVertical, 
    Play, 
    X,
    Calendar,
    Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHistory, useClearHistory, useRemoveFromHistory } from '../../hooks/useLibrary';
import { formatRelativeTime, formatDuration } from '../../lib/format';
import s from './Library.module.css';

const History = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const { data, isLoading, isError } = useHistory(filter);
    const clearHistory = useClearHistory();
    const removeFromHistory = useRemoveFromHistory();

    const handleClearAll = () => {
        if (window.confirm('Are you sure you want to clear your entire watch history? This cannot be undone.')) {
            clearHistory.mutate();
        }
    };

    const groupedItems = React.useMemo(() => {
        if (!data?.items) return {};
        const groups = {};
        data.items.forEach(item => {
            const date = new Date(item.watched_at);
            let label = 'Older';
            const now = new Date();
            const diff = now - date;
            const days = diff / (1000 * 60 * 60 * 24);

            if (days < 1) label = 'Today';
            else if (days < 2) label = 'Yesterday';
            else if (days < 7) label = 'This Week';
            else if (days < 30) label = 'This Month';

            if (!groups[label]) groups[label] = [];
            groups[label].push(item);
        });
        return groups;
    }, [data]);

    if (isLoading) return <HistorySkeleton />;

    return (
        <div className="page-container">
            <header className={s.header}>
                <div className={s.titleGroup}>
                    <h1 className={s.pageTitle}>Watch History</h1>
                    {data?.total > 0 && <span className={s.countBadge}>{data.total} videos</span>}
                </div>
                
                <div className={s.headerActions}>
                    <div className="search-bar-container">
                        <SearchIcon size={18} className={s.searchIcon} />
                        <input 
                            type="text" 
                            placeholder="Search in history..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="btn-danger" onClick={handleClearAll} disabled={!data?.total}>
                        <Trash2 size={18} /> <span className="desktop-only">Clear all history</span>
                    </button>
                </div>
            </header>

            <div className={s.filters}>
                {['all', 'today', 'this_week', 'this_month'].map(f => (
                    <button 
                        key={f}
                        className={`category-chip ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f.replace('_', ' ').charAt(0).toUpperCase() + f.replace('_', ' ').slice(1)}
                    </button>
                ))}
            </div>

            {data?.total === 0 ? (
                <div className="empty-state">
                    <Clock size={64} color="var(--text-dim)" />
                    <h2>No history found</h2>
                    <p>Videos you watch will show up here.</p>
                    <button className="btn-primary" onClick={() => navigate('/home')}>Start Watching</button>
                </div>
            ) : (
                <div className={s.historyGroups}>
                    {Object.entries(groupedItems).map(([label, items]) => (
                        <section key={label} className={s.groupSection}>
                            <h2 className={s.groupLabel}>{label}</h2>
                            <div className={s.listContainer}>
                                {items.map(item => (
                                    <div key={item.id} className="video-card-v2 vc-list">
                                        <div className="vc-thumbnail-area" onClick={() => navigate(`/watch/${item.video.id}`)}>
                                            <img src={item.video.thumbnail_url} alt={item.video.title} />
                                            <div className={s.duration}>{formatDuration(item.video.duration)}</div>
                                            <div className={s.progressBar}>
                                                <div 
                                                    className={s.progressFill} 
                                                    style={{ width: `${(item.progress_seconds / item.video.duration) * 100}%` }}
                                                />
                                            </div>
                                            <div className={s.playOverlay}><Play size={32} fill="white" /></div>
                                        </div>
                                        <div className={s.infoArea}>
                                            <div className={s.mainInfo}>
                                                <h3 className={s.videoTitle} onClick={() => navigate(`/watch/${item.video.id}`)}>
                                                    {item.video.title}
                                                </h3>
                                                <p className={s.videoMeta}>
                                                    {item.video.creator_name} • {item.video.views} views • {formatRelativeTime(item.watched_at)}
                                                </p>
                                                {item.is_completed ? (
                                                    <span className={s.completedBadge}>Fully watched</span>
                                                ) : (
                                                    <span className={s.progressText}>
                                                        {Math.round((item.progress_seconds / item.video.duration) * 100)}% watched
                                                    </span>
                                                )}
                                            </div>
                                            <div className={s.cardActions}>
                                                <button 
                                                    className="header-icon-btn" 
                                                    onClick={() => removeFromHistory.mutate(item.video.id)}
                                                    title="Remove from history"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

const HistorySkeleton = () => (
    <div className="page-container">
        <div className={s.headerSkeleton}>
            <div className="skeleton" style={{ width: '200px', height: '32px' }} />
            <div className="skeleton" style={{ width: '300px', height: '40px', borderRadius: '20px' }} />
        </div>
        <div className={s.listContainer}>
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="video-card-v2 vc-list">
                    <div className="skeleton-thumbnail" />
                    <div style={{ flex: 1, padding: '1rem' }}>
                        <div className="skeleton" style={{ width: '60%', height: '20px', marginBottom: '1rem' }} />
                        <div className="skeleton" style={{ width: '40%', height: '14px' }} />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export default History;
