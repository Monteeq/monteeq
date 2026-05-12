import React from 'react';

export const VideoSkeleton = () => (
    <div className="video-item" style={{ width: '100%', marginBottom: '1.5rem' }}>
        <div className="skeleton skeleton-thumbnail" style={{ marginBottom: '0.8rem', borderRadius: '12px', aspectRatio: '16 / 9', width: '100%', height: 'auto' }} />

        <div style={{ display: 'flex', gap: '0.8rem', padding: '0 4px' }}>
            <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '90%', height: '1.2rem', marginBottom: '0.5rem', borderRadius: '4px' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%', height: '0.9rem', marginBottom: '0.3rem', borderRadius: '4px' }} />
                <div className="skeleton skeleton-text" style={{ width: '40%', height: '0.8rem', borderRadius: '4px' }} />
            </div>
        </div>
    </div>
);

export const FlashSkeleton = () => (
    <div className="flash-shelf-item" style={{ width: '100%' }}>
        <div className="skeleton skeleton-flash" style={{ position: 'relative', borderRadius: '12px' }}>
            <div style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                padding: '1rem',
                gap: '0.6rem',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)'
            }}>
                <div className="skeleton skeleton-text" style={{ width: '85%', height: '1rem', background: 'rgba(255,255,255,0.15)' }} />
                <div className="skeleton skeleton-text" style={{ width: '45%', height: '0.8rem', background: 'rgba(255,255,255,0.15)' }} />
            </div>
        </div>
    </div>
);

export const WatchSkeleton = () => (
    <div className="watch-container">
        <div className="watch-video-wrapper">
            <div className="skeleton" style={{ aspectRatio: '16/9', width: '100%', borderRadius: '0' }} />
        </div>
        <div className="watch-meta" style={{ padding: '1.5rem 1rem' }}>
            <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.8rem', marginBottom: '1.5rem', borderRadius: '4px' }} />

            <div className="glass" style={{ padding: '1.2rem', borderRadius: '12px', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)' }}>
                <div className="skeleton skeleton-text" style={{ width: '30%', height: '1rem', marginBottom: '1rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '100%', height: '1.2rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '100%', height: '1.2rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%', height: '1.2rem', marginBottom: '1rem' }} />
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ width: '60px', height: '1.2rem', borderRadius: '4px' }} />)}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                    <div style={{ flex: 1 }}>
                        <div className="skeleton skeleton-text" style={{ width: '120px', height: '1.1rem', marginBottom: '0.4rem' }} />
                        <div className="skeleton skeleton-text" style={{ width: '80px', height: '0.8rem' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '2rem' }} />)}
                </div>
            </div>

            <div className="comments-section" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '2rem' }}>
                <div className="skeleton skeleton-text" style={{ width: '150px', height: '1.5rem', marginBottom: '2rem' }} />
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    <div className="skeleton" style={{ flex: 1, height: '42px', borderRadius: '8px' }} />
                </div>
            </div>
        </div>
    </div>
);

export const ProfileHeaderSkeleton = () => (
    <div style={{ marginTop: '1.5rem', padding: '3rem 2rem', borderRadius: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="skeleton" style={{ width: '160px', height: '160px', borderRadius: '50%' }} />
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="skeleton skeleton-text" style={{ width: '40%', height: '2.5rem', borderRadius: '8px' }} />
            <div className="skeleton skeleton-text" style={{ width: '20%', height: '1rem', borderRadius: '4px' }} />

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.5rem' }}>
                <div className="skeleton" style={{ width: '160px', height: '48px', borderRadius: '50px' }} />
                <div className="skeleton" style={{ width: '160px', height: '48px', borderRadius: '50px' }} />
                <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
            </div>

            <div className="skeleton skeleton-text" style={{ width: '60%', height: '1.1rem', marginTop: '1rem', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', width: '100%', maxWidth: '800px' }}>
            {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ flex: 1, padding: '1rem', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="skeleton skeleton-text" style={{ width: '40px', height: '1.5rem', borderRadius: '4px' }} />
                    <div className="skeleton skeleton-text" style={{ width: '60px', height: '0.7rem', borderRadius: '2px' }} />
                </div>
            ))}
        </div>
    </div>
);

export const FeaturedSkeleton = () => (
    <div style={{ margin: '2rem 1.5rem' }}>
        <div className="skeleton" style={{ width: '150px', height: '1rem', marginBottom: '1.25rem', borderRadius: '4px' }} />
        <div style={{ 
            height: '380px', 
            borderRadius: '32px', 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr'
        }}>
            <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: '32px 0 0 32px' }} />
            <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5rem' }}>
                <div className="skeleton" style={{ width: '100px', height: '2rem', borderRadius: '50px' }} />
                <div className="skeleton" style={{ width: '80%', height: '3rem', borderRadius: '8px' }} />
                <div className="skeleton" style={{ width: '60%', height: '1.5rem', borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: '160px', height: '48px', borderRadius: '12px' }} />
            </div>
        </div>
    </div>
);

