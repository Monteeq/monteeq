'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ErrorProvider } from '@/context/ErrorContext';
import { ReportProvider } from '@/context/ReportContext';
import AppShell from '@/components/layout/AppShell';
import VideoCardMenuRouteListener from '@/components/VideoCardMenuRouteListener';
import { useState } from 'react';

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

function AppProviders({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 30,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <ErrorProvider>
            <ReportProvider>
              <VideoCardMenuRouteListener />
              <AppShell>{children}</AppShell>
            </ReportProvider>
          </ErrorProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default function Providers({ children }) {
  if (!googleClientId) {
    return <AppProviders>{children}</AppProviders>;
  }
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AppProviders>{children}</AppProviders>
    </GoogleOAuthProvider>
  );
}
