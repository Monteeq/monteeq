'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ModernHeader from '@/components/layout/ModernHeader';
import Sidebar from '@/components/layout/Sidebar';
import Footer from '@/components/layout/Footer';
import MeshBackground from '@/components/layout/MeshBackground';

const ONBOARDING_EXCLUDED = ['/onboarding', '/verify', '/payment', '/login', '/signup'];

/**
 * Faithful port of frontend/src/App.jsx AppContent shell.
 * Same hideHeader / hideSidebar / immersive rules — only routing APIs changed.
 */
export default function AppShell({ children }) {
  const { token, user, loading } = useAuth();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  // Vite App.jsx: force /verify then /onboarding when profile incomplete
  React.useEffect(() => {
    if (!token || !user) return;
    if (!user.is_verified && pathname !== '/verify') {
      router.replace('/verify');
      return;
    }
    if (
      user.is_verified &&
      !user.is_onboarded &&
      !ONBOARDING_EXCLUDED.includes(pathname)
    ) {
      router.replace('/onboarding');
    }
  }, [token, user, pathname, router]);

  // Until the client has mounted + auth has resolved, treat as logged-out for
  // layout chrome so SSR HTML and the first client render match.
  const resolvedToken = hasMounted && !loading ? token : null;

  const isFlashPage = pathname.startsWith('/flash');
  const isHomePage = pathname === '/home' || (pathname === '/' && !!resolvedToken);
  const isLandingPage = pathname === '/' && !resolvedToken;

  const isAuthPage = ['/login', '/signup', '/verify', '/forgot-password', '/reset-password'].includes(
    pathname
  );
  const isMarketingPage = ['/about', '/partner', '/privacy', '/terms'].includes(pathname);
  const isPaymentPage = pathname === '/payment';

  const knownPaths = [
    '/',
    '/home',
    '/login',
    '/signup',
    '/verify',
    '/forgot-password',
    '/reset-password',
    '/about',
    '/partner',
    '/pro',
    '/privacy',
    '/terms',
    '/payment',
    '/flash',
    '/search',
    '/settings',
    '/posts',
    '/create-post',
    '/upload',
    '/chat',
    '/manage',
    '/manage-videos',
    '/achievements',
    '/notifications',
    '/insights',
    '/performance',
    '/onboarding',
    '/challenges',
    '/admin',
    '/following',
    // Next-migrated extras (keep shell chrome; Vite knownPaths omitted some library routes)
    '/history',
    '/watch-later',
    '/liked',
  ];

  const isDynamicPath =
    pathname.startsWith('/watch/') ||
    pathname.startsWith('/profile/') ||
    pathname.startsWith('/flash/') ||
    pathname.startsWith('/post/');

  const isNotFound = !knownPaths.includes(pathname) && !isDynamicPath;

  const isImmersive = isAuthPage || isFlashPage || isPaymentPage || isNotFound;
  const hideSidebar = isLandingPage || isImmersive || isMarketingPage || pathname === '/chat';
  const hideHeader = isImmersive || isLandingPage || pathname === '/chat';

  return (
    <div className="app-container">
      <MeshBackground />
      {!hideHeader && (
        <ModernHeader
          onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
          isMenuOpen={isMenuOpen}
        />
      )}
      <div className={hideSidebar ? 'app-layout-fullscreen' : 'app-layout'}>
        {!hideSidebar && <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />}

        {isMenuOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setIsMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'block',
            }}
          />
        )}

        <main
          className={
            hideSidebar
              ? 'landing-page-main'
              : `main-stage ${pathname === '/chat' ? 'chat-stage' : ''} ${
                  pathname === '/pro' ? 'pro-stage' : ''
                } ${isFlashPage ? 'no-padding' : ''} ${isHomePage ? 'home-stage' : ''}`
          }
        >
          <div className={hideSidebar ? 'content-wrapper-fullscreen' : 'content-wrapper'}>
            <div
              style={
                hideSidebar ? { width: '100%', minHeight: '100%' } : { flex: 1, minWidth: '300px' }
              }
            >
              {children}
              {!isImmersive && pathname !== '/chat' && <Footer />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
