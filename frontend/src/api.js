export const BASE_URL = import.meta.env.VITE_API_URL || '';
const API_URL = import.meta.env.VITE_API_URL || '';
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
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const response = await fetch(url, options);

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

    // Auto-logout on 401
    if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('monteeq:session-expired', { detail: error }));
    }

    throw error;
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
    const response = await fetch(
        `${API_BASE_URL}/recommend/feed?video_type=${videoType}&limit=${limit}${moodQuery}`,
        { headers }
    );
    if (!response.ok) return null;  // caller falls back to getVideos on failure
    return response.json();
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


export const getComments = async (videoId = null, postId = null) => {
    const endpoint = videoId
        ? `${API_BASE_URL}/videos/${videoId}/comments`
        : `${API_BASE_URL}/posts/${postId}/comments`;
    const response = await fetch(endpoint);
    return response.json();
};

export const postComment = async ({ videoId = null, postId = null, content, parent_id = null }, token) => {
    // Note: Backend currently uses /comment for posts and /comments for videos
    // We match that here to avoid breakage, but standardizing both to /comments is recommended
    const endpoint = videoId
        ? `${API_BASE_URL}/videos/${videoId}/comments`
        : `${API_BASE_URL}/posts/${postId}/comment`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, parent_id })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to post comment');
    }

    return response.json();
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

    const response = await fetch(`${API_BASE_URL}/videos/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
};

export const getPosts = async (token = null, skip = 0, limit = 20) => {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/posts/?skip=${skip}&limit=${limit}`, { headers });
    return response.json();
};

export const createPost = async (content, imageFile, token) => {
    const formData = new FormData();
    formData.append('content', content);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const response = await fetch(`${API_BASE_URL}/posts/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
    return response.json();
};

export const likeVideo = async (videoId, token) => {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

export const shareVideo = async (videoId) => {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/share`, {
        method: 'POST'
    });
    return response.json();
};

export const viewVideo = async (videoId) => {
    // This is the old naive view endpoint. We still keep it as a fallback 
    // or for cases where validation isn't required, but the new system 
    // use initView and sendHeartbeat
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/view`, {
        method: 'POST'
    });
    return response.json();
};

export const initView = async (videoId, token = null) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/views/${videoId}/init-view`, {
        method: 'POST',
        headers
    });
    return response.json();
};

export const sendHeartbeat = async (videoId, sessionId, ticket) => {
    const response = await fetch(`${API_BASE_URL}/views/${videoId}/heartbeat?session_id=${sessionId}&ticket=${ticket}`, {
        method: 'POST'
    });
    return response.json();
};

export const searchVideos = async (query) => {
    const response = await fetch(`${API_BASE_URL}/videos/search?q=${encodeURIComponent(query)}`);
    return response.json();
};

export const getSearchSuggestions = async (query) => {
    const response = await fetch(`${API_BASE_URL}/videos/suggestions?q=${encodeURIComponent(query)}`);
    return response.json();
};

export const getUserProfile = async (username, token = null) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/users/profile/${username}`, { headers });
    if (!response.ok) throw new Error('Profile not found');
    return response.json();
};

export const toggleFollow = async (userId, token) => {
    return apiFetch(`/users/follow/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
};

export const searchUnified = async (query) => {
    const response = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`);
    return response.json();
};
export const getTrendingSuggestions = async () => {
    const response = await fetch(`${API_BASE_URL}/videos/trending-suggestions`);
    return response.json();
};

export const deleteVideo = async (videoId, token) => {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

export const deletePost = async (postId, token) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

export const getUserInsights = async (token) => {
    const response = await fetch(`${API_BASE_URL}/users/me/insights`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

export const getAchievements = async (token) => {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/achievements/`, { headers });
    return response.json();
};

