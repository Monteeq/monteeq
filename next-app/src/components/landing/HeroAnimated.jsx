"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Share2, Heart, Bookmark } from 'lucide-react';

const HeroAnimated = () => {
    return (
        <div className="hero-animated-wrap">
            <div className="hero-icon-center">
                <motion.div 
                    className="hero-main-zap"
                    animate={{ 
                        scale: [1, 1.1, 1],
                        filter: [
                            "drop-shadow(0 0 10px #eb0000)",
                            "drop-shadow(0 0 30px #eb0000)",
                            "drop-shadow(0 0 10px #eb0000)"
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <Zap size={120} fill="#eb0000" color="#eb0000" strokeWidth={1} />
                </motion.div>

                {/* Orbiting Interaction Icons */}
                {[
                    { Icon: Share2, delay: 0 },
                    { Icon: Heart, delay: 0.5 },
                    { Icon: Bookmark, delay: 1 }
                ].map((item, i) => (
                    <motion.div 
                        key={i}
                        className="hero-orbiting-icon"
                        animate={{ 
                            rotate: 360,
                            x: [Math.cos(i) * 150, Math.cos(i + 2) * 150, Math.cos(i) * 150],
                            y: [Math.sin(i) * 150, Math.sin(i + 2) * 150, Math.sin(i) * 150],
                        }}
                        transition={{ 
                            duration: 10, 
                            repeat: Infinity, 
                            ease: "linear",
                            delay: item.delay
                        }}
                    >
                        <item.Icon size={32} color="#fff" opacity={0.4} />
                    </motion.div>
                ))}
                
                {/* Connecting lines (Visual) */}
                <svg className="hero-lines" viewBox="0 0 400 400">
                    <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(235,0,0,0.1)" strokeWidth="1" strokeDasharray="5,5" />
                </svg>
            </div>
        </div>
    );
};

export default HeroAnimated;
