"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp } from 'lucide-react';

const PerformanceAnimated = () => {
    return (
        <div className="visual-animated-wrap">
            <div className="perf-icon-scene">
                <motion.div 
                    className="perf-main-icon"
                    animate={{ y: [-10, 10, -10] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Activity size={80} color="#eb0000" />
                </motion.div>

                {/* Animated Bar Chart Overlay */}
                <div className="perf-bars-overlay">
                    {[40, 70, 50, 90, 60].map((h, i) => (
                        <motion.div 
                            key={i}
                            className="perf-bar-item"
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ duration: 1, delay: i * 0.1, repeat: Infinity, repeatType: "reverse" }}
                            style={{ 
                                width: '12px', 
                                background: i === 3 ? '#eb0000' : 'rgba(255,255,255,0.1)',
                                borderRadius: '4px'
                            }}
                        />
                    ))}
                </div>

                <motion.div 
                    className="perf-trend-badge"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <TrendingUp size={24} color="#eb0000" />
                </motion.div>
            </div>
        </div>
    );
};

export default PerformanceAnimated;
