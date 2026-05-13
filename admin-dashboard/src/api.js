import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';

// ── Typed API Error ──────────────────────────────────────────────────────────
/**
 * ApiError — normalised error from any admin API call.
 * Properties: .status, .code, .message, .fields, .traceId
 */
export class ApiError extends Error {
  constructor({ status, code, message, fields = [], traceId = null }) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.code    = code;
    this.fields  = fields;
    this.traceId = traceId;
  }
}

// ── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ── Response Interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  // ✅ Success — pass through untouched
  (response) => response,

  // ❌ Error — normalise into ApiError and dispatch events
  (error) => {
    const response = error.response;

    if (!response) {
      // Network / timeout error (no HTTP response)
      const netErr = new ApiError({
        status:  0,
        code:    'NETWORK_ERROR',
        message: 'Could not reach the server. Check your connection.',
      });
      window.dispatchEvent(new CustomEvent('admin:api-error', { detail: netErr }));
      return Promise.reject(netErr);
    }

    const { data, status } = response;
    const apiErr = new ApiError({
      status,
      code:    data?.error_code || 'HTTP_ERROR',
      message: data?.detail     || `Request failed with status ${status}`,
      fields:  data?.fields     || [],
      traceId: data?.trace_id   || null,
    });

    if (status === 401) {
      // Session expired — clear token and redirect to login
      localStorage.removeItem('adminToken');
      window.dispatchEvent(new CustomEvent('admin:session-expired', { detail: apiErr }));
      window.location.href = '/';
    } else if (status === 403) {
      window.dispatchEvent(new CustomEvent('admin:api-error', {
        detail: { ...apiErr, message: apiErr.message || 'Insufficient privileges.' }
      }));
    } else if (status >= 500) {
      window.dispatchEvent(new CustomEvent('admin:api-error', {
        detail: { ...apiErr, message: `Server error${apiErr.traceId ? ` (trace: ${apiErr.traceId})` : ''}. Please try again.` }
      }));
    }

    return Promise.reject(apiErr);
  }
);


export const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/admin/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
};

export const getMe = async (token) => {
    const response = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const getStats = async (token) => {
    const response = await api.get('/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const getPartnerLeads = async (token) => {
    const response = await api.get('/partners/admin/leads', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const updatePartnerLeadStatus = async (leadId, status, token) => {
    const response = await api.put(`/partners/admin/leads/${leadId}`, null, {
        params: { status },
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const getUsers = async (token) => {
    const response = await api.get('/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const promoteUser = async (userId, isPremium, token) => {
    const response = await api.post(`/admin/promote/${userId}?is_premium=${isPremium}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};



export const getStorageMode = async (token) => {
    const response = await api.get('/admin/settings/storage-mode', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const updateStorageMode = async (mode, token) => {
    const response = await api.put(`/admin/settings/storage-mode?mode=${mode}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const getPerformanceStats = async (metric, token) => {
    const response = await api.get(`/admin/stats/performance?metric=${metric}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const getAdminConfig = async (token) => {
    const response = await api.get('/admin/config', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

// Challenges Management
export const getAdminChallenges = async (token) => {
    const response = await api.get('/admin/challenges', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const createChallenge = async (challengeData, token) => {
    const response = await api.post('/admin/challenges', challengeData, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const updateChallenge = async (challengeId, challengeData, token) => {
    const response = await api.put(`/admin/challenges/${challengeId}`, challengeData, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const deleteChallenge = async (challengeId, token) => {
    const response = await api.delete(`/admin/challenges/${challengeId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};
