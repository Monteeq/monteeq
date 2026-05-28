/**
 * Push notification subscription utility.
 *
 * Silently requests permission and registers a web push subscription
 * after login/signup. No UI buttons — this is fully automatic.
 *
 * Flow:
 *  1. Register sw.js service worker
 *  2. Check if permission is already granted/denied
 *  3. If 'default' (never asked), show the browser's native prompt after a
 *     short delay so it doesn't feel intrusive right on login
 *  4. If granted, subscribe via PushManager and POST to backend
 */

import { API_BASE_URL } from '../api';

const SW_PATH = '/sw.js';
const SUBSCRIBE_URL = `${API_BASE_URL}/notifications/push-subscriptions`;
const VAPID_URL = `${API_BASE_URL}/notifications/vapid-public-key`;

/** Convert a base64 VAPID public key to Uint8Array for PushManager */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Post subscription object to backend */
async function saveSubscription(subscription, token) {
  const subJson = subscription.toJSON();
  await fetch(SUBSCRIBE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth,
    }),
  });
}

/** Fetch VAPID public key from backend */
async function getVapidPublicKey() {
  const res = await fetch(VAPID_URL);
  if (!res.ok) throw new Error('Failed to fetch VAPID public key');
  const data = await res.json();
  return data.public_key;
}

/**
 * Main entry point. Call this once after the user has authenticated.
 * Safe to call multiple times — re-entrant and idempotent.
 *
 * @param {string} token - Bearer token for authenticated API calls
 */
export async function registerPushSubscription(token) {
  try {
    // 1. Browser support check
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // 2. Register service worker
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });

    // 3. Check current permission state
    const currentPermission = Notification.permission;

    if (currentPermission === 'denied') {
      // User has explicitly blocked — don't bother
      return;
    }

    if (currentPermission === 'default') {
      // Haven't asked yet — wait 3 seconds so it doesn't feel abrupt
      await new Promise((r) => setTimeout(r, 3000));
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    // 4. Already granted (or just granted above) — subscribe
    // Check if already subscribed to avoid redundant work
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Re-save in case the token changed or subscription drifted
      await saveSubscription(existing, token);
      return;
    }

    // 5. Fetch VAPID public key and create subscription
    const vapidPublicKey = await getVapidPublicKey();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // 6. Send to backend
    await saveSubscription(subscription, token);
  } catch (err) {
    // Non-fatal — push is best-effort
    console.warn('[push] Failed to register push subscription:', err);
  }
}
