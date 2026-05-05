import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Check, Zap, Crown, Star, ShieldCheck, Flame, 
  ChevronRight, Play, Maximize2, Sparkles, 
  Download, Rocket, Target, Award, Users, 
  LayoutGrid, Headphones, Lock
} from 'lucide-react';
import { usePaystackPayment } from 'react-paystack';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { verifyProSubscription } from '../api';
import './JoinProV2.css';

// Asset paths - using placeholders that feel premium
const IMG_SD = "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=800&q=20"; 
const IMG_HD = "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=800&q=80";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder';

const JoinProV2 = () => {
    const navigate = useNavigate();
    const { user, token, refreshUser } = useAuth();
    console.log('JoinProV2 Mounting: user_premium=', user?.is_premium);
    const { showNotification } = useNotification();
    
    const [isYearly, setIsYearly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('features');

    // Memoize amount and config to prevent unnecessary re-renders of the Paystack hook
    const amount = useMemo(() => (isYearly ? 22800 : 2500), [isYearly]);
    
    const config = useMemo(() => ({
        reference: `PRO_${Date.now()}_${user?.id || 'anon'}`,
        email: user?.email || '',
        amount: amount * 100,
        publicKey: PAYSTACK_PUBLIC_KEY,
        metadata: {
            user_id: user?.id,
            payment_type: 'pro_subscription',
            custom_fields: [
                { display_name: 'User ID', variable_name: 'user_id', value: user?.id },
                { display_name: 'Payment Type', variable_name: 'payment_type', value: 'pro_subscription' },
                { display_name: 'Billing Cycle', variable_name: 'billing_cycle', value: isYearly ? 'yearly' : 'monthly' }
            ],
        },
    }), [user?.id, user?.email, amount, isYearly]);

    const initializePayment = usePaystackPayment(config);

    const handleSuccess = async (reference) => {
        setLoading(true);
        try {
            const resp = await verifyProSubscription(reference.reference, token);
            if (resp.status === 'success' || resp.is_premium) {
                showNotification('Welcome to Monteeq Pro!', 'success');
                if (refreshUser) await refreshUser();
            } else {
                showNotification(resp.message || 'Verification failed.', 'error');
            }
        } catch (err) {
            console.error('Pro Verification Error:', err);
            showNotification('Verification failed. Please contact support.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinPro = () => {
        if (!token) {
            showNotification('Please log in to join Monteeq Pro', 'info');
            navigate('/login');
            return;
        }
        initializePayment({ 
            onSuccess: handleSuccess, 
            onClose: () => showNotification('Payment cancelled.', 'info') 
        });
    };

    /* ── Renderers ────────────────────────────────────────────────── */

    const renderProBenefits = () => (
        <section className="proDashboard">
            <div className="proStatusCard">
                <div className="proStatusHeader">
                    <div className="proStatusBadge">
                        <Crown size={20} fill="currentColor" />
                        <span>PRO ACTIVE</span>
                    </div>
                    <div className="proRenewalDate">
                        Active Tier
                    </div>
                </div>
                <h2 className="proWelcome">Welcome back, {user?.username || 'Pro Member'}</h2>
                <p className="proWelcomeText">
                    You're currently enjoying all the premium benefits of Monteeq Pro. 
                    Your content is being served in 4K Cinematic resolution.
                </p>
                <div className="proStatsRow">
                    <div className="proStat">
                        <span className="proStatLabel">Challenge Tier</span>
                        <span className="proStatValue">GOLD</span>
                    </div>
                    <div className="proStat divider" />
                    <div className="proStat">
                        <span className="proStatLabel">Support</span>
                        <span className="proStatValue">Elite</span>
                    </div>
                    <div className="proStat divider" />
                    <div className="proStat">
                        <span className="proStatLabel">Transcoding</span>
                        <span className="proStatValue">Ultra</span>
                    </div>
                </div>
            </div>

            <div className="proTabs">
                <button 
                    className={`proTab ${activeTab === 'features' ? 'active' : ''}`}
                    onClick={() => setActiveTab('features')}
                >
                    <LayoutGrid size={18} /> Exclusive Tools
                </button>
                <button 
                    className={`proTab ${activeTab === 'perks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('perks')}
                >
                    <Award size={18} /> Membership Perks
                </button>
            </div>

            <div className="proTabContent">
                {activeTab === 'features' ? (
                    <div className="proFeatureGrid">
                        <div className="proFeatureItem">
                            <Maximize2 size={24} color="#ff3b30" />
                            <h4>4K Rendering Engine</h4>
                            <p>Upload files up to 2GB and serve them in full cinematic 4K resolution.</p>
                        </div>
                        <div className="proFeatureItem">
                            <Lock size={24} color="#ff3b30" />
                            <h4>E2EE Direct Messaging</h4>
                            <p>Military-grade encryption for all your collaboration chats.</p>
                        </div>
                        <div className="proFeatureItem">
                            <Rocket size={24} color="#ff3b30" />
                            <h4>Engagement Boost</h4>
                            <p>Pro content is prioritized in the discovery algorithm.</p>
                        </div>
                        <div className="proFeatureItem">
                            <Headphones size={24} color="#ff3b30" />
                            <h4>Lossless Audio</h4>
                            <p>Keep your edits crisp with high-fidelity audio streams.</p>
                        </div>
                    </div>
                ) : (
                    <div className="proPerkGrid">
                        <div className="proPerkItem">
                            <div className="perkIconWrap"><Download size={20} /></div>
                            <div className="perkText">
                                <h5>Creator Asset Pack</h5>
                                <p>Exclusive overlays, LUTs, and sound effects for Pro members.</p>
                            </div>
                            <button className="perkBtn">DOWNLOAD</button>
                        </div>
                        <div className="proPerkItem">
                            <div className="perkIconWrap"><Users size={20} /></div>
                            <div className="perkText">
                                <h5>VIP Challenge Access</h5>
                                <p>Enter "Gold-Only" challenges with exclusive recognition.</p>
                            </div>
                            <button className="perkBtn active">ENTER NOW</button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );

    const renderPricingPlans = () => (
        <>
            <div className="billingToggle">
                <span className={!isYearly ? 'active' : ''}>Monthly</span>
                <button 
                    className={`toggleSwitch ${isYearly ? 'yearly' : ''}`}
                    onClick={() => setIsYearly(!isYearly)}
                />
                <span className={isYearly ? 'active' : ''}>
                    Yearly <span className="saveBadge">SAVE 25%</span>
                </span>
            </div>

            <div id="pricing" className="plansGrid">
                <div className="planCard glassCard">
                    <div className="planName">Creator Basic</div>
                    <div className="planPrice">₦0<span>/mo</span></div>
                    <ul className="featureList">
                        <li className="featureItem"><Check size={18} className="checkIcon" /> 720p Optimized quality</li>
                        <li className="featureItem"><Check size={18} className="checkIcon" /> Standard analytics</li>
                        <li className="featureItem"><Check size={18} className="checkIcon" /> Basic challenges</li>
                        <li className="featureItem opacity-40"><Lock size={16} /> Restricted File Sizes</li>
                    </ul>
                    <button className="ctaBtn freeCta" disabled>CURRENT STATUS</button>
                </div>

                <div className="planCard proCard premiumGlow">
                    <div className="mostPopular">MOST POPULAR</div>
                    <div className="planName">Monteeq Pro</div>
                    <div className="planPrice">
                        ₦{isYearly ? '1,900' : '2,500'}
                        <span>/mo</span>
                    </div>
                    <ul className="featureList">
                        <li className="featureItem"><Sparkles size={18} className="sparkIcon" /> <strong>4K Cinematic HD Uploads</strong></li>
                        <li className="featureItem"><Flame size={18} className="sparkIcon" /> <strong>Unrestricted Upload Limits</strong></li>
                        <li className="featureItem"><Award size={18} className="sparkIcon" /> <strong>Gold-Only Elite Recognition</strong></li>
                        <li className="featureItem"><Users size={18} className="sparkIcon" /> <strong>Pro Profile Verification</strong></li>
                        <li className="featureItem"><Rocket size={18} className="sparkIcon" /> <strong>Priority Support Response</strong></li>
                        <li className="featureItem"><LayoutGrid size={18} className="sparkIcon" /> <strong>No Interruptive Ads</strong></li>
                    </ul>
                    <button 
                        className="ctaBtn proCta" 
                        onClick={handleJoinPro} 
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'UPGRADE TO PRO'}
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="v2Container">
            <div className="meshGradient" />
            <div className="glowTop" />
            
            <div className="contentWrapper">
                <header className="hero">
                    <div className="heroTag">
                        <Crown size={12} fill="currentColor" /> Premium Platform
                    </div>
                    <h1 className="heroTitle">
                        The Future of <br/>
                        <span className="textGradient">Creative Control</span>
                    </h1>
                    <p className="heroSubtitle">
                        Join the elite tier of editors who are maximizing their reach, 
                        clarity, and impact on Monteeq.
                    </p>
                </header>

                {user?.is_premium ? renderProBenefits() : (
                    <>
                        <section className="comparisonSection">
                            <div className="comparisonHeader">
                                <h2>Don't Settle for Compression</h2>
                                <p>Pro members enjoy lossless transcoding and 4K playback.</p>
                            </div>
                            <div className="comparisonGrid">
                                <div className="comparisonItem">
                                    <img src={IMG_SD} alt="Standard" className="sdImg" />
                                    <div className="comparisonLabel">STANDARD: 720p</div>
                                </div>
                                <div className="comparisonItem proBorder">
                                    <img src={IMG_HD} alt="HD" />
                                    <div className="comparisonLabel proLabel">PRO: 4K ULTRA HD</div>
                                    <div className="proQualityTag">
                                        <Maximize2 size={16} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {renderPricingPlans()}

                        <section className="benefitsGrid">
                            <div className="benefitItem">
                                <div className="benefitIcon"><Zap size={24} /></div>
                                <h3 className="benefitTitle">Pure Speed</h3>
                                <p className="benefitDesc">Your videos are prioritized in our ultra-fast transcoding clusters for instant publishing.</p>
                            </div>
                            <div className="benefitItem">
                                <div className="benefitIcon"><Target size={24} /></div>
                                <h3 className="benefitTitle">Gold Access</h3>
                                <p className="benefitDesc">Gain exclusive entry to "Gold" challenges with elite prizes and massive recognition.</p>
                            </div>
                            <div className="benefitItem">
                                <div className="benefitIcon"><ShieldCheck size={24} /></div>
                                <h3 className="benefitTitle">Elite Badge</h3>
                                <p className="benefitDesc">Your profile features the Pro badge for instant credibility.</p>
                            </div>
                        </section>
                    </>
                )}

            </div>
        </div>
    );
};

export default JoinProV2;
