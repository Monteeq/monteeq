'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Smartphone, Share, MoreVertical, X, Download } from 'lucide-react';

const DAY_KEY = 'monteeq_install_prompt_day';
const INSTALLED_KEY = 'monteeq_app_installed';
const HIDDEN_PATHS = [
  '/login',
  '/signup',
  '/verify',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/payment',
];

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    /* ignore */
  }
}

function hasInstalledBefore() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

function isStandaloneApp() {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

function isPhoneLike() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const narrow = window.matchMedia('(max-width: 820px)').matches;
  return mobileUa || narrow;
}

function isIos() {
  if (typeof window === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Once-per-day prompt to install Monteeq as an app via the browser.
 * Uses native beforeinstallprompt when available; otherwise shows OS-specific steps.
 */
export default function InstallAppPrompt() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already running as installed app — never prompt again.
    if (isStandaloneApp()) {
      markInstalled();
      return;
    }
    if (hasInstalledBefore()) return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    const onBip = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      markInstalled();
      setOpen(false);
      setShowSteps(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);

    const pathHidden = HIDDEN_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (pathHidden) {
      setOpen(false);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBip);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }
    if (!isPhoneLike()) {
      return () => {
        window.removeEventListener('beforeinstallprompt', onBip);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    if (localStorage.getItem(DAY_KEY) === todayStamp()) {
      return () => {
        window.removeEventListener('beforeinstallprompt', onBip);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    const timer = setTimeout(() => setOpen(true), 2800);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [pathname]);

  const dismissForToday = () => {
    try {
      localStorage.setItem(DAY_KEY, todayStamp());
    } catch {
      /* ignore */
    }
    setOpen(false);
    setShowSteps(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice?.outcome === 'accepted') {
          markInstalled();
          setOpen(false);
          setShowSteps(false);
          return;
        }
      } catch {
        /* show manual steps */
      } finally {
        setInstalling(false);
      }
    }
    setShowSteps(true);
  };

  if (!open) return null;

  const ios = isIos();

  return (
    <div className="modal-overlay" onClick={dismissForToday} role="presentation">
      <div
        className="modal-content install-app-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="install-app-title"
        aria-modal="true"
      >
        <button
          type="button"
          className="install-app-close"
          onClick={dismissForToday}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="install-app-icon-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="" width={64} height={64} className="install-app-logo" />
          <Smartphone size={22} className="install-app-phone-badge" aria-hidden />
        </div>

        <h2 id="install-app-title">Install Monteeq on your phone</h2>
        <p className="install-app-body">
          Add Monteeq to your home screen for faster access, fullscreen video, and a
          native-app feel — installed right from this browser. No app store needed.
        </p>

        {!showSteps ? (
          <div className="install-app-actions">
            <button
              type="button"
              className="install-app-primary"
              onClick={handleInstall}
              disabled={installing}
            >
              <Download size={18} />
              {installing ? 'Opening install…' : 'Install via browser'}
            </button>
            <button type="button" className="install-app-secondary" onClick={dismissForToday}>
              Not today
            </button>
          </div>
        ) : (
          <div className="install-app-steps">
            <p className="install-app-steps-label">
              {ios ? 'On iPhone / iPad (Safari)' : 'In your browser menu'}
            </p>
            {ios ? (
              <ol>
                <li>
                  Tap the <Share size={14} className="install-inline-icon" /> Share button
                </li>
                <li>
                  Scroll and tap <strong>Add to Home Screen</strong>
                </li>
                <li>
                  Tap <strong>Add</strong> to confirm
                </li>
              </ol>
            ) : (
              <ol>
                <li>
                  Tap <MoreVertical size={14} className="install-inline-icon" /> in the
                  browser toolbar
                </li>
                <li>
                  Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>
                </li>
                <li>Confirm to place Monteeq on your home screen</li>
              </ol>
            )}
            <div className="install-app-actions">
              <button type="button" className="install-app-primary" onClick={dismissForToday}>
                Got it
              </button>
              <button
                type="button"
                className="install-app-secondary"
                onClick={() => {
                  markInstalled();
                  setOpen(false);
                  setShowSteps(false);
                }}
              >
                I&apos;ve installed it
              </button>
            </div>
          </div>
        )}

        <style>{`
          .install-app-modal {
            width: min(92vw, 400px);
            padding: 2rem 1.5rem 1.5rem;
            text-align: center;
            background: linear-gradient(160deg, rgba(28, 28, 28, 0.98) 0%, rgba(8, 8, 8, 0.99) 100%);
          }
          .install-app-close {
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
          .install-app-close:hover { color: #fff; }
          .install-app-icon-wrap {
            position: relative;
            width: 72px;
            height: 72px;
            margin: 0 auto 1.25rem;
          }
          .install-app-logo {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            object-fit: cover;
            box-shadow: 0 8px 28px rgba(255, 59, 48, 0.25);
          }
          .install-app-phone-badge {
            position: absolute;
            right: -4px;
            bottom: -2px;
            color: #ff3b30;
            background: #111;
            border-radius: 8px;
            padding: 4px;
          }
          .install-app-modal h2 {
            margin: 0 0 0.65rem;
            font-size: 1.35rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #fff;
          }
          .install-app-body {
            margin: 0 0 1.5rem;
            font-size: 0.92rem;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.65);
          }
          .install-app-actions {
            display: flex;
            flex-direction: column;
            gap: 0.65rem;
          }
          .install-app-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            width: 100%;
            padding: 0.9rem 1.25rem;
            border: none;
            border-radius: 12px;
            background: #ff3b30;
            color: #fff;
            font-weight: 700;
            font-size: 0.95rem;
            cursor: pointer;
          }
          .install-app-primary:disabled {
            opacity: 0.7;
            cursor: wait;
          }
          .install-app-secondary {
            width: 100%;
            padding: 0.75rem;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.88rem;
            cursor: pointer;
          }
          .install-app-secondary:hover { color: rgba(255, 255, 255, 0.85); }
          .install-app-steps { text-align: left; }
          .install-app-steps-label {
            margin: 0 0 0.75rem;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #ff3b30;
          }
          .install-app-steps ol {
            margin: 0 0 1.25rem;
            padding-left: 1.2rem;
            color: rgba(255, 255, 255, 0.75);
            font-size: 0.9rem;
            line-height: 1.7;
          }
          .install-app-steps li { margin-bottom: 0.35rem; }
          .install-inline-icon {
            display: inline;
            vertical-align: -2px;
            color: #ff3b30;
          }
        `}</style>
      </div>
    </div>
  );
}
