"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Search, MousePointer2 } from 'lucide-react';

const AnalyticsAnimated = () => {
    return (
        <div className="visual-animated-wrap">
            <div className="analytics-icon-scene">
                {/* Search Scanner */}
                <motion.div 
                    className="analytics-scanner"
                    animate={{ left: ['0%', '100%', '0%'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />

                <div className="analytics-main-icons">
                    <BarChart3 size={100} color="#eb0000" strokeWidth={1} />
                    
                    <motion.div 
                        className="analytics-pointer"
                        animate={{ 
                            x: [0, 40, -20, 0], 
                            y: [0, -30, 20, 0] 
                        }}
                        transition={{ duration: 6, repeat: Infinity }}
                    >
                        <MousePointer2 size={24} color="#fff" />
                    </motion.div>
                </div>

                {/* Floating Metric Chips */}
                <motion.div 
                    className="metric-chip"
                    animate={{ y: [-5, 5, -5] }}
                    transition={{ duration: 3, repeat: Infinity }}
                >
                    RETENTION +12%
                </motion.div>
            </div>
        </div>
    );
};

export default AnalyticsAnimated;
