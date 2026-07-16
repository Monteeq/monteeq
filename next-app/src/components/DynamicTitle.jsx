'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const TITLE_MAP = {
  '/': 'Monteeq | Create and Share',
  '/home': 'Home | Monteeq',
  '/flash': 'Flash | Vertical Video',
  '/posts': 'Feed | Monteeq',
  '/challenges': 'Challenges | Win Prizes',
  '/notifications': 'Notifications | Monteeq',
  '/settings': 'Settings | Monteeq',
  '/insights': 'Insights | Creator Studio',
  '/performance': 'Performance | Analytics',
  '/upload': 'Upload | Monteeq',
  '/create-post': 'Create Post | Monteeq',
  '/achievements': 'Achievements | Monteeq',
  '/chat': 'Messages | Monteeq',
  '/pro': 'Join Pro | Monteeq',
  '/about': 'About | Monteeq',
  '/partner': 'Partner with Us | Monteeq',
  '/login': 'Login | Monteeq',
  '/signup': 'Join Monteeq',
  '/verify': 'Verify Account | Monteeq',
  '/onboarding': 'Welcome to Monteeq',
  '/forgot-password': 'Reset Password | Monteeq',
  '/reset-password': 'Reset Password | Monteeq',
  '/manage': 'Manage Content | Studio',
  '/manage-videos': 'Manage Videos | Studio',
  '/admin': 'Admin Portal | Monteeq',
  '/privacy': 'Privacy Policy | Monteeq',
  '/terms': 'Terms of Service | Monteeq',
  '/following': 'Following | Monteeq',
  '/search': 'Search | Monteeq',
  '/history': 'History | Monteeq',
  '/watch-later': 'Watch Later | Monteeq',
  '/liked': 'Liked | Monteeq',
};

/**
 * Client tab-title updates — port of frontend DynamicTitle.
 * Listens for `monteeq:update-title` from Flash/Watch for clip/video titles.
 */
export default function DynamicTitle() {
  const pathname = usePathname() || '/';
  const [customTitle, setCustomTitle] = useState(null);

  useEffect(() => {
    setCustomTitle(null);
  }, [pathname]);

  useEffect(() => {
    const handleUpdate = (e) => {
      setCustomTitle(e.detail);
    };

    window.addEventListener('monteeq:update-title', handleUpdate);
    return () => window.removeEventListener('monteeq:update-title', handleUpdate);
  }, []);

  useEffect(() => {
    let title = customTitle || TITLE_MAP[pathname] || 'Monteeq';

    if (!customTitle) {
      if (pathname.startsWith('/watch/')) {
        title = 'Watch Video | Monteeq';
      } else if (pathname.startsWith('/profile/')) {
        const username = pathname.split('/')[2];
        title = username ? `@${username} | Monteeq` : 'Profile | Monteeq';
      } else if (pathname.startsWith('/flash/')) {
        title = 'Flash | Vertical Video';
      } else if (pathname.startsWith('/post/')) {
        title = 'Post | Monteeq';
      }
    } else if (!title.includes('Monteeq')) {
      title = `${title} | Monteeq`;
    }

    document.title = title;
  }, [pathname, customTitle]);

  return null;
}
