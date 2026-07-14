'use client';

import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 404 Not Found page — matches Monteeq's cinematic dark aesthetic.
 * Shown for any unmatched route via the catch-all <Route path="*"> in App.jsx.
 */
export default function NotFound() {
  return (
    <div className="nf-overlay">
      {/* Ambient glows */}
      <div className="nf-glow nf-glow-a" />
      <div className="nf-glow nf-glow-b" />

      <div className="nf-content">
        {/* Glitch number */}
        <div className="nf-number" aria-hidden="true">
          <span className="nf-4 nf-4-left">4</span>
          <span className="nf-0">0</span>
          <span className="nf-4 nf-4-right">4</span>
        </div>

        <h1 className="nf-title">Looks like this content went dark.</h1>
        <p className="nf-body">
          The page you&apos;re looking for has been moved, deleted, or never existed.
          Head back and keep exploring.
        </p>

        <div className="nf-actions">
          <Link to="/" id="nf-go-home" className="nf-btn-primary">
            ← Back to Monteeq
          </Link>
          <button
            id="nf-go-back"
            className="nf-btn-ghost"
            onClick={() => window.history.back()}
          >
            Go back
          </button>
        </div>
      </div>

      <style>{`
        .nf-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: var(--bg-deep, #000);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          overflow: hidden;
          font-family: 'Outfit', 'Inter', sans-serif;
        }

        .nf-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .nf-glow-a {
          top: 5%;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(255,59,48,0.18) 0%, transparent 70%);
          animation: nf-breathe 6s ease-in-out infinite;
        }

        .nf-glow-b {
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 400px;
          height: 200px;
          background: radial-gradient(ellipse, rgba(255,59,48,0.08) 0%, transparent 70%);
          animation: nf-breathe 8s ease-in-out infinite reverse;
        }

        .nf-content {
          text-align: center;
          position: relative;
          z-index: 10;
          max-width: 600px;
        }

        .nf-number {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
          font-size: clamp(7rem, 20vw, 14rem);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.05em;
          margin-bottom: 2rem;
          color: transparent;
          -webkit-text-stroke: 2px rgba(255,255,255,0.15);
          position: relative;
          user-select: none;
        }

        .nf-4-left {
          animation: nf-glitch-left 4s ease-in-out infinite;
          color: transparent;
          -webkit-text-stroke: 2px rgba(255, 59, 48, 0.6);
        }

        .nf-0 {
          color: rgba(255,255,255,0.9);
          -webkit-text-stroke: 0;
          text-shadow: 0 0 80px rgba(255,59,48,0.4);
        }

        .nf-4-right {
          animation: nf-glitch-right 4s ease-in-out infinite;
          color: transparent;
          -webkit-text-stroke: 2px rgba(255, 59, 48, 0.6);
        }

        .nf-title {
          font-size: clamp(1.4rem, 4vw, 2rem);
          font-weight: 700;
          color: #fff;
          margin-bottom: 1rem;
          letter-spacing: -0.3px;
        }

        .nf-body {
          font-size: 1rem;
          color: var(--text-muted, #8e8e93);
          line-height: 1.7;
          margin-bottom: 2.5rem;
        }

        .nf-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .nf-btn-primary {
          background: #FF3B30;
          color: #fff;
          border: none;
          border-radius: 50px;
          padding: 0.8rem 2rem;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          transition: background 0.2s ease, transform 0.15s ease;
          font-family: inherit;
        }

        .nf-btn-primary:hover {
          background: #D0021B;
          transform: translateY(-2px);
        }

        .nf-btn-ghost {
          background: rgba(255,255,255,0.06);
          color: var(--text-muted, #8e8e93);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50px;
          padding: 0.8rem 2rem;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: background 0.2s ease;
          font-family: inherit;
        }

        .nf-btn-ghost:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        @keyframes nf-breathe {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50%       { opacity: 0.7; transform: translateX(-50%) scale(1.05); }
        }

        @keyframes nf-glitch-left {
          0%, 90%, 100% { transform: translateX(0); opacity: 1; }
          92%            { transform: translateX(-6px); opacity: 0.8; }
          94%            { transform: translateX(4px); opacity: 0.9; }
          96%            { transform: translateX(-2px); opacity: 1; }
        }

        @keyframes nf-glitch-right {
          0%, 90%, 100% { transform: translateX(0); opacity: 1; }
          92%            { transform: translateX(6px); opacity: 0.8; }
          94%            { transform: translateX(-4px); opacity: 0.9; }
          96%            { transform: translateX(2px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
