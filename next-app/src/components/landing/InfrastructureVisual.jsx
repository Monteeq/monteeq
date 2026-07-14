"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Database, Zap, Cpu } from 'lucide-react';

const InfrastructureVisual = () => {
    return (
        <div className="meaningful-3d-wrap">
            <div className="css-3d-scene-mini" style={{ width: '350px', height: '350px' }}>
                {/* --- 4K INFRASTRUCTURE CORE --- */}
                <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>
                    
                    {/* The Core Hub */}
                    <motion.div 
                        animate={{ rotateY: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: '140px',
                            height: '140px',
                            marginLeft: '-70px',
                            marginTop: '-70px',
                            transformStyle: 'preserve-3d'
                        }}
                    >
                        <div className="infra-core-face" style={{ transform: 'translateZ(70px)' }}>
                            <Cpu size={32} color="#eb0000" />
                            <div style={{ fontSize: '0.5rem', fontWeight: '900', marginTop: '10px' }}>4K_ENCODE</div>
                        </div>
                        <div className="infra-core-face" style={{ transform: 'rotateY(180deg) translateZ(70px)' }}>
                            <ShieldCheck size={32} color="#eb0000" />
                            <div style={{ fontSize: '0.5rem', fontWeight: '900', marginTop: '10px' }}>SHA_256_PAY</div>
                        </div>
                    </motion.div>

                    {/* Flying Data Packets */}
                    {[...Array(4)].map((_, i) => (
                        <motion.div 
                            key={i}
                            className="infra-packet"
                            animate={{ 
                                x: [-200, 200],
                                y: [Math.sin(i) * 50, Math.sin(i) * -50],
                                opacity: [0, 1, 0]
                            }}
                            transition={{ duration: 3, delay: i * 0.8, repeat: Infinity, ease: "linear" }}
                            style={{ 
                                position: 'absolute', 
                                top: '50%', 
                                left: '50%',
                                padding: '8px 12px',
                                background: 'rgba(0,0,0,0.8)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.45rem',
                                fontFamily: 'monospace',
                                zIndex: 5,
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            <div style={{ color: '#eb0000', fontWeight: '900' }}>{i % 2 === 0 ? 'STATUS: ENCRYPTED' : 'QUALITY: 4K_RAW'}</div>
                            <div style={{ opacity: 0.5 }}>BITRATE: 50MBPS</div>
                            <div style={{ opacity: 0.5 }}>LATENCY: 12ms</div>
                        </motion.div>
                    ))}

                    {/* Global Nodes */}
                    {[...Array(6)].map((_, i) => (
                        <div 
                            key={i}
                            style={{
                                position: 'absolute',
                                width: '4px',
                                height: '4px',
                                background: '#eb0000',
                                borderRadius: '50%',
                                top: `${Math.random() * 100}%`,
                                left: `${Math.random() * 100}%`,
                                opacity: 0.2,
                                boxShadow: '0 0 10px #eb0000'
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InfrastructureVisual;
