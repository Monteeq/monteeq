'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ChevronRight, CheckCircle2, Sparkles, MapPin, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/browserApi';

const Onboarding = () => {
    const [step, setStep] = useState(1);
    const [interests, setInterests] = useState([]);
    const [referral, setReferral] = useState('');
    const [goals, setGoals] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { token, user, refreshUser } = useAuth();
    const router = useRouter();

    const categories = [
        "AMV/Anime", "gaming", "Football", "Movies/Series", "Animation",
        "Comedy", "Fun", "Dance", "Mood & Sad"
    ];

    const toggleInterest = (cat) => {
        if (interests.includes(cat)) {
            setInterests(interests.filter(i => i !== cat));
        } else {
            setInterests([...interests, cat]);
        }
    };

    const handleComplete = async () => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/users/me/onboarding`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    interests: interests.join(','),
                    referral_source: referral,
                    goals: goals,
                    is_onboarded: true
                })
            });

            if (response.ok) {
                await refreshUser();
                router.push('/home');
            }
        } catch (err) {
            console.error("Onboarding failed", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const steps = [
        {
            title: "Which styles do you love?",
            subtitle: "Select at least 3 categories to personalize your feed",
            icon: <Sparkles className="text-accent-primary" size={32} />
        },
        {
            title: "How did you find us?",
            subtitle: "We'd love to know where you heard about Monteeq",
            icon: <MapPin className="text-blue-400" size={32} />
        },
        {
            title: "What do you want?",
            subtitle: "Help us understand what brings you to the community",
            icon: <Target className="text-green-400" size={32} />
        }
    ];

    const slideVariants = {
        initial: { x: 50, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: -50, opacity: 0 }
    };

    return (
        <div className="onboarding-container auth-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="onboarding-card glass"
                style={{ maxWidth: '600px', width: '90%', padding: '3rem', borderRadius: '32px', position: 'relative', overflow: 'hidden' }}
            >
                {/* Progress Bar */}
                <div className="onboarding-progress" style={{ display: 'flex', gap: '8px', marginBottom: '2.5rem' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{
                            flex: 1,
                            height: '6px',
                            borderRadius: '3px',
                            background: step >= i ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: step >= i ? '0 0 10px rgba(255, 60, 60, 0.3)' : 'none'
                        }} />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        variants={slideVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                    >
                        <div className="onboarding-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}
                            >
                                <div style={{
                                    padding: '1.5rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '50%',
                                    boxShadow: 'inset 0 0 20px rgba(255,255,255,0.05)'
                                }}>
                                    {steps[step - 1].icon}
                                </div>
                            </motion.div>
                            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>{steps[step - 1].title}</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                                {steps[step - 1].subtitle}
                                {step === 1 && (
                                    <span style={{
                                        marginLeft: '0.6rem',
                                        fontWeight: '700',
                                        color: interests.length >= 3 ? '#4caf50' : 'var(--text-secondary)'
                                    }}>
                                        ({interests.length}/3 selected)
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="onboarding-content" style={{ minHeight: '300px' }}>
                            {step === 1 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
                                    {categories.map((cat, idx) => (
                                        <motion.button
                                            key={cat}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            onClick={() => toggleInterest(cat)}
                                            className={`interest-tag ${interests.includes(cat) ? 'active' : ''}`}
                                            style={{
                                                padding: '16px 12px',
                                                borderRadius: '16px',
                                                border: '1px solid',
                                                borderColor: interests.includes(cat) ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                                                background: interests.includes(cat) ? 'rgba(255, 60, 60, 0.1)' : 'rgba(255,255,255,0.02)',
                                                color: interests.includes(cat) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                fontWeight: '600',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {cat}
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {step === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {["YouTube", "Friend", "Social Media", "Advertisement", "Other"].map((opt, idx) => (
                                        <motion.button
                                            key={opt}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            onClick={() => setReferral(opt)}
                                            style={{
                                                padding: '1.4rem',
                                                borderRadius: '20px',
                                                textAlign: 'left',
                                                background: referral === opt ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                                                border: '1px solid',
                                                borderColor: referral === opt ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                                color: 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'all 0.3s ease'
                                            }}
                                            whileHover={{ x: 10, background: 'rgba(255,255,255,0.08)' }}
                                        >
                                            <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>{opt}</span>
                                            {referral === opt && <CheckCircle2 size={24} color="var(--accent-primary)" />}
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {step === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {[
                                        "Find inspiration for my next edit",
                                        "Share my creations with the world",
                                        "Learn new VFX & Editing techniques",
                                        "Discover the best editors",
                                        "Build a cinematic portfolio"
                                    ].map((opt, idx) => (
                                        <motion.button
                                            key={opt}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            onClick={() => setGoals(opt)}
                                            style={{
                                                padding: '1.4rem',
                                                borderRadius: '20px',
                                                textAlign: 'left',
                                                background: goals === opt ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                                                border: '1px solid',
                                                borderColor: goals === opt ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                                color: 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'all 0.3s ease'
                                            }}
                                            whileHover={{ x: 10, background: 'rgba(255,255,255,0.08)' }}
                                        >
                                            <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>{opt}</span>
                                            {goals === opt && <CheckCircle2 size={24} color="var(--accent-primary)" />}
                                        </motion.button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="onboarding-footer" style={{ marginTop: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={() => step > 1 && setStep(step - 1)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600,
                            visibility: step === 1 ? 'hidden' : 'visible'
                        }}
                    >
                        Back
                    </button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => step < 3 ? setStep(step + 1) : handleComplete()}
                        disabled={isSubmitting || (step === 1 && interests.length < 3)}
                        className="auth-button"
                        style={{
                            width: 'auto',
                            padding: '16px 40px',
                            margin: 0,
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '1.1rem',
                            opacity: (step === 1 && interests.length < 3) ? 0.5 : 1,
                            boxShadow: '0 10px 20px rgba(255, 60, 60, 0.2)'
                        }}
                    >
                        {step === 3 ? (isSubmitting ? "Setting up..." : "Start Exploring") : "Next Step"}
                        <ChevronRight size={20} />
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

export default Onboarding;
