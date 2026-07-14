/**
 * Safe post-login path from ?redirect=
 * - Vite Login ignored this; AdminPortal already links `/login?redirect=/admin`
 * - Only allow same-origin relative paths (start with `/`, not `//`)
 */
export function getSafeRedirectPath(raw, fallback = '/home') {
  if (!raw || typeof raw !== 'string') return fallback;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return fallback;
  if (path.includes('://')) return fallback;
  return path;
}

export function authErrorMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(', ');
  if (typeof err.message === 'string' && err.message) return err.message;
  return fallback;
}
