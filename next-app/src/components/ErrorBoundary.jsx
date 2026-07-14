'use client';

import React from 'react';

/**
 * ErrorBoundary — catches any unhandled JS render errors in the React tree.
 * Displays a premium cinematic error page that matches the Monteeq dark aesthetic.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[Monteeq ErrorBoundary]', error, errorInfo);
    
    // Stale chunk after a new deployment — force a hard reload once
    const isChunkError = (
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.name === 'ChunkLoadError'
    );
    if (isChunkError && !sessionStorage.getItem('chunk_reload_attempted')) {
      sessionStorage.setItem('chunk_reload_attempted', 'true');
      window.location.reload();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={styles.overlay}>
        {/* Animated background particles */}
        <div style={styles.particleA} />
        <div style={styles.particleB} />

        <div style={styles.card}>
          {/* Glitch icon */}
          <div style={styles.iconWrap}>
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ animation: 'eb-pulse 2s ease-in-out infinite', color: '#FF3B30' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 style={styles.title}>Something broke</h1>
          <p style={styles.subtitle}>
            An unexpected error occurred in the application. Our team has been
            notified — but you can try recovering below.
          </p>

          {/* Error message (collapsed by default) */}
          {this.state.error && (
            <details style={styles.details}>
              <summary style={styles.summary}>Show error details</summary>
              <pre style={styles.pre}>{this.state.error.toString()}</pre>
            </details>
          )}

          <div style={styles.actions}>
            <button
              id="eb-go-home"
              onClick={this.handleReset}
              style={styles.btnPrimary}
            >
              ← Back to Home
            </button>
            <button
              id="eb-reload"
              onClick={() => window.location.reload()}
              style={styles.btnGhost}
            >
              Reload page
            </button>
          </div>
        </div>

        <style>{`
          @keyframes eb-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.7; transform: scale(1.08); }
          }
          @keyframes eb-float-a {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50%       { transform: translateY(-30px) rotate(15deg); }
          }
          @keyframes eb-float-b {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50%       { transform: translateY(20px) rotate(-10deg); }
          }
        `}</style>
      </div>
    );
  }
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    overflow: 'hidden',
    fontFamily: "'Outfit', 'Inter', sans-serif",
  },
  particleA: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,59,48,0.15) 0%, transparent 70%)',
    animation: 'eb-float-a 8s ease-in-out infinite',
    pointerEvents: 'none',
  },
  particleB: {
    position: 'absolute',
    bottom: '10%',
    right: '8%',
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,59,48,0.1) 0%, transparent 70%)',
    animation: 'eb-float-b 10s ease-in-out infinite',
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    padding: '3rem 2.5rem',
    maxWidth: 520,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(255,59,48,0.12), 0 24px 60px rgba(0,0,0,0.8)',
    position: 'relative',
    zIndex: 10,
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'rgba(255,59,48,0.1)',
    border: '1px solid rgba(255,59,48,0.3)',
    margin: '0 auto 1.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '0.75rem',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#8e8e93',
    lineHeight: 1.7,
    marginBottom: '1.5rem',
  },
  details: {
    textAlign: 'left',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '0.75rem 1rem',
    marginBottom: '1.5rem',
  },
  summary: {
    cursor: 'pointer',
    color: '#8e8e93',
    fontSize: '0.85rem',
    userSelect: 'none',
  },
  pre: {
    marginTop: '0.75rem',
    fontSize: '0.75rem',
    color: '#FF3B30',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: "'JetBrains Mono', monospace",
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    background: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: 50,
    padding: '0.75rem 1.75rem',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'background 0.2s ease, transform 0.15s ease',
    fontFamily: 'inherit',
  },
  btnGhost: {
    background: 'rgba(255,255,255,0.06)',
    color: '#8e8e93',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 50,
    padding: '0.75rem 1.75rem',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    fontFamily: 'inherit',
  },
};
