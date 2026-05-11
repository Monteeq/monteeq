import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

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
};

const DynamicTitle = () => {
  const location = useLocation();
  const [customTitle, setCustomTitle] = useState(null);

  useEffect(() => {
    // Reset custom title on route change
    setCustomTitle(null);
  }, [location.pathname]);

  useEffect(() => {
    const handleUpdate = (e) => {
      setCustomTitle(e.detail);
    };

    window.addEventListener('monteeq:update-title', handleUpdate);
    return () => window.removeEventListener('monteeq:update-title', handleUpdate);
  }, []);

  useEffect(() => {
    let title = customTitle || TITLE_MAP[location.pathname] || 'Monteeq';

    if (!customTitle) {
      // Handle Dynamic Routes fallback
      if (location.pathname.startsWith('/watch/')) {
        title = 'Watch Video | Monteeq';
      } else if (location.pathname.startsWith('/profile/')) {
        const username = location.pathname.split('/')[2];
        title = username ? `@${username} | Monteeq` : 'Profile | Monteeq';
      }
    } else {
      // If it's a custom title, append the brand suffix if not present
      if (!title.includes('Monteeq')) {
        title = `${title} | Monteeq`;
      }
    }

    document.title = title;
  }, [location, customTitle]);

  return null;
};

export default DynamicTitle;
