'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, Users, Heart, DollarSign, Share2, Video,
    Zap, ArrowLeft, BarChart3, Trophy, CheckCircle2,
    ChevronRight, Sparkles, X, Layout, Globe, Map
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getUserInsights } from '@/lib/browserApi';
import { InsightsSkeleton } from '@/components/Skeleton';

const Insights = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showMilestonePopup, setShowMilestonePopup] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchInsights = async () => {
            try {
                const data = await getUserInsights(token);
                setStats(data);
                if (data.new_milestone_reached) {
                    setShowMilestonePopup(true);
                }
            } catch (err) {
                console.error("Error fetching insights:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchInsights();
    }, [token]);

    if (loading) return <InsightsSkeleton />;

    const statCards = [
        { id: 'views', label: 'Total Views', value: stats?.total_views || 0, icon: TrendingUp, color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
        { id: 'likes', label: 'Total Likes', value: stats?.total_likes || 0, icon: Heart, color: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' },
        { id: 'shares', label: 'Total Shares', value: stats?.total_shares || 0, icon: Share2, color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
        { id: 'followers', label: 'Followers', value: stats?.followers || 0, icon: Users, color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' },
        { id: 'following', label: 'Following', value: stats?.following || 0, icon: Users, color: '#64748b', glow: 'rgba(100, 116, 139, 0.4)' },
    ];

    const totalViews = stats?.total_views || 0;
    const nextMilestone = stats?.next_milestone || 100;
    const progressPercent = Math.min(100, (totalViews / nextMilestone) * 100);
    const remainingViews = Math.max(0, nextMilestone - totalViews);

    return (
        <div className="insights-page page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
            <div className="insights-header" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
                <button
                    onClick={() => navigate(-1)}
                    className="glass"
                    style={{
                        width: '45px', height: '45px', borderRadius: '50%', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Editor Insights</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track your growth and celebrate your milestones on Monteeq</p>
                </div>

                <button
                    onClick={() => navigate('/manage')}
                    className="glass hover-scale"
                    style={{
                        padding: '1rem 2rem',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    <Layout size={18} color="var(--accent-primary)" />
                    Manage Content
                    <ChevronRight size={18} opacity={0.5} />
                </button>
            </div>

            <div className="stats-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '3rem'
            }}>
                {statCards.map((stat, idx) => (
                    <div
                        key={idx}
                        className="glass hover-scale"
                        onClick={() => navigate(`/performance?metric=${stat.id}`)}
                        style={{
                            padding: '2rem', borderRadius: '24px', position: 'relative', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer'
                        }}
                    >
                        <div style={{
                            width: '50px', height: '50px', borderRadius: '16px',
                            background: `rgba(${parseInt(stat.color.slice(1, 3), 16)}, ${parseInt(stat.color.slice(3, 5), 16)}, ${parseInt(stat.color.slice(5, 7), 16)}, 0.1)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: stat.color, boxShadow: `0 0 20px ${stat.glow}`
                        }}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{stat.label}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stat.value}</div>
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: '1rem',
                            right: '1.5rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            View details <ChevronRight size={14} />
                        </div>
                    </div>
                ))}

                {/* Top Countries Card */}
                <div className="glass hover-scale" style={{
                    padding: '2rem', borderRadius: '24px', position: 'relative', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', gap: '1rem'
                }}>
                    <div style={{
                        width: '50px', height: '50px', borderRadius: '16px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#3b82f6', boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Globe size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Top Audience Locations</div>
                        {stats?.top_countries?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {stats.top_countries.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                        <Map size={14} opacity={0.6} />
                                        <span style={{ fontWeight: 600, flex: 1 }}>{c.country}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{((c.count / totalViews) * 100).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Gathering geo-data...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="content-breakdown" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                <div className="glass" style={{ padding: '2rem', borderRadius: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <BarChart3 size={24} color="var(--accent-primary)" />
                        <h2 style={{ fontSize: '1.5rem' }}>Content Distribution</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="distribution-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Video size={16} /> Home Videos</span>
                                <span>{stats?.home_videos || 0}</span>
                            </div>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${((stats?.home_videos || 0) / Math.max(1, (stats?.home_videos || 0) + (stats?.flash_videos || 0)) * 100)}%`,
                                    background: 'var(--accent-primary)',
                                    boxShadow: '0 0 10px var(--accent-glow)'
                                }}></div>
                            </div>
                        </div>
                        <div className="distribution-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={16} /> Flash Clips</span>
                                <span>{stats?.flash_videos || 0}</span>
                            </div>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${((stats?.flash_videos || 0) / Math.max(1, (stats?.home_videos || 0) + (stats?.flash_videos || 0)) * 100)}%`,
                                    background: '#f59e0b',
                                    boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)'
                                }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass" style={{
                    padding: '2rem',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Trophy size={24} color="#f59e0b" />
                        <h2 style={{ fontSize: '1.5rem' }}>Road to Milestone</h2>
                    </div>

                    <div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            You're {remainingViews.toLocaleString()} views away from hitting <strong>{nextMilestone.toLocaleString()} views</strong>!
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{Math.round(progressPercent)}%</span>
                            </div>
                            <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${progressPercent}%`,
                                    background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                    boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)',
                                    transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)'
                                }}></div>
                            </div>
                        </div>
                    </div>

                    <button
                        className="hero-btn"
                        onClick={() => navigate('/upload')}
                        style={{ marginTop: 'auto', width: '100%' }}
                    >
                        Boost Growth (Upload)
                    </button>
                </div>
            </div>

            {/* Achievement Badges Section */}
            {stats?.achievements?.length > 0 && (
                <div style={{ marginTop: '3rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <Sparkles size={20} color="#f59e0b" /> Achievements
                    </h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                        {stats.achievements.map((ach, idx) => (
                            <div key={idx} className="glass" style={{
                                padding: '0.8rem 1.2rem',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem',
                                fontSize: '0.9rem',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                background: 'rgba(245, 158, 11, 0.05)'
                            }}>
                                <CheckCircle2 size={16} color="#f59e0b" />
                                {ach.replace('_', ' ')}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Milestone Celebration Popup */}
            {showMilestonePopup && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div className="glass hover-scale" style={{
                        width: '450px',
                        padding: '4rem 3rem',
                        borderRadius: '32px',
                        textAlign: 'center',
                        position: 'relative',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        boxShadow: '0 0 50px rgba(245, 158, 11, 0.2)'
                    }}>
                        <button
                            onClick={() => setShowMilestonePopup(false)}
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            background: 'rgba(245, 158, 11, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 2rem',
                            color: '#f59e0b',
                            boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)'
                        }}>
                            <Trophy size={50} />
                        </div>

                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>CONGRATULATIONS!</h2>
                        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            You've officially reached the <strong>{stats.new_milestone_reached.replace('_', ' ')}</strong> milestone!
                            Your content is making a huge impact on Monteeq.
                        </p>

                        <button
                            className="hero-btn"
                            style={{ marginTop: '2.5rem', width: '100%', padding: '1.2rem' }}
                            onClick={() => setShowMilestonePopup(false)}
                        >
                            Keep Shone!
                        </button>
                    </div>
                    {/* Confetti Animation Placeholder Logic would normally be here */}
                </div>
            )}
        </div>
    );
};

export default Insights;