export const getUnreadNotifications = async (token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/unread`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
};

export const markNotificationRead = async (token, notificationId) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to mark notification read');
    return response.json();
};

export const markAllNotificationsRead = async (token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to mark all notifications read');
    return response.json();
};

export const getAllNotifications = async (token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
};

export const getAds = async () => {
    const response = await fetch(`${API_BASE_URL}/ads`);
    return response.json();
};

export const getUserPerformance = async (token, metric = "views", days = 30) => {
    const response = await fetch(`${API_BASE_URL}/users/me/performance?metric=${metric}&days=${days}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

export const getContentAnalytics = async (token, limit = 10) => {
    const response = await fetch(`${API_BASE_URL}/users/me/content-analytics?limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const getAudienceSplit = async (token, days = 30) => {
    const response = await fetch(`${API_BASE_URL}/users/me/audience-split?days=${days}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const getGrowthIntelligence = async (token) => {
    const response = await fetch(`${API_BASE_URL}/users/me/growth-intelligence`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const uploadPublicKey = async (publicKey, token) => {
    const response = await fetch(`${API_BASE_URL}/chat/keys`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ public_key: publicKey })
    });
    return response.json();
};

export const getUserPublicKey = async (username, token) => {
    const response = await fetch(`${API_BASE_URL}/chat/keys/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const sendChatMessage = async (messageData, token) => {
    const response = await fetch(`${API_BASE_URL}/chat/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(messageData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send message');
    }

    return response.json();
};

export const getConversations = async (token) => {
    const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const getChatMessages = async (conversationId, token) => {
    const response = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const updateComment = async ({ videoId = null, postId = null, commentId, content }, token) => {
    const endpoint = videoId
        ? `${API_BASE_URL}/videos/${videoId}/comments/${commentId}`
        : `${API_BASE_URL}/posts/${postId}/comments/${commentId}`;
    const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
    });
    return response.json();
};

export const deleteComment = async ({ videoId = null, postId = null, commentId }, token) => {
    const endpoint = videoId
        ? `${API_BASE_URL}/videos/${videoId}/comments/${commentId}`
        : `${API_BASE_URL}/posts/${postId}/comments/${commentId}`;
    const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
};

export const getFollowers = async (username, skip = 0, limit = 100) => {
    const response = await fetch(`${API_BASE_URL}/users/${username}/followers?skip=${skip}&limit=${limit}`);
    return response.json();
};

export const getFollowing = async (username, skip = 0, limit = 100) => {
    const response = await fetch(`${API_BASE_URL}/users/${username}/following?skip=${skip}&limit=${limit}`);
    return response.json();
};

// Challenges API
export const getChallenges = async () => {
    const response = await fetch(`${API_BASE_URL}/challenges/`);
    return response.json();
};

export const getChallengeById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/challenges/${id}`);
    if (!response.ok) throw new Error('Challenge not found');
    return response.json();
};

export const enterChallenge = async (challengeId, formData, token) => {
    const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/enter`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
    return response.json();
};

export const checkChallengeEntry = async (challengeId, token) => {
    const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/entry`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const getChallengeLeaderboard = async (challengeId) => {
    const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/leaderboard`);
    return response.json();
};

export const createChallenge = async (challengeData, token) => {
    const response = await fetch(`${API_BASE_URL}/admin/challenges`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(challengeData)
    });
    return response.json();
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

export const verifyProSubscription = async (reference, token) => {
    const response = await fetch(`${API_BASE_URL}/monetization/verify-pro`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reference })
    });
    return response.json();
};

export const verifyDeposit = async (reference, token) => {
    const response = await fetch(`${API_BASE_URL}/monetization/deposit/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reference })
    });
    return response.json();
};



export const uploadChatAttachment = async (file, token) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/chat/attachment`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
    return response.json();
};

export const submitPartnerBrief = async (briefData) => {
    const response = await fetch(`${API_BASE_URL}/partners/brief`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(briefData)
    });
    return response.json();
};

export const linkGoogleAccount = async (idToken, token) => {
    const response = await fetch(`${API_BASE_URL}/users/me/link-google`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_token: idToken })
    });
    return response.json();
};

// ── Categories ───────────────────────────────────────────────────────────────

export const getCategories = async () => {
    const response = await fetch(`${API_BASE_URL}/categories/`);
    if (!response.ok) return [];
    return response.json();
};

export const getCategoryVideos = async (categoryName, videoType = 'flash', limit = 30) => {
    const response = await fetch(
        `${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/videos?video_type=${videoType}&limit=${limit}`
    );
    if (!response.ok) return [];
    return response.json();
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

