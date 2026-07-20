import { create } from 'zustand';

/**
 * Persistent upload toast store (survives route changes).
 *
 * @typedef {{
 *   jobId: string,
 *   fileName: string,
 *   thumbnailUrl: string|null,
 *   progress: number,
 *   status: 'uploading'|'queued'|'processing'|'completed'|'failed',
 *   error: string|null,
 *   videoId?: string|null,
 * }} ActiveUpload
 */

export const useUploadStore = create((set, get) => ({
  /** @type {ActiveUpload[]} */
  activeUploads: [],

  /**
   * @param {Partial<ActiveUpload> & { jobId: string, fileName: string }} job
   */
  addUpload: (job) => {
    const entry = {
      jobId: job.jobId,
      fileName: job.fileName,
      thumbnailUrl: job.thumbnailUrl ?? null,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      status: job.status || 'uploading',
      error: job.error ?? null,
      videoId: job.videoId ?? null,
    };

    set((state) => {
      const exists = state.activeUploads.some((u) => u.jobId === entry.jobId);
      if (exists) {
        return {
          activeUploads: state.activeUploads.map((u) =>
            u.jobId === entry.jobId ? { ...u, ...entry } : u
          ),
        };
      }
      return { activeUploads: [...state.activeUploads, entry] };
    });
  },

  /**
   * @param {string} jobId
   * @param {Partial<ActiveUpload>} updates
   */
  updateUpload: (jobId, updates) => {
    set((state) => ({
      activeUploads: state.activeUploads.map((u) =>
        u.jobId === jobId ? { ...u, ...updates } : u
      ),
    }));
  },

  /** @param {string} jobId */
  removeUpload: (jobId) => {
    const entry = get().activeUploads.find((u) => u.jobId === jobId);
    if (entry?.thumbnailUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(entry.thumbnailUrl);
      } catch {
        /* ignore */
      }
    }
    set((state) => ({
      activeUploads: state.activeUploads.filter((u) => u.jobId !== jobId),
    }));
  },

  /** @param {string} jobId */
  getUpload: (jobId) => get().activeUploads.find((u) => u.jobId === jobId) ?? null,
}));
