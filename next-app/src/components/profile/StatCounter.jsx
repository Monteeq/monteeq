'use client';

import React, { useEffect, useState } from 'react';
import { motion, animate } from 'framer-motion';

export default function StatCounter({ value, duration = 1.5 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controls = animate(0, value || 0, {
      duration,
      onUpdate: (latest) => setCount(Math.floor(latest)),
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [value, duration]);

  return <motion.span>{count.toLocaleString()}</motion.span>;
}