export const TabsSkeleton = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 1rem' }}>
        {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: '1.5rem 0.5rem', position: 'relative' }}>
                <div className="skeleton" style={{ width: '70px', height: '1rem', borderRadius: '4px' }} />
                {i === 1 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'rgba(255,255,255,0.1)' }} />}
            </div>
        ))}
    </div>
);

export const PostSkeleton = () => (
    <div className="glass" style={{ padding: '2rem', borderRadius: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="skeleton skeleton-avatar" style={{ width: '48px', height: '48px' }} />
            <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '30%', height: '1.1rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '15%', height: '0.8rem' }} />
            </div>
        </div>
        <div className="skeleton skeleton-text" style={{ width: '100%', height: '1.2rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '100%', height: '1.2rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '60%', height: '1.2rem', marginBottom: '1.5rem' }} />
        <div className="skeleton" style={{ aspectRatio: '16/9', width: '100%', borderRadius: '16px' }} />
    </div>
);

export const SearchUserSkeleton = () => (
    <div className="user-card glass" style={{ minWidth: '200px', padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
        <div className="skeleton skeleton-avatar" style={{ width: '80px', height: '80px', margin: '0 auto 1rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.2rem', margin: '0 auto' }} />
        <div className="skeleton skeleton-text" style={{ width: '60%', height: '0.9rem', margin: '0.5rem auto 0' }} />
    </div>
);

export const SearchVideoSkeleton = () => (
    <div className="glass" style={{ display: 'flex', gap: '1.5rem', padding: '1rem', borderRadius: '20px' }}>
        <div className="skeleton" style={{ width: '300px', minWidth: '300px', aspectRatio: '16/9', borderRadius: '15px' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="skeleton skeleton-text" style={{ width: '70%', height: '1.5rem', marginBottom: '1rem' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                <div className="skeleton skeleton-avatar" style={{ width: '28px', height: '28px' }} />
                <div className="skeleton skeleton-text" style={{ width: '30%', height: '1rem' }} />
            </div>
            <div className="skeleton skeleton-text" style={{ width: '90%', height: '0.9rem' }} />
            <div className="skeleton skeleton-text" style={{ width: '80%', height: '0.9rem' }} />
        </div>
    </div>
);

export const InsightsSkeleton = () => (
    <div className="insights-page page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
            <div className="skeleton" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '30%', height: '2.5rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '50%', height: '1rem' }} />
            </div>
        </div>
        <div className="stats-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem'
        }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="glass" style={{ padding: '2rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '16px' }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%', height: '0.9rem' }} />
                    <div className="skeleton skeleton-text" style={{ width: '60%', height: '2rem' }} />
                </div>
            ))}
        </div>
    </div>
);

export const PerformanceSkeleton = () => (
    <div className="performance-page page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="performance-header" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
            <div className="skeleton" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '150px', height: '0.8rem', marginBottom: '4px' }} />
                <div className="skeleton skeleton-text" style={{ width: '200px', height: '2.5rem', borderRadius: '4px' }} />
            </div>
            <div className="range-selector skeleton" style={{ width: '100px', height: '36px', borderRadius: '12px' }} />
        </div>

        <div className="performance-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
            <div className="main-chart-section">
                <div className="metric-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ width: '140px', height: '45px', borderRadius: '16px' }} />)}
                </div>
                <div className="chart-container glass" style={{ padding: '2rem', borderRadius: '32px', height: '500px', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="skeleton skeleton-text" style={{ width: '250px', height: '3.5rem', marginBottom: '1rem' }} />
                    <div className="skeleton skeleton-text" style={{ width: '150px', height: '1rem', marginBottom: '3rem' }} />
                    <div className="skeleton" style={{ width: '100%', height: '300px', borderRadius: '16px' }} />
                </div>
            </div>
            <div className="insights-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                    <div className="skeleton skeleton-text" style={{ width: '120px', height: '1.2rem', marginBottom: '1.5rem' }} />
                    <div className="skeleton" style={{ height: '80px', borderRadius: '16px', marginBottom: '1rem' }} />
                    <div className="skeleton" style={{ height: '80px', borderRadius: '16px' }} />
                </div>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', height: '180px' }}>
                    <div className="skeleton skeleton-text" style={{ width: '150px', height: '1.2rem', marginBottom: '1rem' }} />
                    <div className="skeleton skeleton-text" style={{ width: '100%', height: '4rem', borderRadius: '8px' }} />
                </div>
            </div>
        </div>
    </div>
);

export const NotificationSkeleton = () => (
    <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', padding: '2rem', borderRadius: '24px', background: 'rgba(255,255,255,0.02)' }}>
            <div className="skeleton" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '150px', height: '2rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '250px', height: '1.1rem' }} />
            </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px', margin: '0 auto' }}>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div className="skeleton skeleton-avatar" style={{ width: '48px', height: '48px' }} />
                    <div style={{ flex: 1 }}>
                        <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.1rem' }} />
                        <div className="skeleton skeleton-text" style={{ width: '30%', height: '0.85rem' }} />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const ChatSkeleton = () => (
    <div className="chat-page">
        <div className="chat-sidebar">
            <div className="chat-sidebar-header">
                <div className="skeleton skeleton-text" style={{ width: '120px', height: '1.5rem', marginBottom: '1rem' }} />
                <div className="skeleton" style={{ height: '42px', borderRadius: '12px' }} />
            </div>
            <div className="conversation-list" style={{ padding: '0 1rem' }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1.2rem 0', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <div className="skeleton skeleton-text" style={{ width: '60%', height: '1rem', marginBottom: '0.4rem' }} />
                            <div className="skeleton skeleton-text" style={{ width: '40%', height: '0.75rem' }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div className="chat-window">
            <div className="chat-header">
                <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text" style={{ width: '120px', height: '1.1rem', marginBottom: '4px' }} />
                    <div className="skeleton skeleton-text" style={{ width: '140px', height: '0.7rem' }} />
                </div>
            </div>
            <div className="messages-container" style={{ padding: '2rem' }}>
                <div className="skeleton" style={{ width: '220px', height: '64px', borderRadius: '16px 16px 16px 4px', marginBottom: '1.5rem' }} />
                <div className="skeleton" style={{ width: '160px', height: '48px', borderRadius: '16px 16px 4px 16px', marginBottom: '1.5rem', marginLeft: 'auto' }} />
                <div className="skeleton" style={{ width: '280px', height: '80px', borderRadius: '16px 16px 16px 4px', marginBottom: '1.5rem' }} />
            </div>
            <div className="message-input-area">
                <div className="skeleton" style={{ margin: '1rem', height: '48px', borderRadius: '24px' }} />
            </div>
        </div>
    </div>
);

export const HomeSkeleton = () => (
    <div className="home-container page-container">
        <div className="hero-section skeleton" style={{ height: '400px', borderRadius: '24px', marginBottom: '1rem', display: 'flex', alignItems: 'center', padding: '3rem' }}>
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="skeleton" style={{ width: '150px', height: '24px', borderRadius: '50px', background: 'rgba(255,255,255,0.1)' }} />
                <div className="skeleton skeleton-text" style={{ width: '100%', height: '3.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.1)' }} />
                <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.2rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }} />
                <div className="skeleton" style={{ width: '180px', height: '48px', borderRadius: '12px', marginTop: '1rem', background: 'rgba(255,255,255,0.1)' }} />
            </div>
        </div>
        
        <div className="category-chips-container" style={{ marginBottom: '1rem' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '8px', flexShrink: 0 }} />
            ))}
        </div>

        <div className="video-grid">
            {[...Array(8)].map((_, i) => (
                <VideoSkeleton key={`skel-${i}`} />
            ))}
        </div>
    </div>
);

export const AchievementSkeleton = () => (
    <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem', padding: '2rem', borderRadius: '24px', background: 'rgba(255,255,255,0.02)' }}>
            <div className="skeleton" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '200px', height: '2rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '300px', height: '1.1rem' }} />
            </div>
        </div>
        <div style={{ marginBottom: '3rem' }}>
            <div className="skeleton skeleton-text" style={{ width: '150px', height: '1.5rem', marginBottom: '1.5rem' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className="skeleton" style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '1.5rem' }} />
                        <div className="skeleton skeleton-text" style={{ width: '60%', height: '1.2rem', marginBottom: '0.5rem' }} />
                        <div className="skeleton skeleton-text" style={{ width: '80%', height: '0.9rem' }} />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export const ManageSkeleton = () => (
    <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="skeleton" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '250px', height: '2.5rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '300px', height: '1rem' }} />
            </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <div className="skeleton" style={{ width: '120px', height: '40px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ width: '100px', height: '40px', borderRadius: '12px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="glass" style={{ padding: '1rem', borderRadius: '16px', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: '120px', height: '68px', borderRadius: '12px' }} />
                    <div style={{ flex: 1 }}>
                        <div className="skeleton skeleton-text" style={{ width: '40%', height: '1rem', marginBottom: '0.5rem' }} />
                        <div className="skeleton skeleton-text" style={{ width: '20%', height: '0.8rem' }} />
                    </div>
                    <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
                </div>
            ))}
        </div>
    </div>
);

export const PageSkeleton = () => (
    <div className="page-container" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
            <div className="skeleton skeleton-text" style={{ width: '200px', height: '1.5rem' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '16px', marginBottom: '2rem' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map(i => (
                <div key={i} className="skeleton skeleton-text" style={{ width: '100%', height: '1.2rem' }} />
            ))}
        </div>
    </div>
);

const Skeleton = () => {
    return <VideoSkeleton />;
};

export default Skeleton;
