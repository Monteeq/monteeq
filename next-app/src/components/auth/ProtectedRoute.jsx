'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Straight port of frontend/src/App.jsx ProtectedRoute.
 *
 * Vite:
 *   if (loading) return null;
 *   if (!token) return <Navigate to="/login" replace />;
 *   if (allowedRoles && user && !allowedRoles.includes(user.role))
 *     return <Navigate to="/" replace />;
 *   return children;
 *
 * Next: same gates via useRouter.replace (App Router has no <Navigate>).
 *
 * Usage (same shape as Vite routes):
 *   <ProtectedRoute><Settings /></ProtectedRoute>
 *   <ProtectedRoute allowedRoles={['admin']}><AdminPortal /></ProtectedRoute>
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, loading, user } = useAuth();
  const router = useRouter();

  const needsLogin = !loading && !token;
  const needsRoleHome =
    !loading &&
    !!token &&
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !!user &&
    !allowedRoles.includes(user.role);

  useEffect(() => {
    if (needsLogin) {
      router.replace('/login');
      return;
    }
    if (needsRoleHome) {
      router.replace('/');
    }
  }, [needsLogin, needsRoleHome, router]);

  if (loading) return null;
  if (!token) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;

  return children;
}
