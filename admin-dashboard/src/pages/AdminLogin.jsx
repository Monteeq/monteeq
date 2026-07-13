import { lazy, Suspense, useCallback, useMemo, useReducer, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { login } from '../api';
const BrandPanel  = lazy(() => import('../components/BrandPanel'));
const LoginToast  = lazy(() => import('../components/LoginToast'));

import '../styles/variables.css';
import '../styles/animations.css';
import '../styles/login.css';

/* ── Validation schema ──────────────────────────────────────── */

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Please enter your admin email or username'),
  password: z.string().min(1, 'Please enter your password'),
  remember: z.boolean().optional(),
});

/* ── Toast reducer ──────────────────────────────────────────── */

let _tid = 0;

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [action.item, ...state].slice(0, 5);
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

function useToasts() {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++_tid;
    dispatch({ type: 'ADD', item: { id, message, type } });
    if (duration > 0) {
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
    }
    return id;
  }, []);

  const dismiss = useCallback(
    (id) => dispatch({ type: 'REMOVE', id }),
    [],
  );

  return { toasts, addToast, dismiss };
}

/* ── Page-level animation variants ─────────────────────────── */

const pageVariants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const shellVariants = {
  hidden:  { opacity: 0, scale: 0.97, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 },
  },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 },
  },
};

/* ── Component ──────────────────────────────────────────────── */

export default function AdminLogin({ setToken }) {
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toasts, addToast, dismiss } = useToasts();

  /* ── React Hook Form + Zod ── */
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
    watch,
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { remember: true },
  });

  /* Live field values for success state styling */
  const watchedUsername = watch('username');
  const watchedPassword = watch('password');

  /* ── Submit handler ── */
  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const data = await login(values.username, values.password);
      const token = data?.access_token;
      if (!token) throw new Error('The server did not return an access token.');

      if (values.remember) {
        localStorage.setItem('adminRemember', 'true');
        localStorage.setItem('adminLastLogin', new Date().toLocaleDateString());
      } else {
        localStorage.removeItem('adminRemember');
      }

      addToast('Signed in successfully. Redirecting…', 'success', 2500);
      setToken(token);
      localStorage.setItem('adminToken', token);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Unable to sign in. Please try again.';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Last login label ── */
  const lastLoginLabel = useMemo(() => {
    const stored = localStorage.getItem('adminLastLogin');
    return stored ? `Last access: ${stored}` : 'Secure administrator login';
  }, []);

  /* ── Field classes helper ── */
  const fieldClass = (name, rawValue) => {
    const hasError = !!errors[name];
    const hasValue = rawValue?.trim?.().length > 0;
    if (hasError) return 'field field-error-state';
    if (hasValue && touchedFields[name] && !hasError) return 'field field-success-state';
    return 'field';
  };

  return (
    <motion.div
      className="login-page"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Split-screen shell ── */}
      <motion.div
        className="login-shell"
        variants={shellVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Left — Brand panel */}
        <Suspense fallback={null}>
          <BrandPanel />
        </Suspense>

        {/* Right — Auth panel */}
        <div className="auth-panel">
          <motion.div
            className="auth-card"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            {/* ── Header ── */}
            <div className="auth-header">
              <motion.div
                className="auth-icon-wrap"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <Sparkles size={22} />
              </motion.div>

              <motion.h2
                className="auth-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                Welcome back
              </motion.h2>

              <motion.p
                className="auth-subtitle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                Sign in to your Monteeq Admin Dashboard.
              </motion.p>
            </div>

            <div className="auth-divider" />

            {/* ── Form ── */}
            <motion.form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              {/* Email / Username */}
              <div className="form-group">
                <label className="form-label" htmlFor="username">
                  Email or username
                </label>
                <div className={fieldClass('username', watchedUsername)}>
                  <Mail className="field-icon" size={17} aria-hidden="true" />
                  <input
                    id="username"
                    type="text"
                    placeholder="admin@monteeq.com"
                    autoComplete="username"
                    autoCapitalize="off"
                    spellCheck={false}
                    disabled={submitting}
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <motion.span
                    className="field-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                  >
                    {errors.username.message}
                  </motion.span>
                )}
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <div className={fieldClass('password', watchedPassword)}>
                  <Lock className="field-icon" size={17} aria-hidden="true" />
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    disabled={submitting}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && (
                  <motion.span
                    className="field-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                  >
                    {errors.password.message}
                  </motion.span>
                )}
              </div>

              {/* Remember me + Forgot */}
              <div className="inline-row">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    disabled={submitting}
                    {...register('remember')}
                  />
                  <span className="checkbox-label">Remember me</span>
                </label>
                <button type="button" className="link-btn">
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                id="admin-sign-in-btn"
                className="primary-btn"
                disabled={submitting || !isValid}
                whileHover={!submitting ? { scale: 1.01 } : {}}
                whileTap={!submitting ? { scale: 0.98 } : {}}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Sign in to Dashboard
                  </>
                )}
              </motion.button>

              {/* Security badge */}
              <motion.div
                className="security-badge"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <Lock size={13} />
                {lastLoginLabel}
              </motion.div>
            </motion.form>

            {/* Card footer */}
            <p className="auth-footer">
              © {new Date().getFullYear()} Monteeq · Version 1.0.0
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Toast notifications ── */}
      <Suspense fallback={null}>
        <LoginToast toasts={toasts} onDismiss={dismiss} />
      </Suspense>
    </motion.div>
  );
}
