import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, DollarSign, Crown, TrendingUp, Send, CheckCircle, PieChart, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { sendTip, getCreatorWallet } from '../api';

const MonetizationWidget = ({ video }) => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [tipping, setTipping] = useState(false);
    const [tipAmount, setTipAmount] = useState(1000);
    const [tipSuccess, setTipSuccess] = useState(false);
    const [wallet, setWallet] = useState(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    const fetchBalance = async () => {
        if (!token) return;
        setBalanceLoading(true);
        try {
            const data = await getCreatorWallet(token);
            setWallet(data);
        } catch (err) {
            console.error("Failed to fetch balance", err);
        } finally {
            setBalanceLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
    }, [token]);

    const balance = wallet ? Number(wallet.balance) : 0;
    const canAfford = balance >= tipAmount;
    
    // Auto-calculate progress for viewers
    const views = video?.views || 0;
    const progressPercentage = ((views % 1000) / 1000) * 100;

    const handleTip = async () => {
        if (!token) {
            showNotification('info', "Please login to send tips.");
            return;
        }

        setTipping(true);
        try {
            const res = await sendTip(video.owner_id || video.owner?.id, tipAmount, token);
            if (res.detail) throw new Error(res.detail);
            
            setTipping(false);
            setTipSuccess(true);
            showNotification('success', `Sent ₦${tipAmount.toLocaleString()} to @${video.owner?.username || 'the creator'}!`);
            fetchBalance(); // Refresh balance after tipping
            setTimeout(() => setTipSuccess(false), 3000);
        } catch (err) {
            console.error("Tip failed:", err);
            setTipping(false);
            showNotification('error', err.message || "Failed to send tip.");
        }
    };

    return (
        <div className="monetization-widget">
            {/* ---------------- PUBLIC VIEWER WIDGET ---------------- */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="public-monetization-panel"
            >
                {/* Tip Container */}
                <div className="tip-container glass-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                        <h4 style={{ margin: 0 }}>Show some love!</h4>
                        {token && (
                            <div className="sidebar-balance" style={{ fontSize: '0.8rem', fontWeight: 700, color: canAfford ? 'var(--text-secondary)' : '#ff4d4d' }}>
                                Balance: ₦{balance.toLocaleString()}
                            </div>
                        )}
                    </div>
                    <div className="tip-presets">
                        {[500, 1000, 2500].map(amt => (
                            <button 
                                key={amt}
                                className={`preset-btn ${tipAmount === amt ? 'active' : ''}`}
                                onClick={() => setTipAmount(amt)}
                            >
                                ₦{amt}
                            </button>
                        ))}
                    </div>
                    
                    <motion.button 
                        whileHover={canAfford ? { scale: 1.05 } : {}}
                        whileTap={canAfford ? { scale: 0.95 } : {}}
                        className={`send-tip-btn ${tipSuccess ? 'success' : ''} ${!canAfford ? 'disabled' : ''}`}
                        onClick={canAfford ? handleTip : () => navigate('/monetization')}
                        disabled={tipping}
                        style={{
                            background: canAfford ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                            color: canAfford ? 'black' : 'var(--text-muted)',
                            border: canAfford ? 'none' : '1px dashed var(--border-glass)',
                            cursor: 'pointer'
                        }}
                    >
                        {tipping ? (
                            <div className="loader"></div>
                        ) : tipSuccess ? (
                            <><CheckCircle size={20} /> Tipped!</>
                        ) : canAfford ? (
                            <><Send size={20} /> Send Tip ₦{tipAmount.toLocaleString()}</>
                        ) : (
                            <><CreditCard size={20} /> Top up to Tip</>
                        )}
                    </motion.button>
                    
                    {/* Milestone gamification for viewers */}
                    <div className="public-milestone">
                        <p>Help @{video.owner?.username || 'creator'} reach their next milestone!</p>
                        <div className="progress-bg small">
                            <motion.div 
                                className="progress-bar neon-pulse"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            <style>{`
                .monetization-widget {
                    width: 100%;
                    max-width: 400px;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .glass-panel {
                    background: rgba(20, 20, 20, 0.7);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 215, 0, 0.1);
                    border-radius: 16px;
                    padding: 1.5rem;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                .text-neon {
                    color: var(--accent-primary);
                    filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.5));
                }
                
                /* Public Elements */
                .subscribe-banner {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    cursor: pointer;
                    background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(0, 0, 0, 0.6));
                }
                .sub-icon {
                    background: rgba(255, 215, 0, 0.2);
                    padding: 0.6rem;
                    border-radius: 50%;
                }
                .sub-info h4 { margin: 0; font-size: 1rem; font-weight: 700; color: white; }
                .sub-info p { margin: 0; font-size: 0.8rem; color: #bbb; }
                .sub-btn {
                    margin-left: auto;
                    background: var(--accent-primary);
                    color: black;
                    border: none;
                    padding: 0.5rem 1.2rem;
                    border-radius: 99px;
                    font-weight: 800;
                }

                .tip-container h4 {
                    margin: 0 0 1rem;
                    font-size: 1.1rem;
                    font-weight: 800;
                    text-align: center;
                }
                .tip-presets {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.2rem;
                }
                .preset-btn {
                    flex: 1;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    padding: 0.6rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .preset-btn.active {
                    background: rgba(255, 215, 0, 0.2);
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                }
                .send-tip-btn {
                    width: 100%;
                    padding: 1rem;
                    border-radius: 12px;
                    border: none;
                    background: var(--accent-primary);
                    color: black;
                    font-weight: 800;
                    font-size: 1.1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.8rem;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
                }
                .send-tip-btn.success {
                    background: #4ade80;
                    box-shadow: 0 4px 20px rgba(74, 222, 128, 0.4);
                }
                .loader {
                    border: 3px solid rgba(0,0,0,0.1);
                    border-top: 3px solid black;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    animation: spin 1s linear infinite;
                }
                .public-milestone {
                    margin-top: 1.5rem;
                    text-align: center;
                    font-size: 0.8rem;
                    color: #aaa;
                }
                .public-milestone p { margin-bottom: 0.5rem; }
                .neon-pulse {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 5px var(--accent-primary); }
                    50% { box-shadow: 0 0 15px var(--accent-primary); }
                    100% { box-shadow: 0 0 5px var(--accent-primary); }
                }
            `}</style>
        </div>
    );
};

export default MonetizationWidget;
