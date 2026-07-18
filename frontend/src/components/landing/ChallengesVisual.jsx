import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, Target, Star } from 'lucide-react';

const ChallengesVisual = () => {
    return (
        <div className="meaningful-3d-wrap">
            <div className="css-3d-scene-mini" style={{ width: '350px', height: '350px' }}>
                {/* --- CHALLENGE PROGRESSION ROADMAP --- */}
                
                <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>
                    
                    {/* Stage 1: QUALIFIERS */}
                    <motion.div 
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ position: 'absolute', top: '10%', left: '10%' }}
                    >
                        <div className="challenge-node">
                            <Target size={20} />
                            <div className="node-text">
                                <strong>QUALIFIERS</strong>
                                <span>TOP 20% ADVANCE</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stage 2: THE FINALS */}
                    <motion.div 
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        style={{ position: 'absolute', top: '45%', left: '35%' }}
                    >
                        <div className="challenge-node highlight">
                            <Star size={24} fill="#eb0000" />
                            <div className="node-text">
                                <strong>GRAND FINALS</strong>
                                <span>LIVE EDIT-OFF</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stage 3: THE REWARD */}
                    <motion.div 
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1 }}
                        style={{ position: 'absolute', bottom: '10%', right: '10%' }}
                    >
                        <div className="challenge-node gold">
                            <Trophy size={20} color="#ffd700" />
                            <div className="node-text">
                                <strong>REWARDS</strong>
                                <span style={{ color: '#ffd700' }}>Trophy + Spotlight</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Connecting 3D Path */}
                    <svg width="100%" height="100%" style={{ position: 'absolute', overflow: 'visible', zIndex: -1 }}>
                        <motion.path 
                            d="M 50 50 L 150 180 L 250 280"
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="1"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                        <motion.circle 
                            r="3" 
                            fill="#eb0000"
                            animate={{ offsetDistance: ["0%", "100%"] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            style={{ offsetPath: "path('M 50 50 L 150 180 L 250 280')" }}
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default ChallengesVisual;
