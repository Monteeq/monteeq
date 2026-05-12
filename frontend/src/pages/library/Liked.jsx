import React, { useState } from 'react';
import { Heart, Play, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLikedVideos, useToggleLike } from '../../hooks/useLibrary';
import { formatDuration } from '../../lib/format';
import s from './Library.module.css';

const Liked = () => {
    const navigate = useNavigate();
    const [category, setCategory] = useState('all');
    const { data, isLoading } = useLikedVideos(category);
    const toggleLike = useToggleLike();

    const categories = ['all', 'gaming', 'music', 'comedy', 'vlogs', 'live'];

    if (isLoading) return <div className="page-container"><div className="skeleton" style={{ height: '400px' }} /></div>;

    return (
        <div className="page-container">
            <header className={s.header}>
                <div className={s.titleGroup}>
                    <h1 className={s.pageTitle}>Liked Videos</h1>
                    {data?.total > 0 && <span className={s.countBadge}>{data.total} favorites</span>}
                </div>
            </header>

            <div className={s.filters}>
                {categories.map(cat => (
                    <button 
                        key={cat}
                        className={`category-chip ${category === cat ? 'active' : ''}`}
                        onClick={() => setCategory(cat)}
                    >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>

            {!data?.items || data.items.length === 0 ? (
                <div className="empty-state">
                    <Heart size={64} color="var(--accent-primary)" fill="var(--accent-primary)" style={{ opacity: 0.2 }} />
                    <h2>No liked videos yet</h2>
                    <p>Tap the heart on any video to save it to your collection.</p>
                    <button className="btn-primary" onClick={() => navigate('/home')}>Find Content</button>
                </div>
            ) : (
                <div className={s.gridContainer}>
                    {data.items.map(item => (
                        <div key={item.id} className="video-card-v2 vc-grid">
                            <div className="vc-thumbnail-area" onClick={() => navigate(`/watch/${item.video.id}`)}>
                                <img src={item.video.thumbnail_url} alt={item.video.title} />
                                <div className={s.duration}>{formatDuration(item.video.duration)}</div>
                                <div className="like-button-overlay liked">
                                    <Heart size={16} fill="currentColor" />
                                </div>
                                <div className={s.playOverlay}><Play size={48} fill="white" /></div>
                            </div>
                            <div className={s.infoArea}>
                                <div className={s.mainInfo}>
                                    <h3 className={s.videoTitle} onClick={() => navigate(`/watch/${item.video.id}`)}>
                                        {item.video.title}
                                    </h3>
                                    <p className={s.videoMeta}>{item.video.creator_name}</p>
                                </div>
                                <button 
                                    className="header-icon-btn" 
                                    style={{ color: 'var(--accent-primary)' }}
                                    onClick={() => toggleLike.mutate({ videoId: item.video.id, liked: true })}
                                >
                                    <Heart size={18} fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Liked;
