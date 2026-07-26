'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, BellOff, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const DISMISS_KEY = 'monteeq_push_prompt_dismissed';
const NEVER_KEY = 'monteeq_push_prompt_never';
const NAV_COUNT_KEY = 'monteeq_push_nav_count';
const HIDDEN_PATHS = [
  '/login',
  '/signup',
  '/verify',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/payment',
  '/embed',
];

const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const NAV_THRESHOLD = 5; // show after every 5 navigations

function isPathHidden(pathname) {
  return HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPushSupported() {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function hasDismissedRecently() {
  try {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return Date.now() - ts < DISMISS_DURATION;
  } catch {
    return false;
  }
}

function hasChosenNever() {
  try {
    return localStorage.getItem(NEVER_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

function markNever() {
  try {
    localStorage.setItem(NEVER_KEY, '1');
  } catch { /* ignore */ }
}

function getNavCount() {
  try {
    return parseInt(localStorage.getItem(NAV_COUNT_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementNavCount() {
  try {
    const count = getNavCount() + 1;
    localStorage.setItem(NAV_COUNT_KEY, String(count));
    return count;
  } catch {
    return 0;
  }
}

function resetNavCount() {
  try {
    localStorage.setItem(NAV_COUNT_KEY, '0');
  } catch { /* ignore */ }
}

/**
 * Periodically prompts the user to enable push notifications.
 *
 * Shows when:
 *  - Push is supported and permission is 'default' (not yet asked)
 *  - User hasn't dismissed in the last 24h or chosen "never"
 *  - After every ~5 page navigations, or on first visit after login
 *  - Not on auth/embed/sensitive pages
 */
export default function PushNotificationPrompt() {
  const pathname = usePathname() || '/';
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const canShow = useCallback(() => {
    if (!token) return false;
    if (!isPushSupported()) return false;
    if (hasChosenNever()) return false;
    if (hasDismissedRecently()) return false;
    if (isPathHidden(pathname)) return false;
    const perm = Notification.permission;
    if (perm !== 'default') return false;
    return true;
  }, [token, pathname]);

  useEffect(() => {
    if (!canShow()) return;

    const count = incrementNavCount();
    if (count >= NAV_THRESHOLD) {
      resetNavCount();
      const timer = setTimeout(() => {
        if (canShow()) setOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname, canShow]);

  const dismiss = () => {
    markDismissed();
    setOpen(false);
  };

  const handleNever = () => {
    markNever();
    setOpen(false);
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        // Register push subscription
        const { registerPushSubscription } = await import('@/utils/pushSubscription');
        registerPushSubscription(token);
        markDismissed();
        setOpen(false);
      } else {
        markDismissed();
        setOpen(false);
      }
    } catch {
      markDismissed();
      setOpen(false);
    } finally {
      setEnabling(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={dismiss} role="presentation">
      <div
        className="modal-content push-prompt-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="push-prompt-title"
        aria-modal="true"
      >
        <button
          type="button"
          className="push-prompt-close"
          onClick={dismiss}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="push-prompt-icon-wrap">
          <div className="push-prompt-icon">
            <Bell size={28} />
          </div>
        </div>

        <h2 id="push-prompt-title">Stay in the loop</h2>
        <p className="push-prompt-body">
          Get notified when someone likes your video, follows you, or sends a message.
          Never miss what matters.
        </p>

        <div className="push-prompt-actions">
          <button
            type="button"
            className="push-prompt-primary"
            onClick={handleEnable}
            disabled={enabling}
          >
            <Bell size={18} />
            {enabling ? 'Enabling…' : 'Enable notifications'}
          </button>
          <button type="button" className="push-prompt-secondary" onClick={dismiss}>
            Not now
          </button>
          <button type="button" className="push-prompt-never" onClick={handleNever}>
            Never ask again
          </button>
        </div>

        <style>{`
          .push-prompt-modal {
            width: min(92vw, 400px);
            padding: 2rem 1.5rem 1.5rem;
            text-align: center;
            background: linear-gradient(160deg, rgba(28, 28, 28, 0.98) 0%, rgba(8, 8, 8, 0.99) 100%);
          }
          .push-prompt-close {
            position: absolute;
            top: 0.85rem;
            right: 0.85rem;
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.55);
            cursor: pointer;
            padding: 0.35rem;
            display: flex;
          }
          .push-prompt-close:hover { color: #fff; }
          .push-prompt-icon-wrap {
            width: 64px;
            height: 64px;
            margin: 0 auto 1.25rem;
          }
          .push-prompt-icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(255, 59, 48, 0.12);
            border: 2px solid rgba(255, 59, 48, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ff3b30;
          }
          .push-prompt-modal h2 {
            margin: 0 0 0.65rem;
            font-size: 1.3rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #fff;
          }
          .push-prompt-body {
            margin: 0 0 1.5rem;
            font-size: 0.9rem;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.6);
          }
          .push-prompt-actions {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
          }
          .push-prompt-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            width: 100%;
            padding: 0.85rem 1.25rem;
            border: none;
            border-radius: 12px;
            background: #ff3b30;
            color: #fff;
            font-weight: 700;
            font-size: 0.95rem;
            cursor: pointer;
          }
          .push-prompt-primary:disabled {
            opacity: 0.7;
            cursor: wait;
          }
          .push-prompt-secondary {
            width: 100%;
            padding: 0.7rem;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.88rem;
            cursor: pointer;
          }
          .push-prompt-secondary:hover { color: rgba(255, 255, 255, 0.85); }
          .push-prompt-never {
            width: 100%;
            padding: 0.5rem;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.3);
            font-size: 0.8rem;
            cursor: pointer;
          }
          .push-prompt-never:hover { color: rgba(255, 255, 255, 0.6); }
        `}</style>
      </div>
    </div>
  );
}
