'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Zap,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  Globe,
  Shield,
  Key,
  ChevronLeft,
} from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import { authErrorMessage, getSafeRedirectPath } from '@/lib/authHelpers';

/** lucide-react v1 dropped `Chrome` (present in Vite's 0.469) */
const Chrome = Globe;

/**
 * Port of frontend/src/pages/Login.jsx
 * Fix vs Vite: honors ?redirect= for safe relative paths (AdminPortal already uses it).
 */
export default function LoginForm() {
  const [activeTab, setActiveTab] = useState('google');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState('login');
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isUsingRecoveryCode, setIsUsingRecoveryCode] = useState(false);

  const { login, googleLogin, verifyLogin2FA } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterAuthPath = getSafeRedirectPath(searchParams.get('redirect'), '/home');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await login({ username, password });
      if (result?.two_factor_required) {
        setTwoFactorData(result);
        setStep('2fa');
        setIsLoading(false);
        return;
      }
      router.push(afterAuthPath);
    } catch (err) {
      setError(authErrorMessage(err, 'Invalid username or password'));
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    if (isLoading || !twoFactorCode) return;
    setError('');
    setIsLoading(true);
    try {
      await verifyLogin2FA(twoFactorData.username, twoFactorCode);
      router.push(afterAuthPath);
    } catch (err) {
      setError(authErrorMessage(err, 'Invalid verification code'));
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="auth-v4-page">
      <div className="auth-v4-bg" />

      <div className="auth-v4-container">
        <motion.div
          className="auth-v4-card"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="wait">
            {step === 'login' ? (
              <motion.div
                key="login-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <motion.div variants={itemVariants} className="auth-v4-header">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/logo.png" alt="Monteeq" className="auth-v4-logo-img" />
                  <h1 className="auth-v4-title">
                    Welcome <br />
                    <span className="auth-v4-outline">Back.</span>
                  </h1>
                  <p>Sign in to your Monteeq account.</p>
                </motion.div>

                <motion.div variants={itemVariants} className="auth-v4-tabs">
                  <button
                    type="button"
                    className={`auth-v4-tab ${activeTab === 'google' ? 'active' : ''}`}
                    onClick={() => setActiveTab('google')}
                  >
                    <Chrome size={16} /> Google
                  </button>
                  <button
                    type="button"
                    className={`auth-v4-tab ${activeTab === 'email' ? 'active' : ''}`}
                    onClick={() => setActiveTab('email')}
                  >
                    <Mail size={16} /> Email
                  </button>
                  <motion.div
                    className="auth-v4-tab-indicator"
                    animate={{ x: activeTab === 'google' ? '0%' : '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </motion.div>

                {error && (
                  <motion.div variants={itemVariants} className="auth-v4-error">
                    {error}
                  </motion.div>
                )}

                <div className="auth-v4-content-area">
                  <AnimatePresence mode="wait">
                    {activeTab === 'email' ? (
                      <motion.form
                        key="email-form"
                        className="auth-v4-form"
                        onSubmit={handleSubmit}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <div className="auth-v4-group">
                          <label htmlFor="login-username">Username or Email</label>
                          <input
                            id="login-username"
                            name="username"
                            type="text"
                            placeholder="your_username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                          />
                        </div>

                        <div className="auth-v4-group">
                          <div className="auth-v4-label-row">
                            <label htmlFor="login-password">Password</label>
                            <Link href="/forgot-password">Forgot?</Link>
                          </div>
                          <div className="auth-v4-input-wrap">
                            <input
                              id="login-password"
                              name="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                            <button
                              type="button"
                              className="auth-v4-toggle"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>

                        <button type="submit" className="auth-v4-btn" disabled={isLoading}>
                          {isLoading ? (
                            <Loader2 className="spin" />
                          ) : (
                            <>
                              Log In <ArrowRight size={18} />
                            </>
                          )}
                        </button>
                      </motion.form>
                    ) : (
                      <motion.div
                        key="google-area"
                        className="auth-v4-social-tab"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <div className="auth-v4-social-info">
                          <Chrome size={48} color="#eb0000" strokeWidth={1} />
                          <h3>Express Login</h3>
                          <p>Securely sign in using your Google account in one click.</p>
                        </div>

                        <div className="auth-v4-social-btn-wrap">
                          {isLoading ? (
                            <div className="auth-v4-social-loading">
                              <Loader2 className="spin" />
                              <span>Restoring Session...</span>
                            </div>
                          ) : googleClientId ? (
                            <GoogleLogin
                              onSuccess={(res) => {
                                setIsLoading(true);
                                googleLogin(res.credential)
                                  .then((result) => {
                                    if (result?.two_factor_required) {
                                      setTwoFactorData(result);
                                      setStep('2fa');
                                      setIsLoading(false);
                                    } else {
                                      router.push(afterAuthPath);
                                    }
                                  })
                                  .catch((err) => {
                                    setError(authErrorMessage(err, 'Google Login Failed'));
                                    setIsLoading(false);
                                  });
                              }}
                              onError={() => setError('Google Auth Failed')}
                              theme="filled_black"
                              shape="pill"
                              width="100%"
                              text="signin_with"
                            />
                          ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              Google sign-in is not configured (set NEXT_PUBLIC_GOOGLE_CLIENT_ID).
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.div variants={itemVariants} className="auth-v4-footer">
                  New here? <Link href="/signup">Create Account</Link>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="2fa-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <motion.div variants={itemVariants} className="auth-v4-header">
                  <div
                    className="auth-v4-icon-circle"
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(235, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.5rem',
                    }}
                  >
                    <Shield size={32} color="var(--accent-primary)" />
                  </div>
                  <h1 className="auth-v4-title">
                    Two-Factor <br />
                    <span className="auth-v4-outline">Shield.</span>
                  </h1>
                  <p>Please enter the code from your authenticator app.</p>
                </motion.div>

                {error && (
                  <motion.div variants={itemVariants} className="auth-v4-error">
                    {error}
                  </motion.div>
                )}

                <div className="auth-v4-content-area">
                  <form className="auth-v4-form" onSubmit={handle2FAVerify}>
                    <div className="auth-v4-group">
                      <label htmlFor="login-2fa-code">
                        {isUsingRecoveryCode ? 'Recovery Code' : 'Verification Code'}
                      </label>
                      <div className="auth-v4-input-wrap">
                        <input
                          id="login-2fa-code"
                          name="twoFactorCode"
                          type="text"
                          placeholder={isUsingRecoveryCode ? 'XXXX-XXXX-XXXX' : '000 000'}
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          style={{
                            textAlign: 'center',
                            letterSpacing: isUsingRecoveryCode ? '2px' : '8px',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                          }}
                          required
                          autoFocus
                        />
                        <div
                          className="auth-v4-input-icon"
                          style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            opacity: 0.5,
                          }}
                        >
                          {isUsingRecoveryCode ? <Key size={18} /> : <Shield size={18} />}
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="auth-v4-btn" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="spin" />
                      ) : (
                        <>
                          Verify Shield <Zap size={18} fill="currentColor" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="auth-v4-link-btn"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        marginTop: '1rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                      onClick={() => {
                        setIsUsingRecoveryCode(!isUsingRecoveryCode);
                        setTwoFactorCode('');
                        setError('');
                      }}
                    >
                      {isUsingRecoveryCode ? 'Use Authenticator App' : 'Use Recovery Code'}
                    </button>
                  </form>
                </div>

                <motion.div variants={itemVariants} className="auth-v4-footer">
                  <button
                    type="button"
                    className="auth-v4-back-btn"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                    onClick={() => setStep('login')}
                  >
                    <ChevronLeft size={16} /> Back to Login
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
