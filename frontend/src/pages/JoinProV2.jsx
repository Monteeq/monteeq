import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Check, Zap, Crown, Star, ShieldCheck, Flame, 
  ChevronRight, Play, Maximize2, Sparkles, 
  Download, Rocket, Target, Award, Users, 
  LayoutGrid, Headphones, Lock
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { 
  fetchProPricing, 
  createSubscription, 
  verifySubscription,
  createCustomerPortalSession,
  getSubscriptionStatus,
  toggleAutoRenew,
  cancelSubscription
} from '../api';
import './JoinProV2.css';

// Asset paths
const IMG_SD = "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=800&q=20"; 
const IMG_HD = "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=800&q=80";

// Load stripe promise using environment variable or a fallback test key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_51OpPZtGL3s4b8G0tQn6a9k2b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g');

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: 'rgba(255, 255, 255, 0.3)'
      }
    },
    invalid: {
      color: '#ff3b30',
      iconColor: '#ff3b30'
    }
  }
};

const JoinProContent = () => {
    const navigate = useNavigate();
    const { user, token, refreshUser } = useAuth();
    const { showNotification } = useNotification();
    const stripe = useStripe();
    const elements = useElements();
    
    const [isYearly, setIsYearly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingPortal, setLoadingPortal] = useState(false);
    const [pricing, setPricing] = useState({ monthly_price: 4.99, yearly_price: 53.89 });
    
    // Checkout steps: 'plans' | 'checkout' | 'success'
    const [checkoutStep, setCheckoutStep] = useState('plans');
    
    // Billing Form fields
    const [fullName, setFullName] = useState('');
    const [billingEmail, setBillingEmail] = useState('');
    const [billingCountry, setBillingCountry] = useState('US');
    const [billingZip, setBillingZip] = useState('');
    
    const [cardFocused, setCardFocused] = useState(false);

    // Auto-Renew and Cancellation States
    const [autoRenew, setAutoRenew] = useState(true);
    const [cancelStep, setCancelStep] = useState(0); // 0 = default, 1 = step 1 loss aversion, 2 = step 2 confirmation
    const [cancellationReason, setCancellationReason] = useState('too_expensive');
    const [cancelling, setCancelling] = useState(false);
    const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);

    useEffect(() => {
        if (token && user?.is_premium) {
            getSubscriptionStatus(token).then(statusData => {
                if (statusData) {
                    setAutoRenew(!statusData.cancel_at_period_end);
                }
            }).catch(err => console.error("Failed to load subscription status:", err));
        }
    }, [token, user]);

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '');
            setBillingEmail(user.email || '');
        }
    }, [user]);

    useEffect(() => {
        fetchProPricing().then(data => {
            if (data && data.monthly_price) {
                setPricing(data);
            }
        }).catch(err => console.error("Failed to fetch pricing:", err));
    }, []);

    const handleSelectPlan = () => {
        if (!token) {
            showNotification('info', 'Please log in to join Monteeq Pro');
            navigate('/login');
            return;
        }
        setCheckoutStep('checkout');
    };

    const handleManageSubscription = async () => {
        setLoadingPortal(true);
        try {
            const data = await createCustomerPortalSession(token);
            if (data && data.url) {
                window.location.href = data.url;
            } else {
                throw new Error("Billing settings portal URL not found");
            }
        } catch (err) {
            showNotification('error', err?.message || 'Failed to open settings.');
        } finally {
            setLoadingPortal(false);
        }
    };

    const handleToggleAutoRenew = async () => {
        if (togglingAutoRenew) return;
        setTogglingAutoRenew(true);
        const newStatus = !autoRenew;
        try {
            await toggleAutoRenew(newStatus, token);
            setAutoRenew(newStatus);
            showNotification('success', newStatus ? 'Auto-renewal turned on.' : 'Auto-renewal turned off.');
        } catch (err) {
            showNotification('error', err?.message || 'Failed to update auto-renewal.');
        } finally {
            setTogglingAutoRenew(false);
        }
    };

    const handleCancelSubscription = async () => {
        setCancelling(true);
        try {
            await cancelSubscription(token);
            showNotification('success', 'Your subscription was canceled.');
            setCancelStep(0);
            await refreshUser();
        } catch (err) {
            showNotification('error', err?.message || 'Failed to cancel subscription.');
        } finally {
            setCancelling(false);
        }
    };

    const handlePaySubscription = async (e) => {
        e.preventDefault();
        
        if (!stripe || !elements) {
            showNotification('error', 'Stripe is still loading. Please try again.');
            return;
        }

        if (!fullName || !billingEmail || !billingCountry || !billingZip) {
            showNotification('warning', 'Please fill out all billing fields.');
            return;
        }

        setLoading(true);

        try {
            const billingDetails = {
                fullName,
                billingEmail,
                billingCountry,
                billingZip
            };
            const initResponse = await createSubscription(isYearly, billingDetails, token);
            
            if (!initResponse || !initResponse.clientSecret) {
                throw new Error('Failed to create subscription session.');
            }

            const cardElement = elements.getElement(CardElement);
            const result = await stripe.confirmCardPayment(initResponse.clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: fullName,
                        email: billingEmail,
                        address: {
                            country: billingCountry,
                            postal_code: billingZip
                        }
                    }
                }
            });

            if (result.error) {
                throw new Error(result.error.message);
            }

            if (result.paymentIntent && (result.paymentIntent.status === 'succeeded' || result.paymentIntent.status === 'processing')) {
                // Instantly confirm subscription on backend
                try {
                    await verifySubscription(initResponse.subscriptionId, token);
                } catch (verifyErr) {
                    console.error("Backend verification fallback failed:", verifyErr);
                }
                
                showNotification('success', 'Subscription activated successfully!');
                setCheckoutStep('success');
                await refreshUser();
            } else {
                throw new Error('Payment state incomplete. Please try again.');
            }
        } catch (err) {
            showNotification('error', err?.message || 'Subscription failed.');
        } finally {
            setLoading(false);
        }
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
                        Premium Plan Active
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
                        <span className="proStatValue">Ultra 4K</span>
                    </div>
                </div>
                
                <div className="portalBtnWrap" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Auto-Renew</span>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                {autoRenew ? 'Renewing automatically' : 'Expires at period end'}
                            </span>
                        </div>
                        <button 
                            type="button"
                            className={`toggleSwitch ${autoRenew ? 'yearly' : ''}`}
                            onClick={handleToggleAutoRenew}
                            disabled={togglingAutoRenew}
                            style={{ margin: 0 }}
                        />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                        <button 
                            className="portalBtn" 
                            onClick={handleManageSubscription}
                            disabled={loadingPortal}
                            style={{ flex: 1, margin: 0 }}
                        >
                            <ShieldCheck size={18} />
                            {loadingPortal ? 'Opening portal...' : 'Billing Portal'}
                        </button>
                        
                        <button 
                            className="portalBtn"
                            onClick={() => setCancelStep(1)}
                            style={{ flex: 1, margin: 0, background: 'rgba(255, 69, 58, 0.1)', border: '1px solid rgba(255, 69, 58, 0.2)', color: '#ff453a' }}
                        >
                            Cancel Pro
                        </button>
                    </div>
                </div>
            </div>

            <div className="proTabContent">
                <div className="proFeatureGrid">
                    <div className="proFeatureItem">
                        <Maximize2 size={24} color="#ff3b30" />
                        <h4>4K Video Quality</h4>
                        <p>Upload files up to 2GB and serve them in full 4K resolution.</p>
                    </div>
                    <div className="proFeatureItem">
                        <LayoutGrid size={24} color="#ff3b30" />
                        <h4>Ad-Free Experience</h4>
                        <p>Enjoy uninterrupted browsing and streaming without any ads.</p>
                    </div>
                    <div className="proFeatureItem">
                        <Rocket size={24} color="#ff3b30" />
                        <h4>Priority Discovery</h4>
                        <p>Pro content ranks higher in the algorithm.</p>
                    </div>
                    <div className="proFeatureItem">
                        <Headphones size={24} color="#ff3b30" />
                        <h4>High-Fidelity Audio</h4>
                        <p>Keep your audio clear with high-bitrate streaming.</p>
                    </div>
                </div>
            </div>
        </section>
    );

    const renderCancellationStep1 = () => (
        <div className="checkoutContainer cancellationContainer" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="checkoutHeader">
                <Crown size={32} color="#ff3b30" style={{ marginBottom: '1rem' }} />
                <h2>Before you go...</h2>
                <p>Cancelling means you will lose your premium benefits at the end of the billing period.</p>
            </div>
            
            <div className="lostBenefitsList" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '2rem 0' }}>
                <div className="lostBenefitItem" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <Maximize2 size={20} color="#ff453a" />
                    <div style={{ textAlign: 'left' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>No more 4K uploads</h4>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Your videos will be compressed down to standard 720p quality.</p>
                    </div>
                </div>
                <div className="lostBenefitItem" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <Flame size={20} color="#ff453a" />
                    <div style={{ textAlign: 'left' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Limited Uploads</h4>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Uploads will be restricted to a standard weekly allowance.</p>
                    </div>
                </div>
                <div className="lostBenefitItem" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <Users size={20} color="#ff453a" />
                    <div style={{ textAlign: 'left' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Pro badge removal</h4>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>The Pro badge will be removed from your profile and feed videos.</p>
                    </div>
                </div>
                <div className="lostBenefitItem" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <Award size={20} color="#ff453a" />
                    <div style={{ textAlign: 'left' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Gold challenges lock</h4>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>You will no longer be eligible to enter high-prize challenges.</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button 
                    className="ctaBtn proCta" 
                    onClick={() => setCancelStep(0)}
                    style={{ flex: 1, margin: 0 }}
                >
                    Keep my Pro membership
                </button>
                <button 
                    className="ctaBtn freeCta" 
                    onClick={() => setCancelStep(2)}
                    style={{ flex: 1, margin: 0, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#ffffff' }}
                >
                    Continue
                </button>
            </div>
        </div>
    );

    const renderCancellationStep2 = () => (
        <div className="checkoutContainer cancellationContainer" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="checkoutHeader">
                <h2>Why are you cancelling?</h2>
                <p>Your feedback helps us make Monteeq better for everyone.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '2rem 0', textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Reason for cancellation</label>
                <select 
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="formInput"
                    style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', width: '100%', padding: '0.8rem 1rem', borderRadius: '12px' }}
                >
                    <option value="too_expensive">It's too expensive</option>
                    <option value="missing_features">Missing features I need</option>
                    <option value="difficult_to_use">Too difficult to use</option>
                    <option value="not_using_enough">I don't use it enough</option>
                    <option value="other">Other reason</option>
                </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button 
                    className="ctaBtn freeCta" 
                    onClick={() => setCancelStep(1)}
                    disabled={cancelling}
                    style={{ flex: 1, margin: 0, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#ffffff' }}
                >
                    Back
                </button>
                <button 
                    className="ctaBtn proCta" 
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    style={{ flex: 1, margin: 0, background: '#ff3b30', borderColor: '#ff3b30' }}
                >
                    {cancelling ? 'Cancelling...' : 'Confirm cancellation'}
                </button>
            </div>
        </div>
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
                    Yearly <span className="saveBadge">SAVE 10%</span>
                </span>
            </div>

            <div id="pricing" className="plansGrid">
                <div className="planCard glassCard">
                    <div className="planName">Creator Basic</div>
                    <div className="planPrice">$0<span>/mo</span></div>
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
                        ${isYearly ? (pricing.yearly_price / 12).toFixed(2) : pricing.monthly_price.toFixed(2)}
                        <span>/mo</span>
                    </div>
                    <ul className="featureList">
                        <li className="featureItem"><Sparkles size={18} className="sparkIcon" /> <strong>4K Video Playback</strong></li>
                        <li className="featureItem"><Flame size={18} className="sparkIcon" /> <strong>Unlimited Uploads</strong></li>
                        <li className="featureItem"><Award size={18} className="sparkIcon" /> <strong>Access to Gold Challenges</strong></li>
                        <li className="featureItem"><Users size={18} className="sparkIcon" /> <strong>Pro Profile Badge</strong></li>
                        <li className="featureItem"><Rocket size={18} className="sparkIcon" /> <strong>Priority Support</strong></li>
                        <li className="featureItem"><LayoutGrid size={18} className="sparkIcon" /> <strong>Ad-Free Browsing</strong></li>
                    </ul>
                    <button 
                        className="ctaBtn proCta" 
                        onClick={handleSelectPlan} 
                        disabled={loading}
                    >
                        UPGRADE TO PRO
                    </button>
                </div>
            </div>
        </>
    );

    const renderCheckoutForm = () => (
        <div className="checkoutContainer">
            <div className="checkoutHeader">
                <h2>Secure Checkout</h2>
                <p>Complete your subscription to Monteeq Pro</p>
                <div className="price">
                    ${isYearly ? pricing.yearly_price.toFixed(2) : pricing.monthly_price.toFixed(2)}
                    <span>/{isYearly ? 'year' : 'month'}</span>
                </div>
            </div>
            
            <form onSubmit={handlePaySubscription}>
                <div className="formGrid">
                    <div className="formGroup">
                        <label htmlFor="fullName">Full Name</label>
                        <input 
                            type="text" 
                            id="fullName" 
                            className="formInput" 
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required 
                        />
                    </div>
                    
                    <div className="formGroup">
                        <label htmlFor="billingEmail">Email Address</label>
                        <input 
                            type="email" 
                            id="billingEmail" 
                            className="formInput" 
                            placeholder="john@example.com"
                            value={billingEmail}
                            onChange={(e) => setBillingEmail(e.target.value)}
                            required 
                        />
                    </div>
                    
                    <div className="formGroup">
                        <label htmlFor="billingCountry">Country</label>
                        <select 
                            id="billingCountry" 
                            className="formInput"
                            value={billingCountry}
                            onChange={(e) => setBillingCountry(e.target.value)}
                            required
                        >
                            <option value="US">United States</option>
                            <option value="CA">Canada</option>
                            <option value="GB">United Kingdom</option>
                            <option value="NG">Nigeria</option>
                            <option value="DE">Germany</option>
                            <option value="FR">France</option>
                        </select>
                    </div>
                    
                    <div className="formGroup">
                        <label htmlFor="billingZip">Zip / Postal Code</label>
                        <input 
                            type="text" 
                            id="billingZip" 
                            className="formInput" 
                            placeholder="10001"
                            value={billingZip}
                            onChange={(e) => setBillingZip(e.target.value)}
                            required 
                        />
                    </div>
                    
                    <div className="formGroup formGridFull">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <label style={{ margin: 0 }}>Credit or Debit Card</label>
                            <div className="supportedCardsRow">
                                <span className="cardBrandBadge visa">Visa</span>
                                <span className="cardBrandBadge mastercard">Mastercard</span>
                                <span className="cardBrandBadge amex">Amex</span>
                                <span className="cardBrandBadge discover">Discover</span>
                            </div>
                        </div>
                        <div className={`stripeElementContainer ${cardFocused ? 'focused' : ''}`}>
                            <CardElement 
                                options={CARD_ELEMENT_OPTIONS} 
                                onFocus={() => setCardFocused(true)}
                                onBlur={() => setCardFocused(false)}
                            />
                        </div>
                    </div>
                </div>

                <button 
                    type="submit" 
                    className="ctaBtn proCta" 
                    disabled={loading || !stripe}
                >
                    {loading ? 'Processing Securely...' : 'PAY AND SUBSCRIBE'}
                </button>

                <button 
                    type="button" 
                    className="backBtn" 
                    onClick={() => setCheckoutStep('plans')}
                    disabled={loading}
                >
                    Back to Plans
                </button>

                <div className="securityBadge">
                    <Lock size={14} />
                    <span>Secured by Stripe • PCI Compliant</span>
                </div>
            </form>
        </div>
    );

    const renderSuccessState = () => (
        <div className="successContainer">
            <div className="successIconWrap">
                <Crown size={42} fill="currentColor" />
            </div>
            <h2 className="successTitle">Subscription Active!</h2>
            <p className="successText">
                Thank you for upgrading! Your account is now upgraded to **Monteeq Pro**. 
                You can now upload files in 4K resolution, enter Gold Challenges, and display your Pro Badge!
            </p>
            <button 
                className="successActionBtn" 
                onClick={() => navigate('/')}
            >
                Start Creating
            </button>
        </div>
    );

    return (
        <div className="v2Container">
            <div className="meshGradient" />
            <div className="glowTop" />
            
            <div className="contentWrapper">
                <header className="hero">
                    <div className="heroTag">
                        <Crown size={12} fill="currentColor" /> Monteeq Pro
                    </div>
                    <h1 className="heroTitle">
                        Share your best work in <br/>
                        <span className="textGradient">highest quality.</span>
                    </h1>
                    <p className="heroSubtitle">
                        Get 4K playback, unlimited uploads, and priority support. 
                        Everything you need to grow on Monteeq.
                    </p>
                </header>

                {user?.is_premium ? (
                    <>
                        {cancelStep === 0 && renderProBenefits()}
                        {cancelStep === 1 && renderCancellationStep1()}
                        {cancelStep === 2 && renderCancellationStep2()}
                    </>
                ) : (
                    <>
                        {checkoutStep === 'plans' && (
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
                                        <h3 className="benefitTitle">Faster Processing</h3>
                                        <p className="benefitDesc">Your videos process instantly on our dedicated transcoding servers.</p>
                                    </div>
                                    <div className="benefitItem">
                                        <div className="benefitIcon"><Target size={24} /></div>
                                        <h3 className="benefitTitle">Challenge Access</h3>
                                        <p className="benefitDesc">Enter Gold-only challenges and compete for bigger prizes.</p>
                                    </div>
                                    <div className="benefitItem">
                                        <div className="benefitIcon"><ShieldCheck size={24} /></div>
                                        <h3 className="benefitTitle">Pro Badge</h3>
                                        <p className="benefitDesc">Get the Pro badge on your profile to stand out in the feed.</p>
                                    </div>
                                </section>
                            </>
                        )}

                        {checkoutStep === 'checkout' && renderCheckoutForm()}
                        {checkoutStep === 'success' && renderSuccessState()}
                    </>
                )}

            </div>
        </div>
    );
};

const JoinProV2 = () => {
  return (
    <Elements stripe={stripePromise}>
      <JoinProContent />
    </Elements>
  );
};

export default JoinProV2;
