"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Award } from 'lucide-react';

const ChallengesAnimated = () => {
    return (
        <div className="visual-animated-wrap">
            <div className="challenges-icon-scene">
                <motion.div 
                    className="challenges-main-trophy"
                    animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [-5, 5, -5]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Trophy size={100} color="#eb0000" strokeWidth={1} />
                </motion.div>

                {/* Orbiting Stars */}
                {[...Array(5)].map((_, i) => (
                    <motion.div 
                        key={i}
                        className="challenge-star"
                        animate={{ 
                            scale: [0.5, 1, 0.5],
                            opacity: [0.2, 0.6, 0.2],
                            x: Math.cos(i) * 120,
                            y: Math.sin(i) * 120
                        }}
                        transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
                        style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: '-10px', marginTop: '-10px' }}
                    >
                        <Star size={20} color="#eb0000" fill="#eb0000" />
                    </motion.div>
                ))}

            </div>
        </div>
    );
};

export default ChallengesAnimated;
