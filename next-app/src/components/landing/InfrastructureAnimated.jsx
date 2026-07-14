"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Lock } from 'lucide-react';

const InfrastructureAnimated = () => {
    return (
        <div className="visual-animated-wrap">
            <div className="infra-icon-scene">
                {/* Security Field */}
                <motion.div 
                    className="infra-security-field"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />

                <div className="infra-main-icons">
                    <ShieldCheck size={100} color="#eb0000" strokeWidth={1} />
                    
                    <motion.div 
                        className="infra-zap"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    >
                        <Zap size={32} color="#eb0000" fill="#eb0000" />
                    </motion.div>
                </div>

                <motion.div 
                    className="infra-lock"
                    animate={{ y: [-10, 10, -10] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Lock size={20} color="#fff" />
                    <span>SHA-256</span>
                </motion.div>
            </div>
        </div>
    );
};

export default InfrastructureAnimated;
