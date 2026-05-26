import React, { useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import { BADGES } from '../pages/Achievements';
import { useNavigate } from 'react-router-dom';

const AchievementPopup = ({ achievement, onClose }) => {
    const navigate = useNavigate();

    useEffect(() => {
        // Auto close after 15 seconds (longer if it's primary action)
        const timer = setTimeout(() => {
            onClose();
        }, 15000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const handleAction = () => {
        if (achievement.link) {
            navigate(achievement.link);
        }
        onClose();
    };

    const badge = BADGES.find(b => achievement.message.includes(b.name)) || {
        icon: Trophy,
        name: 'Achievement Unlocked!',
        description: achievement.message
    };

    // If we found a badge, use its icon. If not, default to Trophy.
    const Icon = badge.icon;

    return (
        <div className="achievement-overlay" onClick={onClose}>
            <div className="achievement-popup glass" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="glow-container">
                    <div className="trophy-circle">
                        <Icon size={64} color="#f59e0b" weight="fill" />
                    </div>
                    <div className="shine-effect"></div>
                </div>

                <div className="achievement-text">
                    <h3 className="achievement-title">ACHIEVEMENT UNLOCKED</h3>
                    <h2 className="badge-name">{badge.name}</h2>
                    <p className="badge-desc">{badge.description}</p>
                </div>

                <button className="awesome-btn" onClick={handleAction}>
                    {achievement.link ? "View Achievements" : "Awesome!"}
                </button>
            </div>

            <style>{`
                .achievement-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(8px);
                    animation: fadeIn 0.3s ease-out;
                }

                .achievement-popup {
                    width: 90%;
                    max-width: 400px;
                    padding: 3rem 2rem;
                    border-radius: 32px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    position: relative;
                    background: linear-gradient(135deg, rgba(30, 30, 30, 0.9) 0%, rgba(10, 10, 10, 0.95) 100%);
                    border: 2px solid rgba(245, 158, 11, 0.3);
                    box-shadow: 0 0 50px rgba(245, 158, 11, 0.3);
                    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .close-btn {
                    position: absolute;
                    top: 1.5rem;
                    right: 1.5rem;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .close-btn:hover {
                    color: white;
                }

                .glow-container {
                    position: relative;
                    margin-bottom: 2rem;
                }

                .trophy-circle {
                    width: 120px;
                    height: 120px;
                    background: rgba(245, 158, 11, 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid rgba(245, 158, 11, 0.5);
                    box-shadow: 0 0 30px rgba(245, 158, 11, 0.4);
                    animation: pulse 2s infinite;
                }

                .achievement-title {
                    font-size: 0.9rem;
                    letter-spacing: 2px;
                    color: #f59e0b;
                    margin-bottom: 0.5rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .badge-name {
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 1rem;
                    background: linear-gradient(to right, #fff, #fbbf24);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .badge-desc {
                    color: var(--text-secondary);
                    font-size: 1rem;
                    line-height: 1.5;
                    margin-bottom: 2rem;
                }

                .awesome-btn {
                    background: linear-gradient(90deg, #f59e0b, #d97706);
                    color: white;
                    border: none;
                    padding: 1rem 3rem;
                    border-radius: 50px;
                    font-weight: 700;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 5px 20px rgba(245, 158, 11, 0.4);
                }

                .awesome-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.6);
                }

                @keyframes popIn {
                    0% { transform: scale(0.8) translateY(20px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                    70% { box-shadow: 0 0 0 20px rgba(245, 158, 11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
            `}</style>
        </div>
    );
};

export default AchievementPopup;
