/**
 * Browser-side FastAPI helpers for Watch mutations & player analytics.
 * Uses NEXT_PUBLIC_API_BASE_URL (never reads env secrets).
 * Token is passed explicitly or read from localStorage when present.
 */

import { getClientApiBaseUrl } from './streamUrl';

export class ClientApiError extends Error {
  constructor({ status, code, message }) {
    super(message);
    this.name = 'ClientApiError';
    this.status = status;
    this.code = code;
  }
}

function getToken(explicit) {
  if (explicit != null) return explicit;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function clientFetch(path, options = {}) {
  const base = getClientApiBaseUrl();
  const url =
    path.startsWith('http') || path.includes('/api/v1')
      ? path
      : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const { token: tokenOpt, headers: optHeaders, timeoutMs, ...rest } = options;
  const token = getToken(tokenOpt);
  const headers = { ...(optHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (rest.body && typeof rest.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = timeoutMs ? new AbortController() : null;
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  try {
    res = await fetch(url, {
      ...rest,
      headers,
      signal: controller?.signal ?? rest.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    let body = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ClientApiError({
      status: res.status,
      code: body.error_code || 'HTTP_ERROR',
      message: body.detail || `Request failed (${res.status})`,
    });
  }
  return res.json();
}

export async function initView(videoId, token = null) {
  return clientFetch(`/views/${videoId}/init-view`, { method: 'POST', token });
}

export async function sendHeartbeat(videoId, sessionId, ticket) {
  return clientFetch(
    `/views/${videoId}/heartbeat?session_id=${encodeURIComponent(sessionId)}&ticket=${encodeURIComponent(ticket)}`,
    { method: 'POST' }
  );
}

export async function getVideoById(id, token = null) {
  return clientFetch(`/videos/${id}`, { token });
}

export async function getUserProfile(username, token = null) {
  return clientFetch(`/users/profile/${encodeURIComponent(username)}`, { token });
}

export async function likeVideo(videoId, token = null) {
  return clientFetch(`/videos/${videoId}/like`, { method: 'POST', token });
}

export async function shareVideo(videoId) {
  return clientFetch(`/videos/${videoId}/share`, { method: 'POST' });
}

export async function getComments({ videoId = null, postId = null, token = null } = {}) {
  const endpoint = videoId ? `/videos/${videoId}/comments` : `/posts/${postId}/comments`;
  return clientFetch(endpoint, { token });
}

export async function postComment({ videoId = null, postId = null, content, parent_id = null }, token = null) {
  const endpoint = videoId
    ? `/videos/${videoId}/comments`
    : `/posts/${postId}/comment`;
  return clientFetch(endpoint, {
    method: 'POST',
    token,
    body: JSON.stringify({ content, parent_id }),
  });
}

export async function updateComment({ videoId = null, postId = null, commentId, content }, token = null) {
  const endpoint = videoId
    ? `/videos/${videoId}/comments/${commentId}`
    : `/posts/${postId}/comments/${commentId}`;
  return clientFetch(endpoint, {
    method: 'PUT',
    token,
    body: JSON.stringify({ content }),
  });
}

export async function deleteComment({ videoId = null, postId = null, commentId }, token = null) {
  const endpoint = videoId
    ? `/videos/${videoId}/comments/${commentId}`
    : `/posts/${postId}/comments/${commentId}`;
  return clientFetch(endpoint, {
    method: 'DELETE',
    token,
  });
}

export async function likeComment(commentId, token = null) {
  return clientFetch(`/comments/${commentId}/like`, { method: 'POST', token });
}

export async function toggleFollow(userId, token = null) {
  return clientFetch(`/users/follow/${userId}`, { method: 'POST', token });
}

export async function fetchMe(token = null) {
  return clientFetch('/users/me', { token });
}

export async function getFollowers(username, skip = 0, limit = 100) {
  return clientFetch(
    `/users/${encodeURIComponent(username)}/followers?skip=${skip}&limit=${limit}`
  );
}

export async function getFollowing(username, skip = 0, limit = 100) {
  return clientFetch(
    `/users/${encodeURIComponent(username)}/following?skip=${skip}&limit=${limit}`
  );
}

const HOME_PAGE_SIZE = 20;

/** Client-side feed page fetch (pagination after SSR first page). */
export async function fetchHomeVideosPage({
  skip = 0,
  limit = HOME_PAGE_SIZE,
  mood = '',
  token = null,
} = {}) {
  const moodQuery = mood ? `&mood=${encodeURIComponent(mood)}` : '';
  return clientFetch(
    `/videos/?video_type=home&skip=${skip}&limit=${limit}${moodQuery}`,
    { token }
  );
}

export async function fetchFlashShelf({ limit = 18, token = null } = {}) {
  return clientFetch(`/videos/?video_type=flash&skip=0&limit=${limit}`, { token });
}

export async function fetchFlashVideosPage({
  skip = 0,
  limit = 15,
  mood = '',
  token = null,
  feedMode = '',
} = {}) {
  const moodQuery = mood ? `&mood=${encodeURIComponent(mood)}` : '';
  const feedModeQuery = feedMode ? `&feed_mode=${encodeURIComponent(feedMode)}` : '';
  return clientFetch(
    `/videos/?video_type=flash&skip=${skip}&limit=${limit}${moodQuery}${feedModeQuery}`,
    { token }
  );
}

export async function fetchRecommendedFlash({ limit = 15, mood = '', token = null } = {}) {
  const moodQuery = mood ? `&mood=${encodeURIComponent(mood)}` : '';
  try {
    return await clientFetch(
      `/recommend/feed?video_type=flash&limit=${limit}${moodQuery}`,
      { token, timeoutMs: 2000 }
    );
  } catch {
    return null;
  }
}

export async function fetchCategories() {
  return clientFetch('/categories/');
}

export async function fetchCategoryFlashVideos(categoryName, limit = 30) {
  return clientFetch(
    `/categories/${encodeURIComponent(categoryName)}/videos?video_type=flash&limit=${limit}`
  );
}

export async function viewVideo(videoId) {
  return clientFetch(`/videos/${videoId}/view`, { method: 'POST' });
}

export async function getChallengeLeaderboard(challengeId) {
  return clientFetch(`/challenges/${challengeId}/leaderboard`);
}

export async function checkChallengeEntry(challengeId, token = null) {
  return clientFetch(`/challenges/${challengeId}/entry`, { token });
}

export async function enterChallenge(challengeId, formData, token = null) {
  return clientFetch(`/challenges/${challengeId}/enter`, {
    method: 'POST',
    token,
    body: formData,
  });
}

export async function fetchChallengesList() {
  return clientFetch('/challenges/');
}

export async function submitPartnerBrief(briefData) {
  return clientFetch('/partners/brief', {
    method: 'POST',
    body: JSON.stringify(briefData),
  });
}

/** OAuth2 password form → `/auth/token` */
export async function loginWithPassword({ username, password }) {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);
  return clientFetch('/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

export async function registerUser(userData) {
  return clientFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function googleAuth(credential) {
  return clientFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export async function verifyLogin2FA(username, code) {
  return clientFetch('/auth/verify-2fa', {
    method: 'POST',
    body: JSON.stringify({ username, code }),
  });
}

export async function verifyEmail({ email, code }) {
  return clientFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function resendVerification(email) {
  return clientFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function checkUsernameAvailable(username) {
  return clientFetch(`/auth/check-username?username=${encodeURIComponent(username)}`);
}

export async function checkEmailAvailable(email) {
  return clientFetch(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function checkEmailExists(email) {
  return clientFetch(`/auth/check-email-exists?email=${encodeURIComponent(email)}`);
}

export async function requestPasswordReset(email) {
  return clientFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword({ email, code, new_password }) {
  return clientFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password }),
  });
}

export async function getSearchSuggestions(query) {
  return clientFetch(`/videos/suggestions?q=${encodeURIComponent(query)}`);
}

export async function getTrendingSuggestions() {
  return clientFetch('/videos/trending-suggestions');
}

export function isAbortOrNetworkError(error) {
  return Boolean(
    error &&
      (error.code === 'ABORTED' ||
        error.code === 'NETWORK_ERROR' ||
        error.status === 0 ||
        error.name === 'AbortError')
  );
}

export const POSTS_PAGE_SIZE = 3;

export async function fetchPostsPage({ skip = 0, limit = POSTS_PAGE_SIZE, token = null } = {}) {
  return clientFetch(`/posts/?skip=${skip}&limit=${limit}`, { token });
}

export async function likePost(postId, token = null) {
  return clientFetch(`/posts/${postId}/like`, { method: 'POST', token });
}

export async function repostPost(postId, token = null) {
  return clientFetch(`/posts/${postId}/repost`, { method: 'POST', token });
}

export async function deletePost(postId, token = null) {
  return clientFetch(`/posts/${postId}`, { method: 'DELETE', token });
}

export { HOME_PAGE_SIZE };
