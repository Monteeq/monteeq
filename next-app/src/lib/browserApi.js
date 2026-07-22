export const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
// In development, we use the Vite proxy (relative paths). In production, we use the full URL if provided.
export const API_BASE_URL = API_URL ? `${API_URL}/api/v1` : '/api/v1';

// ── Typed API Error ──────────────────────────────────────────────────────────
/**
 * ApiError — thrown by apiFetch() for any non-2xx response.
 *
 * Properties:
 *   .status  {number}  HTTP status code
 *   .code    {string}  Backend error_code (e.g. "VIDEO_NOT_FOUND")
 *   .message {string}  Human-readable detail string
 *   .fields  {Array}   Validation field errors (422 only)
 *   .traceId {string}  Server trace_id (500 only)
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

export const isAbortOrNetworkError = (error) => {
    return Boolean(
        error &&
        (
            error.code === 'ABORTED' ||
            error.code === 'NETWORK_ERROR' ||
            error.status === 0 ||
            error.name === 'AbortError'
        )
    );
};

// ── Central Fetch Wrapper ────────────────────────────────────────────────────
/**
 * apiFetch — drop-in wrapper around fetch() with:
 *   - Structured error parsing (reads { detail, error_code, fields, trace_id })
 *   - Auto-dispatch of 'monteeq:session-expired' on 401 (triggers logout)
 *   - Throws ApiError on non-2xx responses
 *
 * Usage:
 *   const data = await apiFetch('/videos/123', { headers: { Authorization: `Bearer ${token}` } });
 */
export async function apiFetch(path, options = {}) {
    // If the path already contains the base URL (either absolute in production or relative in dev), use it directly.
    // Otherwise, it's a raw endpoint (e.g. '/videos'), so prepend the base URL.
    const url = path.includes(API_BASE_URL) || path.startsWith('http')
        ? path 
        : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    
    // Auto-set Content-Type: application/json for stringified payloads if not set
    const headers = { ...options.headers };
    if (options.body && typeof options.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
    }

    // Support optional per-request timeout (ms)
    const timeoutMs = options.timeoutMs || 15000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort('timeout'), timeoutMs);
    let response;
    try {
        response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
        });
    } catch (err) {
        // Normalize AbortError and network errors into ApiError for callers
        clearTimeout(id);
        if (err && err.name === 'AbortError') {
            throw new ApiError({ status: 0, code: 'ABORTED', message: 'Request aborted' });
        }
        throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: err?.message || 'Network error' });
    } finally {
        clearTimeout(id);
    }

    if (response.ok) {
        // 204 No Content — return null
        if (response.status === 204) return null;
        return response.json();
    }

    // Parse structured error body
    let body = {};
    try { body = await response.json(); } catch (_) { /* ignore parse errors */ }

    const error = new ApiError({
        status: response.status,
        code: body.error_code || 'HTTP_ERROR',
        message: body.detail || `Request failed with status ${response.status}`,
        fields: body.fields || [],
        traceId: body.trace_id || null,
    });

    // Auto-logout on 401 — but only if the user was already logged in.
    // A 401 on /auth/token or /auth/google means wrong credentials, not expiry.
    if (response.status === 401) {
        const isAuthEndpoint =
            url.includes('/auth/token') ||
            url.includes('/token') ||
            url.includes('/auth/google') ||
            url.includes('/auth/verify-2fa') ||
            url.includes('/auth/register');

        const hasExistingSession = !!localStorage.getItem('token');

        if (!isAuthEndpoint && hasExistingSession) {
            window.dispatchEvent(new CustomEvent('monteeq:session-expired', { detail: error }));
        }
    }

    throw error;
}

// Lightweight fetch helper with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 2000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(id);
    }
}


export const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    return apiFetch('/token', {
        method: 'POST',
        body: formData,
    });
};


export const getVideos = async (type, token = null, skip = 0, limit = 20, mood = '', feedMode = '') => {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const moodQuery = mood ? `&mood=${mood}` : '';
    const feedModeQuery = feedMode ? `&feed_mode=${feedMode}` : '';
    return apiFetch(`/videos/?video_type=${type}&skip=${skip}&limit=${limit}${moodQuery}${feedModeQuery}`, { headers });
};


