'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MonitorSmartphone, Share, MoreVertical, X, Download } from 'lucide-react';
import {
  INSTALL_PROMPT_EVENT,
  hasPendingInstallPromptAfterLogin,
  clearPendingInstallPromptAfterLogin,
} from '@/utils/installPrompt';

const SESSION_KEY = 'monteeq_install_prompt_session';
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

function markSessionSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

function seenThisSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    /* ignore */
  }
  clearPendingInstallPromptAfterLogin();
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

function isIos() {
  if (typeof window === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isDesktopSafari() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/i.test(ua);
  return isSafari && !isIos();
}

function isPathHidden(pathname) {
  return HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Prompt to install Monteeq (phone + desktop) until the user installs:
 * - after every successful login
 * - on every new site visit/session (closing the tab/browser clears it)
 */
export default function InstallAppPrompt() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const deferredRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isStandaloneApp()) {
      markInstalled();
      return;
    }
    if (hasInstalledBefore()) {
      clearPendingInstallPromptAfterLogin();
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    const onBip = (e) => {
      e.preventDefault();
      deferredRef.current = e;
    };
    const onInstalled = () => {
      markInstalled();
      deferredRef.current = null;
      setOpen(false);
      setShowSteps(false);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);

    let timer;

    const openPrompt = (delayMs) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (hasInstalledBefore() || isStandaloneApp()) {
          markInstalled();
          return;
        }
        if (isPathHidden(pathname)) return;
        clearPendingInstallPromptAfterLogin();
        markSessionSeen();
        setShowSteps(false);
        setOpen(true);
      }, delayMs);
    };

    const tryShow = () => {
      if (hasInstalledBefore() || isStandaloneApp()) {
        markInstalled();
        return;
      }
      if (isPathHidden(pathname)) {
        setOpen(false);
        return;
      }

      // Prefer post-login prompt whenever a login just happened.
      if (hasPendingInstallPromptAfterLogin()) {
        openPrompt(1200);
        return;
      }

      // Otherwise once per visit/session until they install.
      if (!seenThisSession()) {
        openPrompt(2800);
      }
    };

    tryShow();
    window.addEventListener(INSTALL_PROMPT_EVENT, tryShow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener(INSTALL_PROMPT_EVENT, tryShow);
    };
  }, [pathname]);

  const dismiss = () => {
    clearPendingInstallPromptAfterLogin();
    markSessionSeen();
    setOpen(false);
    setShowSteps(false);
  };

  const waitForNativePrompt = (timeoutMs = 5000) =>
    new Promise((resolve) => {
      if (deferredRef.current) {
        resolve(deferredRef.current);
        return;
      }
      const started = Date.now();
      const id = setInterval(() => {
        if (deferredRef.current) {
          clearInterval(id);
          resolve(deferredRef.current);
        } else if (Date.now() - started >= timeoutMs) {
          clearInterval(id);
          resolve(null);
        }
      }, 100);
    });

  const handleInstall = async () => {
    setInstalling(true);
    setShowSteps(false);

    try {
      const promptEvent = await waitForNativePrompt(isIos() ? 800 : 5000);
      if (promptEvent?.prompt) {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        deferredRef.current = null;
        if (choice?.outcome === 'accepted') {
          markInstalled();
          setOpen(false);
          setShowSteps(false);
          return;
        }
        return;
      }
      setShowSteps(true);
    } catch {
      setShowSteps(true);
    } finally {
      setInstalling(false);
    }
  };

  if (!open) return null;

  const ios = isIos();
  const desktopSafari = isDesktopSafari();

  return (
    <div className="modal-overlay" onClick={dismiss} role="presentation">
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
          onClick={dismiss}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="install-app-icon-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="" width={64} height={64} className="install-app-logo" />
          <MonitorSmartphone size={22} className="install-app-phone-badge" aria-hidden />
        </div>

        <h2 id="install-app-title">Install Monteeq</h2>
        <p className="install-app-body">
          Install Monteeq from this browser for faster launch, fullscreen video, and a
          native-app feel on your phone or desktop. No app store needed.
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
              {installing ? 'Installing…' : 'Install app'}
            </button>
            <button type="button" className="install-app-secondary" onClick={dismiss}>
              Not now
            </button>
          </div>
        ) : (
          <div className="install-app-steps">
            <p className="install-app-steps-label">
              {ios
                ? 'On iPhone / iPad (Safari)'
                : desktopSafari
                  ? 'On Mac (Safari)'
                  : 'Install from your browser'}
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
            ) : desktopSafari ? (
              <ol>
                <li>
                  Open the <Share size={14} className="install-inline-icon" /> Share menu
                </li>
                <li>
                  Choose <strong>Add to Dock</strong> or <strong>Add to Home Screen</strong>
                </li>
                <li>Confirm to install Monteeq</li>
              </ol>
            ) : (
              <ol>
                <li>
                  Open the browser menu{' '}
                  <MoreVertical size={14} className="install-inline-icon" />
                </li>
                <li>
                  Choose <strong>Install app</strong> or <strong>Install Monteeq</strong>
                </li>
                <li>Confirm to finish installing</li>
              </ol>
            )}
            <div className="install-app-actions">
              <button type="button" className="install-app-primary" onClick={handleInstall}>
                <Download size={18} />
                Try install again
              </button>
              <button type="button" className="install-app-secondary" onClick={dismiss}>
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
            width: min(92vw, 420px);
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
