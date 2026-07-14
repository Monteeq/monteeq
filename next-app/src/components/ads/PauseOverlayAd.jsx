"use client";

import React from 'react';
import { Info, ExternalLink } from 'lucide-react';

const PauseOverlayAd = () => {
    return (
        <div className="pauseAdContainer">
            <div className="pauseAdHeader">
                <span className="pauseAdLabel">ADVERTISEMENT</span>
                <Info size={14} color="rgba(255,255,255,0.4)" />
            </div>
            
            <div className="pauseAdBody">
                <div className="pauseAdImageContainer">
                   <img 
                       src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=100&q=60" 
                       alt="" 
                       className="pauseAdImage" 
                   />
                </div>
                <div className="pauseAdInfo">
                    <div className="pauseAdTitle">Next-Gen Editing</div>
                    <div className="pauseAdSubtitle">Monteeq Partner Pro</div>
                </div>
            </div>

            <button 
                onClick={() => window.open('https://monteeq.com', '_blank')}
                className="pauseAdButton"
            >
                GET STARTED <ExternalLink className="pauseAdButtonIcon" size={12} />
            </button>

            <style>{`
                @keyframes adSlideIn {
                    from { transform: translateX(30px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .pauseAdContainer {
                    position: absolute;
                    top: 2rem;
                    right: 2rem;
                    width: 240px;
                    background: rgba(10, 10, 10, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 1rem;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    z-index: 50;
                    animation: adSlideIn 0.5s ease-out forwards;
                    font-family: 'Outfit', sans-serif;
                }

                .pauseAdHeader {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.8rem;
                }

                .pauseAdLabel {
                    font-size: 0.65rem;
                    font-weight: 900;
                    color: var(--accent-primary);
                    letter-spacing: 1.5px;
                }

                .pauseAdBody {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .pauseAdImageContainer {
                    width: 60px;
                    height: 60px;
                    border-radius: 8px;
                    background: linear-gradient(45deg, #FF3B30, #900);
                    flex-shrink: 0;
                    overflow: hidden;
                }

                .pauseAdImage {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0.7;
                }

                .pauseAdInfo {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .pauseAdTitle {
                    font-size: 0.85rem;
                    font-weight: 700;
                    margin-bottom: 0.2rem;
                    color: white;
                }

                .pauseAdSubtitle {
                    font-size: 0.7rem;
                    color: rgba(255, 255, 255, 0.6);
                }

                .pauseAdButton {
                    width: 100% !important;
                    padding: 0.8rem !important;
                    border-radius: 10px !important;
                    background: var(--accent-primary) !important;
                    border: none !important;
                    color: white !important;
                    font-weight: 800 !important;
                    font-size: 0.75rem !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 0.5rem !important;
                    cursor: pointer !important;
                }

                @media (max-width: 768px) {
                    .pauseAdContainer {
                        top: 0.5rem;
                        right: 0.5rem;
                        width: 170px;
                        padding: 0.5rem;
                        border-radius: 10px;
                    }
                    
                    .pauseAdHeader {
                        margin-bottom: 0.4rem;
                    }
                    
                    .pauseAdLabel {
                        font-size: 0.55rem;
                        letter-spacing: 1px;
                    }
                    
                    .pauseAdBody {
                        gap: 0.5rem;
                        margin-bottom: 0.5rem;
                    }
                    
                    .pauseAdImageContainer {
                        width: 40px;
                        height: 40px;
                        border-radius: 6px;
                    }
                    
                    .pauseAdTitle {
                        font-size: 0.7rem;
                        margin-bottom: 0.1rem;
                    }
                    
                    .pauseAdSubtitle {
                        font-size: 0.6rem;
                    }
                    
                    .pauseAdButton {
                        padding: 0.5rem !important;
                        border-radius: 6px !important;
                        font-size: 0.65rem !important;
                        gap: 0.3rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default PauseOverlayAd;
