'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/browserApi';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
const logo = '/images/logo.png';

const Verify = () => {
    const { user, loading, logout, refreshUser } = useAuth();
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const { showNotification } = useNotification();

    // If not logged in, redirect to login
    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
        // If already verified, redirect to home
        if (!loading && user?.is_verified) {
            navigate('/home');
        }
    }, [user, loading, navigate]);

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        if (isLoading || !user) return;
        setError('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, code: verificationCode })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Verification failed');

            showNotification('success', 'Email verified successfully!');
            
            // Navigate based on onboarding status
            const updatedUser = await refreshUser();
            if (updatedUser && !updatedUser.is_onboarded) {
                navigate('/onboarding');
            } else {
                navigate('/home');
            }
        } catch (err) {
            setError(err.message || 'Verification failed');
            showNotification('error', err.message || 'Verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (isResending || !user) return;
        setError('');
        setIsResending(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Failed to resend code');
            showNotification('success', 'A new verification code has been sent!');
        } catch (err) {
            setError(err.message || 'Failed to resend code');
            showNotification('error', err.message || 'Failed to resend code');
        } finally {
            setIsResending(false);
        }
    };

    if (loading) return null;

    return (
        <div className="auth-container">
            <div className="auth-card glass">
                <div className="auth-header">
                    <div className="logo-section" style={{ justifyContent: 'center', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={logo} alt="Monteeq" style={{ height: '32px', width: 'auto' }} />
                        <span style={{ fontWeight: 900, letterSpacing: '-0.5px', fontSize: '1.2rem' }}>MONTEEQ</span>
                    </div>
                    <h1>Verify Your Email</h1>
                    <p>We've sent a 6-digit code to <strong>{user?.email}</strong></p>
                </div>

                {error && (
                    <div style={{
                        color: 'var(--accent-primary)',
                        background: 'rgba(255, 60, 60, 0.1)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.9rem',
                        textAlign: 'center',
                        border: '1px solid rgba(255, 60, 60, 0.2)'
                    }}>
                        {error}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleVerifyCode}>
                    <div className="input-group">
                        <label>Verification Code</label>
                        <input
                            type="text"
                            maxLength="6"
                            placeholder="123456"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', fontWeight: 'bold' }}
                            required
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        className="auth-button"
                        disabled={isLoading || verificationCode.length < 6}
                        style={{
                            opacity: (isLoading || verificationCode.length < 6) ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {isLoading ? (
                            <><Loader2 size={18} className="animate-spin" /> Verifying…</>
                        ) : 'Verify & Continue'}
                    </button>
                </form>

                <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={handleResendCode}
                        className="auth-link"
                        disabled={isResending}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            cursor: isResending ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: isResending ? 0.6 : 1
                        }}
                    >
                        {isResending ? (
                            <><Loader2 size={14} className="animate-spin" /> Sending…</>
                        ) : 'Resend Code'}
                    </button>
                    <button
                        onClick={() => logout()}
                        className="auth-link"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', opacity: 0.7 }}
                    >
                        <ArrowLeft size={14} /> Log out and use another email
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Verify;
