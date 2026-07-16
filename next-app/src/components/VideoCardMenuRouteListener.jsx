'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { videoCardMenuStore } from '@/stores/videoCardMenuStore';

/** Closes any open video card menu on navigation or scroll. */
export default function VideoCardMenuRouteListener() {
  const pathname = usePathname();

  useEffect(() => {
    videoCardMenuStore.closeMenu();
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      if (videoCardMenuStore.shouldIgnoreScrollClose()) return;
      videoCardMenuStore.closeMenu();
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  return null;
}
