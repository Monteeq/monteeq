"use client";

import React from 'react';

const MeshBackground = () => {
    return (
        <div className="mesh-bg-container">
            <style>{`
                .mesh-blob.red-1, .mesh-blob.red-2 {
                    will-change: transform;
                }
                .mesh-blob.red-1 {
                    animation: driftRed1 20s linear infinite;
                }
                .mesh-blob.red-2 {
                    animation: driftRed2 25s linear infinite;
                }
                @media (max-width: 768px) {
                    .mesh-blob.red-1, .mesh-blob.red-2 {
                        will-change: auto;
                        animation: none;
                    }
                }
                @keyframes driftRed1 {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33.33% { transform: translate(100px, -50px) scale(1.2); }
                    66.67% { transform: translate(-50px, 100px) scale(0.8); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                @keyframes driftRed2 {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33.33% { transform: translate(-150px, 100px) scale(0.8); }
                    66.67% { transform: translate(100px, -50px) scale(1.2); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
            `}</style>
            {/* Pulsing Red Blobs */}
            <div className="mesh-blob red-1" />
            <div className="mesh-blob red-2" />
            
            {/* Static Noise Overlay */}
            <div className="mesh-noise" />
        </div>
    );
};

export default MeshBackground;
