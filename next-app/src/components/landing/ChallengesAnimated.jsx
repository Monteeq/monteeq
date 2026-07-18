"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star } from 'lucide-react';

const ChallengesAnimated = ({ prize = 'Trophy + Spotlight' }) => {
  return (
    <div className="visual-animated-wrap">
      <div className="challenges-icon-scene">
        <motion.div
          className="challenges-main-trophy"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [-5, 5, -5],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Trophy size={100} color="#eb0000" strokeWidth={1} />
        </motion.div>

        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="challenge-star"
            animate={{
              scale: [0.5, 1, 0.5],
              opacity: [0.2, 0.6, 0.2],
              x: Math.cos(i) * 120,
              y: Math.sin(i) * 120,
            }}
            transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: '-10px',
              marginTop: '-10px',
            }}
          >
            <Star size={20} color="#eb0000" fill="#eb0000" />
          </motion.div>
        ))}

        <div
          style={{
            position: 'absolute',
            bottom: '8%',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(255, 215, 0, 0.35)',
            borderRadius: 8,
            textAlign: 'center',
            minWidth: 140,
          }}
        >
          <div style={{ fontSize: '0.55rem', opacity: 0.5, fontWeight: 800, letterSpacing: '0.08em' }}>
            REWARDS
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#ffd700' }}>{prize}</div>
        </div>
      </div>
    </div>
  );
};

export default ChallengesAnimated;
