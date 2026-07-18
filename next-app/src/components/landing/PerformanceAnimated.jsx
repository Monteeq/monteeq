"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp } from 'lucide-react';

const PerformanceAnimated = ({ views = 0 }) => {
  const nodes = [
    { label: 'SHARES', signal: 'Strongest', color: '#ff4444' },
    { label: 'COMMENTS', signal: 'Strong', color: '#eb0000' },
    { label: 'LIKES', signal: 'Solid', color: '#ff7777' },
    { label: 'VIEWS', signal: 'Baseline', color: '#fff' },
  ];

  const reachLabel =
    views >= 1000
      ? `${(views / 1000).toFixed(1).replace(/\.0$/, '')}K`
      : String(views || 0);

  return (
    <div className="visual-animated-wrap">
      <div className="perf-icon-scene">
        <motion.div
          className="perf-main-icon"
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Activity size={80} color="#eb0000" />
        </motion.div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '8px',
            padding: '0 12px',
            pointerEvents: 'none',
          }}
        >
          {nodes.map((n, i) => (
            <motion.div
              key={n.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'rgba(0,0,0,0.55)',
                border: `1px solid ${n.color}44`,
                borderRadius: 6,
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ opacity: 0.55 }}>{n.label}</span>
              <span style={{ color: n.color }}>{n.signal}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="perf-trend-badge"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        >
          <TrendingUp size={20} color="#eb0000" />
          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#eb0000' }}>
            {reachLabel} VIEWS
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export default PerformanceAnimated;
