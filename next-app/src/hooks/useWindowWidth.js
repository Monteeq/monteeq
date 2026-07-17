'use client';

import { useState, useEffect } from 'react';

export default function useWindowWidth(fallback = 1200) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    setWidth(window.innerWidth);

    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWidth(window.innerWidth);
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return width;
}
