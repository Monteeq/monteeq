/**
 * @typedef {Object} VideoCardMenuVideo
 * @property {string|number} id
 * @property {string} [title]
 */

/**
 * @typedef {'spam'|'copyright'|'violence'|'hate'|'sexual'|'harassment'|'terrorism'|'child_safety'|'other'} VideoReportReasonValue
 */

/**
 * @typedef {Object} VideoReportReason
 * @property {VideoReportReasonValue} value
 * @property {string} label
 */

/** @type {VideoReportReason[]} */
export const VIDEO_REPORT_REASONS = [
    { value: 'spam', label: 'Spam or misleading' },
    { value: 'copyright', label: 'Copyright infringement' },
    { value: 'violence', label: 'Violence or harmful content' },
    { value: 'hate', label: 'Hate speech' },
    { value: 'sexual', label: 'Nudity or sexual content' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'terrorism', label: 'Terrorism or extremist content' },
    { value: 'child_safety', label: 'Child safety' },
    { value: 'other', label: 'Other' },
];

/** Map UI reason values to API-accepted reason strings */
export const toApiReportReason = (value) => {
    const map = {
        spam: 'spam',
        copyright: 'copyright',
        violence: 'violence',
        hate: 'hate',
        sexual: 'sexual',
        harassment: 'harassment',
        terrorism: 'violence',
        child_safety: 'other',
        other: 'other',
    };
    return map[value] || 'other';
};