/**
 * Fetch a personalised ranked feed from the recommendation engine.
 * Falls back gracefully if the user is unauthenticated.
 * @param {'flash'|'home'} videoType
 */
export const getRecommendedFeed = async (videoType = 'flash', token = null, limit = 20, mood = '') => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const moodQuery = mood ? `&mood=${mood}` : '';
    try {
        // Use a short timeout for recommendation engine to avoid blocking the UI
        const res = await fetchWithTimeout(`${API_BASE_URL}/recommend/feed?video_type=${videoType}&limit=${limit}${moodQuery}`, { headers }, 2000);
        if (!res || !res.ok) return null;
        return res.json();
    } catch (err) {
        // Timeout or network error — gracefully return null so caller falls back
        return null;
    }
};

/**
 * Track a user-video interaction for the recommendation engine.
 */
export const trackInteraction = async (payload, token) => {
    if (!token) return;
    try {
        await fetch(`${API_BASE_URL}/recommend/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
    } catch (_) {
        // Fire-and-forget: never block the UI on tracking failures
    }
};

export const getVideoById = async (id, token = null) => {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return apiFetch(`/videos/${id}`, { headers });
};


export const getComments = async (videoId = null, postId = null, token = null) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const endpoint = videoId
        ? `/videos/${videoId}/comments`
        : `/posts/${postId}/comments`;
    return apiFetch(endpoint, { headers });
};

export const postComment = async ({ videoId = null, postId = null, content, parent_id = null }, token) => {
    // Note: Backend currently uses /comment for posts and /comments for videos
    // We match that here to avoid breakage, but standardizing both to /comments is recommended
    const endpoint = videoId
        ? `${API_BASE_URL}/videos/${videoId}/comments`
        : `${API_BASE_URL}/posts/${postId}/comment`;

    return apiFetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, parent_id })
    });
};

export const uploadVideo = async (token, videoData) => {
    const formData = new FormData();
    formData.append('title', videoData.title);
    formData.append('description', videoData.description || '');
    formData.append('video_type', videoData.type);

    if (videoData.file) {
        formData.append('file', videoData.file);
    }

    if (videoData.thumbnail) {
        formData.append('thumbnail', videoData.thumbnail);
    }

    if (videoData.tags) {
        formData.append('tags', videoData.tags);
    }

    return apiFetch(`${API_BASE_URL}/videos/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });
};

