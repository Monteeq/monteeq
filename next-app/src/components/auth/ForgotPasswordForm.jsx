'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { checkEmailExists, requestPasswordReset } from '@/lib/clientApi';
import { authErrorMessage } from '@/lib/authHelpers';

/** Port of frontend/src/pages/ForgotPassword.jsx */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [emailStatus, setEmailStatus] = useState({
    checked: false,
    exists: false,
    loading: false,
  });
  const timerRef = useRef(null);

  const checkEmail = useCallback((val) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!val || !val.includes('@')) {
        setEmailStatus({ checked: false, exists: false, loading: false });
        return;
      }
      setEmailStatus((prev) => ({ ...prev, loading: true }));
      try {
        const data = await checkEmailExists(val);
        setEmailStatus({ checked: true, exists: data.exists, loading: false });
      } catch {
        setEmailStatus((prev) => ({ ...prev, loading: false }));
      }
    }, 500);
  }, []);

  useEffect(() => {
    checkEmail(email);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [email, checkEmail]);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (status === 'loading' || !emailStatus.exists) return;
    setError('');
    setStatus('loading');
    try {
      await requestPasswordReset(email);
      setStatus('success');
    } catch (err) {
      setError(authErrorMessage(err, 'Something went wrong'));
      setStatus('error');
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
          <motion.div variants={itemVariants} className="auth-v4-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Monteeq" className="auth-v4-logo-img" />
            <h1 className="auth-v4-title">
              Forgot <br />
              <span className="auth-v4-outline">Access.</span>
            </h1>
            <p>Verify your email to restore your professional identity.</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="auth-v4-success-state"
              >
                <motion.div
                  className="auth-v4-success-icon-wrap"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                >
                  <CheckCircle2 size={64} color="#34c759" className="auth-v4-success-pulse" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <h3 className="auth-v4-outline" style={{ fontSize: '2rem', margin: '1rem 0' }}>
                    Link Sent.
                  </h3>
                  <p style={{ color: '#aaa', lineHeight: '1.6', marginBottom: '2rem' }}>
                    A secure reset link has been dispatched to <br />
                    <span style={{ color: '#fff', fontWeight: '700' }}>{email}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Link href="/login" className="auth-v4-btn">
                    Return to Login <ArrowRight size={18} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStatus('idle')}
                    className="auth-v4-resend"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      marginTop: '1.5rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Didn&apos;t get it? Try again
                  </button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                className="auth-v4-form"
                onSubmit={handleRequestReset}
                exit={{ opacity: 0, x: -20 }}
              >
                {error && <div className="auth-v4-error">{error}</div>}

                <div className="auth-v4-group">
                  <label htmlFor="forgot-email">Registered Email</label>
                  <div className="auth-v4-input-wrap">
                    <input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={status === 'loading'}
                      className={emailStatus.checked && !emailStatus.exists ? 'error-input' : ''}
                    />
                    {emailStatus.loading && (
                      <Loader2 className="auth-v4-field-loader spin" size={16} />
                    )}
                  </div>
                  <AnimatePresence>
                    {emailStatus.checked && !emailStatus.exists && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="auth-v4-field-error"
                      >
                        <AlertTriangle size={12} /> This email is not registered on Monteeq.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="submit"
                  className="auth-v4-btn"
                  disabled={status === 'loading' || (emailStatus.checked && !emailStatus.exists)}
                >
                  {status === 'loading' ? (
                    <Loader2 className="spin" />
                  ) : (
                    <>
                      Send Reset Link <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="auth-v4-footer">
            Remembered? <Link href="/login">Back to Login</Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
