'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ErrorProvider } from '@/context/ErrorContext';
import { ReportProvider } from '@/context/ReportContext';
import AppShell from '@/components/layout/AppShell';
import VideoCardMenuRouteListener from '@/components/VideoCardMenuRouteListener';
import NotificationManager from '@/components/NotificationManager';
import ErrorBoundary from '@/components/ErrorBoundary';
import DynamicTitle from '@/components/DynamicTitle';
import { useEffect, useState } from 'react';

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '';

function useDeferredAdSense(clientId) {
  useEffect(() => {
    if (!clientId || typeof window === 'undefined') return;
    if (document.querySelector('script[data-monteeq-adsense]')) return;

    window.__ADSENSE_ID = clientId;

    const loadAdSense = () => {
      const s = document.createElement('script');
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.dataset.monteeqAdsense = 'true';
      document.head.appendChild(s);
    };

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(loadAdSense);
      return () => cancelIdleCallback(id);
    }

    const timer = setTimeout(loadAdSense, 3000);
    return () => clearTimeout(timer);
  }, [clientId]);
}

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

  useDeferredAdSense(adsenseClientId);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <ErrorProvider>
            <ReportProvider>
              <VideoCardMenuRouteListener />
              <NotificationManager />
              <DynamicTitle />
              <AppShell>
                <ErrorBoundary>{children}</ErrorBoundary>
              </AppShell>
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