/** Poll async upload/transcode job: { status, video_id?, error_message?, progress? } */
export const getUploadJob = async (jobId, token) => {
    return apiFetch(`${API_BASE_URL}/videos/upload/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 10000,
    });
};

/** Legacy/live Rust progress via Redis: { status, progress, message } */
export const getProcessingStatus = async (processingKey, token = null) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return apiFetch(`${API_BASE_URL}/videos/status/${processingKey}`, {
        headers,
        timeoutMs: 8000,
    });
};

export const getPosts = async (token = null, skip = 0, limit = 20) => {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return apiFetch(`${API_BASE_URL}/posts/?skip=${skip}&limit=${limit}`, { headers });
};

export const createPost = async (content, imageFile, token) => {
    const formData = new FormData();
    formData.append('content', content);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    return apiFetch(`${API_BASE_URL}/posts/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
};

export const likeVideo = async (videoId, token) => {
    return apiFetch(`${API_BASE_URL}/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const likeComment = async (commentId, token) => {
    return apiFetch(`${API_BASE_URL}/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const shareVideo = async (videoId) => {
    return apiFetch(`${API_BASE_URL}/videos/${videoId}/share`, {
        method: 'POST'
    });
};

export const viewVideo = async (videoId) => {
    // This is the old naive view endpoint. We still keep it as a fallback 
    // or for cases where validation isn't required, but the new system 
    // use initView and sendHeartbeat
    return apiFetch(`${API_BASE_URL}/videos/${videoId}/view`, {
        method: 'POST'
    });
};

export const initView = async (videoId, token = null) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return apiFetch(`${API_BASE_URL}/views/${videoId}/init-view`, {
        method: 'POST',
        headers
    });
};

export const sendHeartbeat = async (videoId, sessionId, ticket) => {
    return apiFetch(`${API_BASE_URL}/views/${videoId}/heartbeat?session_id=${sessionId}&ticket=${ticket}`, {
        method: 'POST'
    });
};

export const searchVideos = async (query) => {
    return apiFetch(`${API_BASE_URL}/videos/search?q=${encodeURIComponent(query)}`);
};

export const getSearchSuggestions = async (query) => {
    return apiFetch(`${API_BASE_URL}/videos/suggestions?q=${encodeURIComponent(query)}`);
};

export const getUserProfile = async (username, token = null) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return apiFetch(`${API_BASE_URL}/users/profile/${username}`, { headers });
};

export const toggleFollow = async (userId, token) => {
    return apiFetch(`/users/follow/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const searchUnified = async (query) => {
    return apiFetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`);
};
export const getTrendingSuggestions = async () => {
    return apiFetch(`${API_BASE_URL}/videos/trending-suggestions`);
};

export const deleteVideo = async (videoId, token) => {
    return apiFetch(`${API_BASE_URL}/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const deletePost = async (postId, token) => {
    return apiFetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const getUserInsights = async (token) => {
    return apiFetch(`${API_BASE_URL}/users/me/insights`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const getAchievements = async (token) => {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return apiFetch(`${API_BASE_URL}/achievements/`, { headers });
};

export const getUnreadNotifications = async (token) => {
    return apiFetch(`${API_BASE_URL}/notifications/unread`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const markNotificationRead = async (token, notificationId) => {
    return apiFetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const markAllNotificationsRead = async (token) => {
    return apiFetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const getAllNotifications = async (token) => {
    return apiFetch(`${API_BASE_URL}/notifications/`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const getAds = async () => {
    return apiFetch(`${API_BASE_URL}/ads`);
};

export const getUserPerformance = async (token, metric = "views", days = 30) => {
    return apiFetch(`${API_BASE_URL}/users/me/performance?metric=${metric}&days=${days}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const getContentAnalytics = async (token, limit = 10) => {
    return apiFetch(`${API_BASE_URL}/users/me/content-analytics?limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const getAudienceSplit = async (token, days = 30) => {
    return apiFetch(`${API_BASE_URL}/users/me/audience-split?days=${days}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const getGrowthIntelligence = async (token) => {
    return apiFetch(`${API_BASE_URL}/users/me/growth-intelligence`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const uploadPublicKey = async (publicKey, token) => {
    return apiFetch(`${API_BASE_URL}/chat/keys`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ public_key: publicKey })
    });
};

export const getUserPublicKey = async (username, token) => {
    return apiFetch(`${API_BASE_URL}/chat/keys/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const uploadPrekeyBundle = async (bundle, token) => {
    return apiFetch(`${API_BASE_URL}/chat/keys/prekey-bundle`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bundle)
    });
};

export const getRecipientPrekeyBundles = async (username, token) => {
    return apiFetch(`${API_BASE_URL}/chat/keys/prekey-bundle/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const listDevices = async (token) => {
    return apiFetch(`${API_BASE_URL}/chat/keys/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const revokeDevice = async (deviceId, token) => {
    return apiFetch(`${API_BASE_URL}/chat/keys/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const sendChatMessage = async (messageData, token) => {
    return apiFetch(`${API_BASE_URL}/chat/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(messageData)
    });
};

export const getConversations = async (token) => {
    return apiFetch(`${API_BASE_URL}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const getChatMessages = async (conversationId, token) => {
    return apiFetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const acknowledgeMessages = async (messageIds, token) => {
    return apiFetch(`${API_BASE_URL}/chat/messages/ack`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(messageIds)
    });
};

export const updateComment = async ({ videoId = null, postId = null, commentId, content }, token) => {
    const endpoint = videoId
        ? `${API_BASE_URL}/videos/${videoId}/comments/${commentId}`
        : `${API_BASE_URL}/posts/${postId}/comments/${commentId}`;
    return apiFetch(endpoint, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
    });
};

export const deleteComment = async ({ videoId = null, postId = null, commentId }, token) => {
    const endpoint = videoId
        ? `${API_BASE_URL}/videos/${videoId}/comments/${commentId}`
        : `${API_BASE_URL}/posts/${postId}/comments/${commentId}`;
    return apiFetch(endpoint, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const getFollowers = async (username, skip = 0, limit = 100) => {
    return apiFetch(`${API_BASE_URL}/users/${username}/followers?skip=${skip}&limit=${limit}`);
};

export const getFollowing = async (username, skip = 0, limit = 100) => {
    return apiFetch(`${API_BASE_URL}/users/${username}/following?skip=${skip}&limit=${limit}`);
};

// Challenges API
export const getChallenges = async () => {
    return apiFetch(`${API_BASE_URL}/challenges/`);
};

export const getChallengeById = async (id) => {
    return apiFetch(`${API_BASE_URL}/challenges/${id}`);
};

export const enterChallenge = async (challengeId, formData, token) => {
    return apiFetch(`${API_BASE_URL}/challenges/${challengeId}/enter`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
};

export const checkChallengeEntry = async (challengeId, token) => {
    return apiFetch(`${API_BASE_URL}/challenges/${challengeId}/entry`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const getChallengeLeaderboard = async (challengeId) => {
    return apiFetch(`${API_BASE_URL}/challenges/${challengeId}/leaderboard`);
};

export const createChallenge = async (challengeData, token) => {
    return apiFetch(`${API_BASE_URL}/admin/challenges`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(challengeData)
    });
};

export const fetchProPricing = async () => {
    return await apiFetch(`/monetization/pro/pricing`);
};

export const initializeProSubscription = async (isYearly, token) => {
    return await apiFetch(`/monetization/pro/initialize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_yearly: isYearly })
    });
};

export const createSubscription = async (isYearly, billingDetails, token) => {
    return await apiFetch(`/monetization/subscriptions/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            is_yearly: isYearly,
            full_name: billingDetails.fullName,
            billing_email: billingDetails.billingEmail,
            billing_country: billingDetails.billingCountry,
            billing_zip: billingDetails.billingZip
        })
    });
};

export const verifySubscription = async (subscriptionId, token) => {
    return await apiFetch(`/monetization/subscriptions/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            subscription_id: subscriptionId
        })
    });
};

export const toggleAutoRenew = async (autoRenew, token) => {
    return await apiFetch(`/monetization/subscriptions/auto-renew`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            auto_renew: autoRenew
        })
    });
};

export const cancelSubscription = async (token) => {
    return await apiFetch(`/monetization/subscriptions/cancel`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const getSubscriptionStatus = async (token) => {
    return await apiFetch(`/monetization/subscription/status`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const createCustomerPortalSession = async (token) => {
    return await apiFetch(`/monetization/customer-portal`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
};

export const verifyProSubscription = async (reference, token) => {
    return apiFetch(`${API_BASE_URL}/monetization/verify-pro`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reference })
    });
};

export const verifyDeposit = async (reference, token) => {
    return apiFetch(`${API_BASE_URL}/monetization/deposit/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reference })
    });
};



export const uploadChatAttachment = async (file, token) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiFetch(`${API_BASE_URL}/chat/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
};

export const submitPartnerBrief = async (briefData) => {
    return apiFetch(`${API_BASE_URL}/partners/brief`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(briefData)
    });
};

export const linkGoogleAccount = async (idToken, token) => {
    return apiFetch(`${API_BASE_URL}/users/me/link-google`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_token: idToken })
    });
};

// ── Categories ───────────────────────────────────────────────────────────────

export const getCategories = async () => {
    try {
        return await apiFetch(`${API_BASE_URL}/categories/`);
    } catch (e) {
        return [];
    }
};

export const getCategoryVideos = async (categoryName, videoType = 'flash', limit = 30) => {
    try {
        return await apiFetch(
            `${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/videos?video_type=${videoType}&limit=${limit}`
        );
    } catch (e) {
        return [];
    }
};

export const getFollowingFeed = async (token, skip = 0, limit = 20, contentType = 'all') => {
    return apiFetch(`/following/feed?skip=${skip}&limit=${limit}&content_type=${contentType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const getRecommendedCreators = async (token = null) => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    return apiFetch('/following/recommendations', { headers });
};

