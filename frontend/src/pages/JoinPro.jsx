import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Crown, Star, ShieldCheck, Flame } from 'lucide-react';
import { usePaystackPayment } from 'react-paystack';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { verifyProSubscription } from '../api';
import Hero from '../components/partner/Hero';
import Benefits from '../components/partner/Benefits';
import Options from '../components/partner/Options';
import HowItWorks from '../components/partner/HowItWorks';
import CampaignExample from '../components/partner/CampaignExample';
import ContactForm from '../components/partner/ContactForm';
import s from './JoinPro.module.css';

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder';

const JoinPro = () => {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const { user, token, refreshUser } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('PLANS'); // PLANS, SUCCESS, DASHBOARD

  // Detect initial view
  useEffect(() => {
    if (user?.is_premium && view === 'PLANS') {
      setView('DASHBOARD');
    }
  }, [user, view]);

  const plans = {
    free: {
      name: 'Free',
      price: '₦0',
      features: [
        '1080p Viewing',
        'Entry to Bronze Challenges',
        'Standard Processing',
        'Community Support',
      ],
      cta: 'Start for Free',
      accent: 'free',
    },
    pro: {
      name: 'Pro',
      price: isYearly ? '₦1,900' : '₦2,500',
      features: [
        '4K Cinematic Streams',
        'Verified Editor Identity',
        'Access to Gold Challenges',
        'Verified Editor Badge',
        'Priority Rust Engine Transcoding',
      ],
      cta: 'Get Pro Access',
      accent: 'pro',
    },
  };

  const amount = isYearly ? 22800 : 2500; // In Naira
  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || '',
    amount: amount * 100, // Paystack expects kobo
    publicKey: PAYSTACK_PUBLIC_KEY,
  };

  const initializePayment = usePaystackPayment(config);

  const handlePaystackSuccess = async (reference) => {
    setLoading(true);
    try {
      const resp = await verifyProSubscription(reference.reference, token);
      
      if (resp.status === 'success') {
        showNotification('success', 'Welcome to Monteeq Pro!');
        await refreshUser(); // Refresh user state
        setView('SUCCESS');
      } else {
        showNotification('error', resp.message || 'Verification failed.');
      }
    } catch (err) {
      showNotification('error', err?.message || 'Verification failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaystackClose = () => {
    showNotification('info', 'Payment cancelled.');
  };

  const handleJoinPro = () => {
    if (!token) {
      showNotification('info', 'Please log in to join Monteeq Pro');
      return;
    }
    if (user?.is_premium) {
      showNotification('info', 'You are already a Pro member!');
      return;
    }
    initializePayment({ onSuccess: handlePaystackSuccess, onClose: handlePaystackClose });
  };

  if (view === 'SUCCESS') {
    return (
      <div className={s.container}>
        <div className={s.scanlines} />
        <div className={s.vignette} />
        <div className={s.successContainer}>
          <div className={s.successIcon}>
            <Crown size={60} color="#000" />
          </div>
          <h1 className={s.successTitle}>Welcome to the Elite</h1>
          <p className={s.subtitle} style={{ marginBottom: '3rem', fontSize: '1.5rem' }}>
            Your Monteeq Pro membership is now active. <br/>
            Unleash your full potential as a creator.
          </p>
          <button 
            className={s.proCta} 
            style={{ maxWidth: '300px' }}
            onClick={() => setView('DASHBOARD')}
          >
            Enter Pro Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (view === 'DASHBOARD') {
    return (
      <div className={s.container}>
        <div className={s.scanlines} />
        <div className={s.vignette} />
        
        <div className={s.proDashboard}>
          <div className={s.dashboardHeader}>
            <div className={s.dashTitle}>
              <Crown size={32} color="#ffd700" />
              <span>Monteeq Pro Hub</span>
            </div>
            <div className={s.statusPill}>
              <ShieldCheck size={14} /> Active Membership
            </div>
          </div>

          <div className={s.benefitGrid}>
            <div className={s.benefitCard}>
              <div className={s.benefitIcon}><Zap size={24} /></div>
              <div className={s.benefitLabel}>4K Cinematic</div>
              <div className={s.benefitDesc}>Streaming and uploads are now unlocked at maximum quality.</div>
            </div>
            <div className={s.benefitCard}>
              <div className={s.benefitIcon}><Star size={24} /></div>
              <div className={s.benefitLabel}>Verified Status</div>
              <div className={s.benefitDesc}>Your profile features the exclusive Pro Editor badge for professional trust.</div>
            </div>
            <div className={s.benefitCard}>
              <div className={s.benefitIcon}><Flame size={24} /></div>
              <div className={s.benefitLabel}>Gold Challenges</div>
              <div className={s.benefitDesc}>Exclusive entry to high-stakes tournaments and recognition.</div>
            </div>
            <div className={s.benefitCard}>
              <div className={s.benefitIcon}><ShieldCheck size={24} /></div>
              <div className={s.benefitLabel}>Verified Status</div>
              <div className={s.benefitDesc}>Your profile now features the exclusive Pro Editor badge.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
            <button className={s.proCta} style={{ maxWidth: '280px' }} onClick={() => navigate('/upload')}>
              Upload 4K Content
            </button>
            <button className={s.freeCta} style={{ maxWidth: '280px' }} onClick={() => navigate('/insights')}>
              View Insights
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.container}>
      <div className={s.scanlines} />
      <div className={s.vignette} />

      <Hero 
         onCtaClick={() => document.getElementById('plans').scrollIntoView({ behavior: 'smooth' })} 
         onWatchClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })} 
      />
      
      <div className={s.contentWrapper}>
        <div id="how-it-works">
          <HowItWorks />
        </div>
        <Benefits />
        <Options />
        <CampaignExample />

        <div id="plans" className={s.plansSection}>
          <div className={s.header}>
            <h1 className={s.title}>Level Up Your Monteeq Game</h1>
            <p className={s.subtitle}>
              Join the elite league of creators with Monteeq Pro. Unlock 4K streaming, 
              priority transcoding, and professional distribution tools.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className={s.toggleContainer}>
            <button 
              className={`${s.toggleBtn} ${!isYearly ? s.activeToggle : ''}`}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </button>
            <button 
              className={`${s.toggleBtn} ${isYearly ? s.activeToggle : ''}`}
              onClick={() => setIsYearly(true)}
            >
              Yearly <span className={s.discount}>Save 25%</span>
            </button>
          </div>

          <div className={s.grid}>
            {/* Free Plan */}
            <div className={s.card}>
              <div className={s.planName}>{plans.free.name}</div>
              <div className={s.price}>{plans.free.price}<span>/mo</span></div>
              <ul className={s.featureList}>
                {plans.free.features.map((f, i) => (
                  <li key={i} className={s.featureItem}>
                    <Check size={18} className={s.checkIcon} />
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`${s.cta} ${s.freeCta}`}>
                {plans.free.cta}
              </button>
            </div>

            {/* Pro Plan */}
            <div className={`${s.card} ${s.proCard}`}>
              <div className={s.badge}>Most Popular</div>
              <div className={s.planName}>
                <Crown size={24} style={{ marginRight: '0.8rem', verticalAlign: 'middle', color: '#ffd700' }} />
                {plans.pro.name}
              </div>
              <div className={s.price}>{plans.pro.price}<span>/mo</span></div>
              <ul className={s.featureList}>
                {plans.pro.features.map((f, i) => (
                  <li key={i} className={s.featureItem}>
                    <Flame size={18} className={s.checkIcon} />
                    <strong>{f}</strong>
                  </li>
                ))}
              </ul>
              <button 
                className={`${s.cta} ${s.proCta}`}
                onClick={handleJoinPro}
                disabled={loading || user?.is_premium}
              >
                {loading ? 'Verifying...' : user?.is_premium ? 'Already Pro' : plans.pro.cta}
              </button>
            </div>
          </div>
        </div>

        <ContactForm />
      </div>

      <div style={{ marginTop: '4rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textAlign: 'center', paddingBottom: '4rem' }}>
        <p>Cancel or pause your subscription at any time. Secure checkout via Monteeq Pay.</p>
        <p>© 2026 Monteeq Platform. All rights reserved.</p>
      </div>
    </div>
  );
};

export default JoinPro;
