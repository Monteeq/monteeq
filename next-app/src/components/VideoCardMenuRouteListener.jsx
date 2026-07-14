'use client';

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { videoCardMenuStore } from '@/stores/videoCardMenuStore';

/** Closes any open video card menu on navigation or scroll. */
const VideoCardMenuRouteListener = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        videoCardMenuStore.closeMenu();
    }, [pathname]);

    useEffect(() => {
        const handleScroll = () => videoCardMenuStore.closeMenu();
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, []);

    return null;
};

export default VideoCardMenuRouteListener;
