import { apiFetch } from '@/lib/browserApi';
import { toApiReportReason } from '@/types/videoCardMenu';

/**
 * @param {Object} params
 * @param {'video'|'flash'} params.contentType
 * @param {string|number} params.contentId
 * @param {string} params.reason
 * @param {string|null} [params.description]
 * @param {string} params.token
 */
export async function submitContentReport({
    contentType,
    contentId,
    reason,
    description = null,
    token,
}) {
    return apiFetch('/reports', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            content_type: contentType,
            content_id: contentId,
            reason: toApiReportReason(reason),
            description: description?.trim() || null,
        }),
    });
}

/**
 * @param {Object} params
 * @param {string|number} params.videoId
 * @param {string} params.reason
 * @param {string|null} [params.description]
 * @param {string} params.token
 */
export function submitVideoReport({ videoId, reason, description, token }) {
    return submitContentReport({
        contentType: 'video',
        contentId: videoId,
        reason,
        description,
        token,
    });
}
