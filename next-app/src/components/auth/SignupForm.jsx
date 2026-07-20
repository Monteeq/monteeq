'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import {
  checkUsernameAvailable,
  checkEmailAvailable,
  verifyEmail,
  resendVerification,
} from '@/lib/clientApi';
import { authErrorMessage } from '@/lib/authHelpers';

/** Port of frontend/src/pages/Signup.jsx */
export default function SignupForm() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isEmailAvailable, setIsEmailAvailable] = useState(null);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [password, setPassword] = useState('');
  const [isAvailable, setIsAvailable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [usernameTimer, setUsernameTimer] = useState(null);
  const [emailTimer, setEmailTimer] = useState(null);

  const { signup, login, googleLogin } = useAuth();
  const router = useRouter();
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const passwordRequirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Lowercase', met: /[a-z]/.test(password) },
    { label: 'Digit', met: /[0-9]/.test(password) },
    {
      label: 'Special symbol',
      met: /[!@#$%^&*()\-_=+[\]{}|;:'",.<>/?`~]/.test(password),
    },
  ];

  const isPasswordValid = passwordRequirements.every((req) => req.met);

  const checkUsername = async (val) => {
    if (val.length < 3) {
      setIsAvailable(null);
      return;
    }
    setIsChecking(true);
    try {
      const data = await checkUsernameAvailable(val);
      setIsAvailable(data.available);
    } catch (err) {
      console.error('Availability check failed', err);
    } finally {
      setIsChecking(false);
    }
  };

  const checkEmail = async (val) => {
    if (!val.includes('@') || val.length < 5) {
      setIsEmailAvailable(null);
      return;
    }
    setIsEmailChecking(true);
    try {
      const data = await checkEmailAvailable(val);
      setIsEmailAvailable(data.available);
    } catch (err) {
      console.error('Email check failed', err);
    } finally {
      setIsEmailChecking(false);
    }
  };

  const handleUsernameChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/\s/g, '');
    setUsername(val);
    if (usernameTimer) clearTimeout(usernameTimer);
    setUsernameTimer(setTimeout(() => checkUsername(val), 400));
  };

  const handleEmailChange = (e) => {
    const val = e.target.value.toLowerCase();
    setEmail(val);
    if (emailTimer) clearTimeout(emailTimer);
    setEmailTimer(setTimeout(() => checkEmail(val), 400));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    if (isAvailable === false) {
      setError('Username is already taken');
      return;
    }
    if (isEmailAvailable === false) {
      setError('Email is already registered. Please login.');
      return;
    }
    if (!isPasswordValid) {
      setError('Please meet all password requirements');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setIsLoading(true);
    try {
      await signup({ username, full_name: fullName, email, password });
      setIsVerifying(true);
    } catch (err) {
      setError(authErrorMessage(err, 'Failed to sign up'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      await verifyEmail({ email, code: verificationCode });
      await login({ username, password });
      router.push('/home');
    } catch (err) {
      setError(authErrorMessage(err, 'Verification failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (isResending) return;
    setError('');
    setIsResending(true);
    try {
      await resendVerification(email);
      setError('');
    } catch (err) {
      setError(authErrorMessage(err, 'Failed to resend code'));
    } finally {
      setIsResending(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="auth-v4-page">
      <div className="auth-v4-bg" />

      <div className="auth-v4-container">
        <AnimatePresence mode="wait">
          {isVerifying ? (
            <motion.div
              key="verify"
              className="auth-v4-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <div className="auth-v4-header">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.png" alt="Monteeq" className="auth-v4-logo-img" />
                <h1 className="auth-v4-title">
                  Verify <br />
                  <span className="auth-v4-outline">Email.</span>
                </h1>
                <p>
                  Enter the 6-digit code sent to <strong>{email}</strong>
                </p>
              </div>

              {error && <div className="auth-v4-error">{error}</div>}

              <form className="auth-v4-form" onSubmit={handleVerifyCode}>
                <div className="auth-v4-group">
                  <input
                    id="signup-verify-code"
                    name="verificationCode"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="auth-v4-code-input"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="auth-v4-btn"
                  disabled={isLoading || verificationCode.length < 6}
                >
                  {isLoading ? <Loader2 className="spin" /> : 'Complete Verification'}
                </button>
              </form>

              <div className="auth-v4-footer">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="auth-v4-link-btn"
                >
                  {isResending ? 'Sending...' : 'Resend Code'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsVerifying(false)}
                  className="auth-v4-link-btn"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="signup"
              className="auth-v4-card"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={itemVariants} className="auth-v4-header">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.png" alt="Monteeq" className="auth-v4-logo-img" />
                <h1 className="auth-v4-title">
                  Create <br />
                  <span className="auth-v4-outline">Account.</span>
                </h1>
                <p>Join a network of creative editors.</p>
              </motion.div>

              {error && (
                <motion.div variants={itemVariants} className="auth-v4-error">
                  {error}
                </motion.div>
              )}

              <form className="auth-v4-form" onSubmit={handleSubmit}>
                <motion.div variants={itemVariants} className="auth-v4-group">
                  <label htmlFor="signup-fullname">Full Name</label>
                  <input
                    id="signup-fullname"
                    name="name"
                    type="text"
                    placeholder="Sadiqul Masduq"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="auth-v4-group">
                  <label htmlFor="signup-username">Username</label>
                  <div className="auth-v4-input-wrap">
                    <input
                      id="signup-username"
                      name="username"
                      type="text"
                      placeholder="username"
                      value={username}
                      onChange={handleUsernameChange}
                      className={
                        isAvailable === false ? 'error' : isAvailable === true ? 'success' : ''
                      }
                      required
                    />
                    {isAvailable !== null && (
                      <span className={`auth-v4-status ${isAvailable ? 'success' : 'error'}`}>
                        {isChecking ? '...' : isAvailable ? <Check size={14} /> : '!'}
                      </span>
                    )}
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="auth-v4-group">
                  <label htmlFor="signup-email">Email Address</label>
                  <div className="auth-v4-input-wrap">
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={handleEmailChange}
                      className={
                        isEmailAvailable === false
                          ? 'error'
                          : isEmailAvailable === true
                            ? 'success'
                            : ''
                      }
                      required
                    />
                    {isEmailAvailable !== null && (
                      <span
                        className={`auth-v4-status ${isEmailAvailable ? 'success' : 'error'}`}
                      >
                        {isEmailChecking ? '...' : isEmailAvailable ? <Check size={14} /> : '!'}
                      </span>
                    )}
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="auth-v4-group">
                  <label htmlFor="signup-password">Password</label>
                  <div className="auth-v4-input-wrap">
                    <input
                      id="signup-password"
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
                  <div className="auth-v4-pass-check">
                    {passwordRequirements.map((req, i) => (
                      <span key={i} className={req.met ? 'met' : ''}>
                        {req.label}
                      </span>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className="auth-v4-terms"
                  onClick={() => setAcceptedTerms(!acceptedTerms)}
                  onKeyDown={() => {}}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`auth-v4-checkbox ${acceptedTerms ? 'checked' : ''}`} />
                  <span>
                    I agree to the <Link href="/terms">Terms</Link> and{' '}
                    <Link href="/privacy">Privacy</Link>
                  </span>
                </motion.div>

                <motion.button
                  variants={itemVariants}
                  type="submit"
                  className="auth-v4-btn"
                  disabled={isLoading || !isPasswordValid || isAvailable === false}
                >
                  {isLoading ? (
                    <Loader2 className="spin" />
                  ) : (
                    <>
                      Join Now <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </form>

              <motion.div variants={itemVariants} className="auth-v4-divider">
                OR
              </motion.div>

              <motion.div variants={itemVariants} className="auth-v4-social">
                {isLoading ? (
                  <div className="auth-v4-social-loading">
                    <Loader2 className="spin" />
                    <span>Connecting to Google...</span>
                  </div>
                ) : googleClientId ? (
                  <GoogleLogin
                    onSuccess={(res) => {
                      setIsLoading(true);
                      googleLogin(res.credential)
                        .then(() => router.push('/home'))
                        .catch((err) => {
                          setError(authErrorMessage(err, 'Google Signup Failed'));
                          setIsLoading(false);
                        });
                    }}
                    onError={() => setError('Google Auth Failed')}
                    theme="filled_black"
                    shape="pill"
                    text="signup_with"
                  />
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Google sign-up is not configured (set NEXT_PUBLIC_GOOGLE_CLIENT_ID).
                  </p>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="auth-v4-footer">
                Already in? <Link href="/login">Log In</Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
