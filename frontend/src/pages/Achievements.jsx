import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAchievements } from '../api';
import { AchievementSkeleton } from '../components/Skeleton';
import { BADGES } from '../constants/badges';

const Achievements = () => {
    const { user, token } = useAuth();
    const [earnedAchievements, setEarnedAchievements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAchievements = async () => {
            try {
                const data = await getAchievements(token);
                setEarnedAchievements(data);
            } catch (error) {
                console.error("Failed to fetch achievements:", error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchAchievements();
        }
    }, [user, token]);

    if (loading) {
        return <AchievementSkeleton />;
    }

    const earnedIds = new Set(earnedAchievements.map(a => a.milestone_name));

    const earnedList = earnedAchievements.map(ach => {
        const badgeInfo = BADGES.find(b => b.id === ach.milestone_name) || {
            name: ach.milestone_name.replace(/_/g, ' '),
            description: 'Custom Milestone',
            icon: Trophy
        };
        return { ...ach, ...badgeInfo };
    });

    const lockedList = BADGES.filter(b => !earnedIds.has(b.id));

    return (
        <div className="page-container">
            <div className="achievements-header">
                <div className="header-icon-container">
                    <Trophy size={32} color="var(--accent-primary)" />
                </div>
                <div>
                    <h1>Achievements</h1>
                    <p>Track your editor journey and unlock milestones</p>
                </div>
            </div>

            <div className="achievements-content">
                <div className="section-block">
                    <h3 className="block-title">Earned Badges ({earnedList.length})</h3>

                    {earnedList.length === 0 ? (
                        <div className="empty-state-box">
                            <Trophy size={48} className="empty-icon" />
                            <h3>No achievements yet</h3>
                            <p>Upload videos and engage with the community to start earning!</p>
                        </div>
                    ) : (
                        <div className="badges-grid">
                            {earnedList.map((ach) => (
                                <div key={ach.id} className="badge-card earned">
                                    <div className="badge-icon-wrapper">
                                        <ach.icon size={40} className="badge-icon" />
                                        <div className="check-badge">
                                            <CheckCircle2 size={16} fill="var(--bg-surface)" />
                                        </div>
                                    </div>
                                    <div className="badge-details">
                                        <h3>{ach.name}</h3>
                                        <p>{ach.description}</p>
                                        <div className="badge-date">
                                            <Calendar size={12} />
                                            <span>Unlocked {new Date(ach.reached_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="section-block">
                    <h3 className="block-title">Locked Milestones</h3>
                    <div className="badges-grid">
                        {lockedList.map((badge) => (
                            <div key={badge.id} className="badge-card locked">
                                <div className="badge-icon-wrapper locked">
                                    <badge.icon size={40} className="badge-icon locked-icon" />
                                    <div className="lock-badge">
                                        <Lock size={14} />
                                    </div>
                                </div>
                                <div className="badge-details">
                                    <h3>{badge.name}</h3>
                                    <p>{badge.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .achievements-header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 3rem;
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
                .achievements-header h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                }
                .achievements-header p {
                    color: var(--text-secondary);
                    font-size: 1.1rem;
                }
                
                .section-block {
                    margin-bottom: 4rem;
                }
                .block-title {
                    font-size: 1.4rem;
                    font-weight: 600;
                    margin-bottom: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                }
                
                .badges-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                }
                
                @media (max-width: 1024px) {
                    .badges-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                
                @media (max-width: 768px) {
                    .badges-grid {
                        grid-template-columns: 1fr;
                    }
                }
                
                .badge-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-glass);
                    border-radius: 16px;
                    padding: 2rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    transition: var(--transition-smooth);
                    position: relative;
                    overflow: hidden;
                }
                
                .badge-card.earned {
                    background: linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }
                .badge-card.earned:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    border-color: var(--accent-primary);
                }
                
                .badge-card.locked {
                    opacity: 0.6;
                    background: rgba(0,0,0,0.2);
                }
                
                .badge-icon-wrapper {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: rgba(245, 158, 11, 0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 1.5rem;
                    position: relative;
                }
                .badge-icon {
                    color: #f59e0b;
                }
                .badge-icon-wrapper.locked {
                    background: rgba(255,255,255,0.05);
                }
                .badge-icon.locked-icon {
                    color: var(--text-muted);
                }
                
                .check-badge {
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    background: #f59e0b;
                    color: var(--bg-deep);
                    border-radius: 50%;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid var(--bg-surface);
                }
                
                .lock-badge {
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    background: var(--bg-surface);
                    color: var(--text-muted);
                    border-radius: 50%;
                    padding: 6px;
                    border: 1px solid var(--border-glass);
                }
                
                .badge-details h3 {
                    font-size: 1.2rem;
                    margin-bottom: 0.5rem;
                }
                .badge-details p {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    line-height: 1.5;
                }
                .badge-date {
                    margin-top: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--accent-primary);
                    opacity: 0.8;
                    background: rgba(255, 62, 62, 0.1);
                    padding: 4px 10px;
                    border-radius: 20px;
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
            `}</style>
        </div>
    );
};

export default Achievements;
