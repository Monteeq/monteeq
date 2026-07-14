'use client';

import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import AppShell from '@/components/layout/AppShell';
import { GoogleOAuthProvider } from '@react-oauth/google';

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function Providers({ children }) {
  const tree = (
    <AuthProvider>
      <NotificationProvider>
        <AppShell>{children}</AppShell>
      </NotificationProvider>
    </AuthProvider>
  );

  // Provider requires a clientId; skip wrap when unset so local UI still loads.
  if (!googleClientId) return tree;

  return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
}
