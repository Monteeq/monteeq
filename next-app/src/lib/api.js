/**
 * Server-side FastAPI client for Next.js Server Components / Route Handlers.
 *
 * Mirrors frontend/src/api.js for public read endpoints used by crawlable pages.
 * Does NOT read localStorage — pass an optional token when available (e.g. from
 * a request header). Browser auth stays localStorage + Bearer on the client.
 *
 * Env: API_BASE_URL = FastAPI origin (e.g. http://localhost:8000), no /api/v1 suffix.
 */

export class ApiError extends Error {
  constructor({ status, code, message, fields = [], traceId = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.traceId = traceId;
  }
}

function getApiOrigin() {
  const origin = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
  return origin.replace(/\/$/, '');
}

/** Full /api/v1 base — always absolute for server-side fetch. */
export function getApiBaseUrl() {
  const origin = getApiOrigin();
  if (!origin) {
    throw new ApiError({
      status: 0,
      code: 'CONFIG_ERROR',
      message: 'API_BASE_URL is not set. Add it to next-app/.env.local',
    });
  }
  return `${origin}/api/v1`;
}

/**
 * @param {string} path - Absolute URL or path under /api/v1 (e.g. '/videos/123')
 * @param {RequestInit & { timeoutMs?: number, token?: string | null }} [options]
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  const {
    timeoutMs = 15000,
    token = null,
    headers: optHeaders,
    next: nextOpts = { revalidate: 60 },
    ...rest
  } = options;

  const url =
    path.includes('/api/v1') || path.startsWith('http')
      ? path
      : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = { ...(optHeaders || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (rest.body && typeof rest.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      signal: controller.signal,
      // Public SEO data can be cached; callers may override with next: { revalidate: 0 } or cache: 'no-store'
      next: nextOpts,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError({ status: 0, code: 'ABORTED', message: 'Request aborted' });
    }
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: err?.message || 'Network error',
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) {
    if (response.status === 204) return null;
    return response.json();
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    /* ignore */
  }

  throw new ApiError({
    status: response.status,
    code: body.error_code || 'HTTP_ERROR',
    message: body.detail || `Request failed with status ${response.status}`,
    fields: body.fields || [],
    traceId: body.trace_id || null,
  });
}

// ── Public read helpers (STEP 3 crawlable routes) ────────────────────────────

export async function getVideoById(id, token = null) {
  return apiFetch(`/videos/${id}`, { token });
}

export async function getVideos(type, { token = null, skip = 0, limit = 20, mood = '', feedMode = '' } = {}) {
  const moodQuery = mood ? `&mood=${encodeURIComponent(mood)}` : '';
  const feedModeQuery = feedMode ? `&feed_mode=${encodeURIComponent(feedMode)}` : '';
  return apiFetch(
    `/videos/?video_type=${encodeURIComponent(type)}&skip=${skip}&limit=${limit}${moodQuery}${feedModeQuery}`,
    { token }
  );
}

export async function getRecommendedFeed(videoType = 'flash', { token = null, limit = 20, mood = '' } = {}) {
  const moodQuery = mood ? `&mood=${encodeURIComponent(mood)}` : '';
  try {
    return await apiFetch(
      `/recommend/feed?video_type=${encodeURIComponent(videoType)}&limit=${limit}${moodQuery}`,
      { token, timeoutMs: 2000 }
    );
  } catch {
    return null;
  }
}

export async function getUserProfile(username, token = null) {
  return apiFetch(`/users/profile/${encodeURIComponent(username)}`, { token });
}

export async function getComments({ videoId = null, postId = null, token = null } = {}) {
  const endpoint = videoId ? `/videos/${videoId}/comments` : `/posts/${postId}/comments`;
  return apiFetch(endpoint, { token });
}

export async function getPosts({ token = null, skip = 0, limit = 3 } = {}) {
  return apiFetch(`/posts/?skip=${skip}&limit=${limit}`, { token });
}

export async function getPostById(id, token = null) {
  return apiFetch(`/posts/${id}`, { token });
}

export async function getCategories() {
  return apiFetch('/categories/');
}

export async function getCategoryVideos(categoryName, videoType = 'flash', limit = 30) {
  return apiFetch(
    `/categories/${encodeURIComponent(categoryName)}/videos?video_type=${encodeURIComponent(videoType)}&limit=${limit}`
  );
}

export async function getPublicStats() {
  return apiFetch('/metrics/public', { next: { revalidate: 60 } });
}

export async function getChallenges() {
  return apiFetch('/challenges/');
}

export async function getChallengeById(id) {
  return apiFetch(`/challenges/${id}`);
}

export async function getChallengeLeaderboard(challengeId) {
  return apiFetch(`/challenges/${challengeId}/leaderboard`);
}

export async function getFollowers(username, skip = 0, limit = 100) {
  return apiFetch(`/users/${encodeURIComponent(username)}/followers?skip=${skip}&limit=${limit}`);
}

export async function getFollowing(username, skip = 0, limit = 100) {
  return apiFetch(`/users/${encodeURIComponent(username)}/following?skip=${skip}&limit=${limit}`);
}
