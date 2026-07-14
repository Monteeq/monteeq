'use client';

import React, { createContext, useContext, useCallback, useReducer } from 'react';

/**
 * ErrorContext — Global toast notification system
 * ================================================
 * Provides a stacked, auto-dismissing toast overlay (top-right).
 *
 * Usage:
 *   const { showError, showSuccess, showWarning, showInfo } = useError();
 *   showError('Upload failed');
 *   showSuccess('Video published!');
 */

const ErrorContext = createContext(null);

const TOAST_TYPES = {
  error:   { color: '#FF3B30', bg: 'rgba(255,59,48,0.12)',  border: 'rgba(255,59,48,0.3)',  icon: '✕' },
  success: { color: '#30D158', bg: 'rgba(48,209,88,0.12)',  border: 'rgba(48,209,88,0.3)',  icon: '✓' },
  warning: { color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.3)', icon: '!' },
  info:    { color: '#0A84FF', bg: 'rgba(10,132,255,0.12)', border: 'rgba(10,132,255,0.3)', icon: 'i' },
};

let _toastId = 0;

function toastsReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [action.toast, ...state].slice(0, 5); // max 5 visible
    case 'REMOVE':
      return state.filter(t => t.id !== action.id);
    default:
      return state;
  }
}

export function ErrorProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastsReducer, []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_toastId;
    dispatch({ type: 'ADD', toast: { id, message, type, duration } });

    if (duration > 0) {
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id) => dispatch({ type: 'REMOVE', id }), []);

  const showError   = useCallback((msg, dur) => show(msg, 'error',   dur), [show]);
  const showSuccess = useCallback((msg, dur) => show(msg, 'success', dur), [show]);
  const showWarning = useCallback((msg, dur) => show(msg, 'warning', dur), [show]);
  const showInfo    = useCallback((msg, dur) => show(msg, 'info',    dur), [show]);

  return (
    <ErrorContext.Provider value={{ show, dismiss, showError, showSuccess, showWarning, showInfo }}>
      {children}

      {/* Toast Overlay */}
      <div style={styles.container} aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ErrorContext.Provider>
  );
}

function Toast({ toast, onDismiss }) {
  const cfg = TOAST_TYPES[toast.type] || TOAST_TYPES.info;

  return (
    <div
      role="alert"
      style={{
        ...styles.toast,
        background: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      <span style={{ ...styles.icon, color: cfg.color, borderColor: cfg.border }}>
        {cfg.icon}
      </span>
      <span style={styles.message}>{toast.message}</span>
      <button
        id={`toast-dismiss-${toast.id}`}
        style={styles.dismiss}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function useError() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError must be used inside <ErrorProvider>');
  return ctx;
}

const styles = {
  container: {
    position: 'fixed',
    top: '1.25rem',
    right: '1.25rem',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    maxWidth: 360,
    width: '90vw',
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1rem',
    borderRadius: 14,
    border: '1px solid',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    animation: 'toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
    pointerEvents: 'all',
    fontFamily: "'Outfit','Inter',sans-serif",
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 800,
    flexShrink: 0,
    lineHeight: 1,
  },
  message: {
    flex: 1,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#fff',
    lineHeight: 1.4,
  },
  dismiss: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    lineHeight: 1,
    flexShrink: 0,
    padding: '0 2px',
    fontFamily: 'inherit',
  },
};

// Inject animation keyframe once
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `@keyframes toast-in { from { opacity:0; transform:translateX(40px) scale(0.9); } to { opacity:1; transform:translateX(0) scale(1); } }`;
  document.head.appendChild(style);
}
