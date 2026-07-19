import { lazy, Suspense, useCallback, useMemo, useReducer, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';

import { login } from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const LoginToast = lazy(() => import('../components/LoginToast'));

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

/* ── Component ──────────────────────────────────────────────── */

export default function AdminLogin({ setToken }) {
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toasts, addToast, dismiss } = useToasts();

  /* ── React Hook Form + Zod ── */
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { remember: true },
  });

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

  const formError =
    errors.username?.message || errors.password?.message || null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 text-gray-900 [color-scheme:light]">
      <Card className="w-full max-w-[400px] border border-gray-200 bg-white shadow-sm">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-2xl text-gray-900">Admin Login</CardTitle>
          <CardDescription className="text-gray-500">
            {lastLoginLabel}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700">
                Email or username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="admin@monteeq.com"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                disabled={submitting}
                className="border-gray-300 bg-white text-gray-900"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-red-600" role="alert">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  disabled={submitting}
                  className="border-gray-300 bg-white pr-10 text-gray-900"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-800"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={submitting}
                  {...register('remember')}
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-sm font-medium text-gray-700 underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              id="admin-sign-in-btn"
              className="w-full"
              disabled={submitting || !isValid}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Sign in to Dashboard
                </>
              )}
            </Button>

            {formError && (
              <p className="text-center text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-gray-500">
              <Lock size={13} />
              {lastLoginLabel}
            </div>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Monteeq · Version 1.0.0
          </p>
        </CardFooter>
      </Card>

      <Suspense fallback={null}>
        <LoginToast toasts={toasts} onDismiss={dismiss} />
      </Suspense>
    </div>
  );
}
