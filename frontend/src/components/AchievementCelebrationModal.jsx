import React, { useEffect } from 'react';
import { Trophy, X, Zap } from 'lucide-react';
import { BADGES } from '../pages/Achievements';

const AchievementCelebrationModal = ({ achievement, onClose }) => {
    
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const badge = BADGES.find(b => achievement.message.includes(b.name)) || {
        icon: Trophy,
        name: 'Achievement Unlocked!',
        description: achievement.message
    };

    const Icon = badge.icon;
    const reward = achievement.reward_xp || 50; // Fallback to 50 XP

    return (
        <div className="celebration-overlay" onClick={onClose}>
            <div className="celebration-modal glass" onClick={(e) => e.stopPropagation()}>
                <button className="celebration-close" onClick={onClose} aria-label="Close">
                    <X size={24} />
                </button>

                <div className="celebration-icon-wrapper">
                    <div className="celebration-glow"></div>
                    <div className="celebration-trophy">
                        <Icon size={72} color="#f59e0b" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="celebration-content">
                    <span className="celebration-subtitle">NEW ACHIEVEMENT</span>
                    <h2 className="celebration-title">{badge.name}</h2>
                    <p className="celebration-desc">{badge.description}</p>
                    
                    <div className="celebration-reward">
                        <Zap size={20} fill="#f59e0b" color="#f59e0b" />
                        <span>+{reward} XP REWARD</span>
                    </div>
                </div>

                <button className="celebration-btn" onClick={onClose}>
                    AWESOME!
                </button>
            </div>

            <style>{`
                .celebration-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: celebrationFadeIn 0.3s ease-out forwards;
                }

                .celebration-modal {
                    width: 90%;
                    max-width: 440px;
                    padding: 3.5rem 2rem 3rem;
                    border-radius: 32px;
                    background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(5, 5, 5, 0.98) 100%);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    box-shadow: 0 0 60px rgba(245, 158, 11, 0.15), inset 0 0 20px rgba(245, 158, 11, 0.05);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    position: relative;
                    animation: celebrationScaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }

                .celebration-close {
                    position: absolute;
                    top: 1.5rem;
                    right: 1.5rem;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.3);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .celebration-close:hover {
                    color: white;
                    transform: rotate(90deg);
                }

                .celebration-icon-wrapper {
                    position: relative;
                    margin-bottom: 2.5rem;
                }

                .celebration-glow {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 140px;
                    height: 140px;
                    background: radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%);
                    animation: celebrationPulse 2s infinite;
                }

                .celebration-trophy {
                    width: 130px;
                    height: 130px;
                    background: rgba(245, 158, 11, 0.08);
                    border: 2px solid rgba(245, 158, 11, 0.4);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    z-index: 2;
                }

                .celebration-subtitle {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 800;
                    letter-spacing: 4px;
                    color: #f59e0b;
                    margin-bottom: 0.75rem;
                    opacity: 0.9;
                }

                .celebration-title {
                    font-size: 2.25rem;
                    font-weight: 900;
                    margin-bottom: 1rem;
                    background: linear-gradient(to bottom, #fff 30%, #f59e0b 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .celebration-desc {
                    color: var(--text-secondary);
                    font-size: 1.1rem;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                    max-width: 300px;
                }

                .celebration-reward {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(245, 158, 11, 0.12);
                    padding: 0.75rem 1.5rem;
                    border-radius: 100px;
                    border: 1px solid rgba(245, 158, 11, 0.2);
                    margin-bottom: 2.5rem;
                }

                .celebration-reward span {
                    font-weight: 900;
                    font-size: 0.9rem;
                    color: #f59e0b;
                    letter-spacing: 1px;
                }

                .celebration-btn {
                    width: 100%;
                    padding: 1.25rem;
                    background: linear-gradient(90deg, #f59e0b, #d97706);
                    border: none;
                    border-radius: 16px;
                    color: white;
                    font-weight: 900;
                    font-size: 1.1rem;
                    letter-spacing: 1px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
                }

                .celebration-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 12px 35px rgba(245, 158, 11, 0.6);
                    filter: brightness(1.1);
                }

                .celebration-btn:active {
                    transform: translateY(-1px);
                }

                @keyframes celebrationFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes celebrationScaleIn {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }

                @keyframes celebrationPulse {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
                    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.2; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
                }
            `}</style>
        </div>
    );
};

export default AchievementCelebrationModal;
