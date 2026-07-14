"use client";

import React from 'react';
import { motion } from 'framer-motion';

const AnalyticsVisual = () => {
    return (
        <div className="meaningful-3d-wrap">
            <div className="css-3d-scene-mini" style={{ width: '350px', height: '300px' }}>
                {/* --- THE 3D RETENTION MAP --- */}
                
                {/* Timeline Axis */}
                <div style={{ position: 'absolute', bottom: '40px', left: '0', width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }}>
                    {[0, 15, 30, 45, 60].map(s => (
                        <span key={s} style={{ position: 'absolute', left: `${(s/60)*100}%`, top: '10px', fontSize: '0.5rem', opacity: 0.3 }}>{s}s</span>
                    ))}
                </div>

                {/* The Graph Path */}
                <svg width="100%" height="100%" style={{ position: 'absolute', overflow: 'visible' }}>
                    <motion.path 
                        d="M 0 150 Q 50 50, 100 80 T 200 120 T 300 200"
                        fill="none"
                        stroke="#eb0000"
                        strokeWidth="3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 3, repeat: Infinity }}
                        style={{ filter: 'drop-shadow(0 0 10px #eb0000)' }}
                    />
                    
                    {/* Floating Nodes along path */}
                    {[
                        { x: 50, y: 50, label: "HOOK_STRENGTH", val: "94%" },
                        { x: 150, y: 100, label: "VALUE_PEAK", val: "82%" },
                        { x: 250, y: 160, label: "CTA_DROP", val: "45%" }
                    ].map((node, i) => (
                        <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.5 }}>
                            <circle cx={node.x} cy={node.y} r="4" fill="#fff" />
                            <foreignObject x={node.x + 10} y={node.y - 20} width="100" height="40">
                                <div style={{ color: '#fff', fontSize: '0.45rem', fontWeight: '900' }}>
                                    <div style={{ opacity: 0.5 }}>{node.label}</div>
                                    <div style={{ color: '#eb0000', fontSize: '0.7rem' }}>{node.val}</div>
                                </div>
                            </foreignObject>
                        </motion.g>
                    ))}
                </svg>

                {/* Perspective Elements */}
                <motion.div 
                    className="analytics-grid-overlay"
                    animate={{ rotateX: 60, rotateZ: [0, 5, 0] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        border: '1px solid rgba(255,255,255,0.05)',
                        background: 'linear-gradient(to bottom, transparent, rgba(235,0,0,0.05))',
                        transformOrigin: 'bottom center'
                    }}
                />

                {/* Live Scanner */}
                <motion.div 
                    animate={{ x: [-20, 320] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    style={{
                        position: 'absolute',
                        top: '0',
                        width: '2px',
                        height: '100%',
                        background: 'linear-gradient(to bottom, transparent, #eb0000, transparent)',
                        boxShadow: '0 0 15px #eb0000',
                        zIndex: 10
                    }}
                />
            </div>
        </div>
    );
};

export default AnalyticsVisual;
