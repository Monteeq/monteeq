"use client";

import React from 'react';
import { motion } from 'framer-motion';

const PerformanceVisual = () => {
    return (
        <div className="meaningful-3d-wrap">
            <div className="css-3d-scene-mini" style={{ width: '300px', height: '300px' }}>
                {/* --- THE ALGORITHM EQUATION FLOW --- */}
                
                {/* Inputs: Saves, Shares, Watchtime */}
                {[
                    { label: "SAVES", weight: "x5", color: "#eb0000", pos: [-100, -80] },
                    { label: "SHARES", weight: "x10", color: "#ff4444", pos: [-100, 0] },
                    { label: "WATCHTIME", weight: "x2", color: "#fff", pos: [-100, 80] }
                ].map((input, i) => (
                    <motion.div 
                        key={i}
                        className="algo-input-node"
                        initial={{ opacity: 0, x: -150 }}
                        animate={{ opacity: 1, x: input.pos[0] }}
                        transition={{ delay: i * 0.2 }}
                        style={{ 
                            position: 'absolute', 
                            top: `calc(50% + ${input.pos[1]}px)`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '4px'
                        }}
                    >
                        <span style={{ fontSize: '0.6rem', fontWeight: '900', opacity: 0.5 }}>{input.label}</span>
                        <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${input.color}44`, borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900' }}>
                            {input.weight}
                        </div>
                        {/* Connecting Laser Line */}
                        <motion.div 
                            animate={{ width: [0, 80], opacity: [0, 0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            style={{ height: '1px', background: input.color, position: 'absolute', left: '100%', top: '50%' }}
                        />
                    </motion.div>
                ))}

                {/* Central Processor: The MONTEEQ ENGINE */}
                <motion.div 
                    className="algo-processor"
                    animate={{ rotateY: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: '120px',
                        height: '120px',
                        marginLeft: '-60px',
                        marginTop: '-60px',
                        transformStyle: 'preserve-3d'
                    }}
                >
                    <div className="proc-face" style={{ transform: 'translateZ(60px)' }}>
                        <div className="proc-inner">∑ ENGAGEMENT</div>
                    </div>
                    <div className="proc-face" style={{ transform: 'rotateY(90deg) translateZ(60px)' }}>
                        <div className="proc-inner">MULTI_LAYER</div>
                    </div>
                    <div className="proc-face" style={{ transform: 'rotateY(180deg) translateZ(60px)' }}>
                        <div className="proc-inner">GROWTH_GEN</div>
                    </div>
                    <div className="proc-face" style={{ transform: 'rotateY(270deg) translateZ(60px)' }}>
                        <div className="proc-inner">V4_STABLE</div>
                    </div>
                </motion.div>

                {/* Output: PAYOUT */}
                <motion.div 
                    className="algo-output"
                    animate={{ scale: [1, 1.1, 1], x: [120, 130, 120] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        marginTop: '-30px',
                        padding: '15px',
                        background: 'rgba(235,0,0,0.1)',
                        border: '1px solid #eb0000',
                        borderRadius: '8px',
                        textAlign: 'center',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <div style={{ fontSize: '0.5rem', opacity: 0.6 }}>AUDIENCE REACH</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#eb0000' }}>+1.2M</div>
                    <div style={{ fontSize: '0.4rem', color: '#fff', opacity: 0.3, marginTop: '4px' }}>PER_100K_ENGAGEMENT</div>
                </motion.div>
            </div>
        </div>
    );
};

export default PerformanceVisual;
