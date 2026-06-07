import React, { useState, useMemo } from 'react';
import { 
    Clock, 
    Trash2, 
    Search as SearchIcon, 
    Play, 
    X,
    BookmarkPlus,
    CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    startOfDay, 
    subDays, 
    isAfter, 
    formatDistanceToNow 
} from 'date-fns';

import { 
    useHistory, 
    useClearHistory, 
    useRemoveFromHistory,
    useAddToWatchLater
} from '../../hooks/useLibrary';
import { formatDuration } from '../../lib/format';
import s from './Library.module.css';
const HistorySkeleton = () => (
    <div className="page-container">
        {[...Array(6)].map((_, i) => (
            <div key={i} style={{
                display: 'flex',
                gap: '12px',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div className="skeleton" style={{ width: 160, height: 90, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 16, width: '70%', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 13, width: '40%', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 13, width: '30%', borderRadius: 4 }} />
                </div>
            </div>
        ))}
    </div>
);

const History = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    const { 
        data, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage, 
        isLoading 
    } = useHistory(filter);

    const clearHistory = useClearHistory();
    const removeFromHistory = useRemoveFromHistory();
    const addToWatchLater = useAddToWatchLater();

    const { ref, inView } = useInView();

    React.useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleClearAll = () => {
        if (window.confirm('Are you sure you want to clear your entire watch history? This cannot be undone.')) {
            clearHistory.mutate();
        }
    };

    const groupedItems = useMemo(() => {
        if (!data?.pages) return {};
        
        const allItems = data.pages.flatMap(page => page.items);
        const filteredItems = searchQuery 
            ? allItems.filter(item => 
                item.video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.video.creator_name?.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : allItems;

        const groups = {};
        const now = new Date();
        const today = startOfDay(now);
        const yesterday = startOfDay(subDays(now, 1));
        const thisWeek = startOfDay(subDays(now, 7));
        const thisMonth = startOfDay(subDays(now, 30));

        filteredItems.forEach(item => {
            const date = new Date(item.watched_at);
            let label = 'Older';
            
            if (isAfter(date, today)) label = 'Today';
            else if (isAfter(date, yesterday)) label = 'Yesterday';
            else if (isAfter(date, thisWeek)) label = 'Earlier This Week';
            else if (isAfter(date, thisMonth)) label = 'Earlier This Month';

            if (!groups[label]) groups[label] = [];
            groups[label].push(item);
        });
        
        return groups;
    }, [data, searchQuery]);

    const totalCount = data?.pages[0]?.total || 0;

    if (isLoading) return <HistorySkeleton />;

    return (
        <div className="page-container">
            <header className={s.header}>
                <div className={s.titleGroup}>
                    <h1 className={s.pageTitle}>Watch History</h1>
                    {totalCount > 0 && <span className={s.countBadge}>{totalCount} videos</span>}
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
                    <button className="btn-danger" onClick={handleClearAll} disabled={!totalCount}>
                        <Trash2 size={18} /> <span className="desktop-only">Clear history</span>
                    </button>
                </div>
            </header>

            <div className={s.filters}>
                {[
                    { id: 'all', label: 'All' },
                    { id: 'today', label: 'Today' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' }
                ].map(f => (
                    <button 
                        key={f.id}
                        className={`category-chip ${filter === f.id ? 'active' : ''}`}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {totalCount === 0 && !isLoading ? (
                <div className="empty-state">
                    <Clock size={64} color="var(--text-dim)" />
                    <h2>Queue is empty</h2>
                    <p>Videos you watch will appear here automatically.</p>
                    <button className="btn-primary" onClick={() => navigate('/home')}>Explore Monteeq</button>
                </div>
            ) : (
                <div className={s.historyGroups}>
                    {Object.entries(groupedItems).map(([label, items]) => (
                        <section key={label} className={s.groupSection}>
                            <h2 className={s.groupLabel}>{label}</h2>
                            <div className={s.listContainer}>
                                <AnimatePresence mode='popLayout'>
                                    {items.map(item => (
                                        <motion.div 
                                            key={item.id} 
                                            layout
                                            initial={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="video-card-v2 vc-list"
                                        >
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
                                                        {item.video.creator_name || 'Monteeq Creator'} • {item.video.views?.toLocaleString()} views • {formatDistanceToNow(new Date(item.watched_at), { addSuffix: true })}
                                                    </p>
                                                    
                                                    {item.is_completed ? (
                                                        <div className={s.completedBadge}>
                                                            <CheckCircle2 size={14} />
                                                            <span>Fully watched</span>
                                                        </div>
                                                    ) : (
                                                        <span className={s.progressText}>
                                                            {Math.round((item.progress_seconds / item.video.duration) * 100)}% watched
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                <div className={s.cardActions}>
                                                    <button 
                                                        className="header-icon-btn" 
                                                        onClick={() => addToWatchLater.mutate(item.video.id)}
                                                        title="Watch Later"
                                                    >
                                                        <BookmarkPlus size={18} />
                                                    </button>
                                                    <button 
                                                        className="header-icon-btn" 
                                                        onClick={() => removeFromHistory.mutate(item.video.id)}
                                                        title="Remove from history"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </section>
                    ))}
                    
                    {/* Intersection Observer Trigger */}
                    <div ref={ref} style={{ height: '40px', display: 'flex', justifyContent: 'center' }}>
                        {isFetchingNextPage && <div className="spinner-small" />}
                    </div>
                </div>
            )}
        </div>
    );
};
export default History;
