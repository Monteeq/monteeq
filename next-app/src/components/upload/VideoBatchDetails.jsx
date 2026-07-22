'use client';

import React, { useEffect, useRef } from 'react';
import {
  AlignLeft,
  AlertCircle,
  ChevronLeft,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Tag,
  Video,
  X,
  Zap,
} from 'lucide-react';
import {
  defaultVideoTypeForOrientation,
  readVideoAspect,
} from '@/utils/videoSelect';
import s from '@/styles/pages/UploadV2.module.css';

/**
 * Per-video caption / tags / cover / format step after multi-select.
 *
 * @param {{
 *   videos: Array<{
 *     id: string,
 *     file: File,
 *     name: string,
 *     thumbnailUrl: string|null,
 *     duration: number|null,
 *     width?: number|null,
 *     height?: number|null,
 *     aspectRatio?: number|null,
 *     orientation?: 'landscape'|'portrait'|'square'|null,
 *   }>,
 *   drafts: Record<string, {
 *     caption: string,
 *     tags: string,
 *     coverSource: 'auto' | 'custom',
 *     coverFile: File|null,
 *     coverPreviewUrl: string|null,
 *     videoType: 'home' | 'flash',
 *     aspectRatio: number|null,
 *     orientation: 'landscape'|'portrait'|'square'|null,
 *   }>,
 *   activeId: string,
 *   onActiveChange: (id: string) => void,
 *   onDraftChange: (id: string, patch: object) => void,
 *   onBack: () => void,
 *   onPostAll: () => void,
 *   posting?: boolean,
 * }} props
 */
export default function VideoBatchDetails({
  videos,
  drafts,
  activeId,
  onActiveChange,
  onDraftChange,
  onBack,
  onPostAll,
  posting = false,
}) {
  const coverInputRef = useRef(null);
  const probedRef = useRef(new Set());

  const active = videos.find((v) => v.id === activeId) || videos[0];
  const draft = active ? drafts[active.id] : null;

  const allHaveCaption = videos.every((v) => (drafts[v.id]?.caption || '').trim().length > 0);
  const captionReadyCount = videos.filter((v) => (drafts[v.id]?.caption || '').trim().length > 0).length;

  const mismatchIds = new Set(
    videos.filter((v) => {
      const d = drafts[v.id];
      if (!d) return false;
      const o = d.orientation;
      const t = d.videoType;
      if (o === 'landscape' && t !== 'home') return true;
      if (o === 'portrait' && t !== 'flash') return true;
      return false;
    }).map((v) => v.id)
  );

  // Probe aspect via hidden <video> if not already known for this draft
  useEffect(() => {
    if (!active?.file || !draft) return;
    if (draft.orientation || draft.aspectRatio != null) return;
    if (probedRef.current.has(active.id)) return;
    probedRef.current.add(active.id);

    let cancelled = false;
    readVideoAspect(active.file).then((info) => {
      if (cancelled) return;
      const orientation = info.orientation;
      const videoType = defaultVideoTypeForOrientation(orientation);
      onDraftChange(active.id, {
        aspectRatio: info.aspectRatio,
        orientation,
        videoType,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.file, draft?.orientation, draft?.aspectRatio, onDraftChange]);

  if (!active || !draft) return null;

  const coverSource = draft.coverSource === 'custom' ? 'custom' : 'auto';
  const videoType = draft.videoType === 'flash' ? 'flash' : 'home';
  const orientation = draft.orientation;
  const homeDisabled = orientation === 'portrait';
  const flashDisabled = orientation === 'landscape';
  const isSquare = orientation === 'square' || orientation == null;

  const stripThumbFor = (v) => {
    const d = drafts[v.id];
    if (d?.coverSource === 'custom' && d?.coverPreviewUrl) return d.coverPreviewUrl;
    return v.thumbnailUrl;
  };

  const setCoverSource = (source) => {
    if (source === 'auto') {
      const prevUrl = draft.coverPreviewUrl;
      onDraftChange(active.id, {
        coverSource: 'auto',
        coverFile: null,
        coverPreviewUrl: null,
      });
      if (prevUrl && prevUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrl);
      }
      return;
    }
    onDraftChange(active.id, { coverSource: 'custom' });
    if (!draft.coverFile) {
      requestAnimationFrame(() => coverInputRef.current?.click());
    }
  };

  const onCoverFilePicked = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    const prevUrl = draft.coverPreviewUrl;
    const coverPreviewUrl = URL.createObjectURL(file);
    onDraftChange(active.id, {
      coverSource: 'custom',
      coverFile: file,
      coverPreviewUrl,
    });
    if (prevUrl && prevUrl.startsWith('blob:') && prevUrl !== coverPreviewUrl) {
      URL.revokeObjectURL(prevUrl);
    }
  };

  const clearCustomCover = (e) => {
    e.stopPropagation();
    const prevUrl = draft.coverPreviewUrl;
    onDraftChange(active.id, {
      coverSource: 'custom',
      coverFile: null,
      coverPreviewUrl: null,
    });
    if (prevUrl && prevUrl.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrl);
    }
  };

  const setVideoType = (type) => {
    if (posting) return;
    if (type === 'home' && homeDisabled) return;
    if (type === 'flash' && flashDisabled) return;
    onDraftChange(active.id, { videoType: type });
  };

  return (
    <div className={s.batchStage}>
      <div className={s.batchPanel}>
        <div className={s.batchTopBar}>
          <button type="button" className={s.batchBack} onClick={onBack} disabled={posting}>
            <ChevronLeft size={18} />
            Back
          </button>
          <div className={s.batchTopMeta}>
            <h2 className={s.batchTitle}>Edit each video</h2>
            <p className={s.batchSub}>
              {captionReadyCount}/{videos.length} with captions
            </p>
          </div>
        </div>

        {/* Thumbnail strip */}
        <div className={s.batchStrip} role="tablist" aria-label="Selected videos">
          {videos.map((v, index) => {
            const d = drafts[v.id];
            const hasCaption = (d?.caption || '').trim().length > 0;
            const isActive = v.id === active.id;
            const thumb = stripThumbFor(v);
            const hasMismatch = mismatchIds.has(v.id);
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${s.batchStripItem} ${isActive ? s.batchStripItemActive : ''}`}
                onClick={() => onActiveChange(v.id)}
                disabled={posting}
              >
                <div className={`${s.batchStripThumb} ${hasMismatch ? s.batchStripThumbError : ''}`}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" />
                  ) : (
                    <div className={s.batchStripFallback}>{index + 1}</div>
                  )}
                  {hasMismatch && (
                    <span className={s.batchStripErrorBadge} title="Format does not match orientation">
                      <AlertCircle size={16} />
                    </span>
                  )}
                </div>
                <span
                  className={`${s.batchStripDot} ${hasCaption ? s.batchStripDotFilled : ''} ${hasMismatch ? s.batchStripDotError : ''}`}
                  title={hasMismatch ? 'Format mismatch' : hasCaption ? 'Caption set' : 'Needs caption'}
                  aria-hidden
                />
                <span className={s.batchStripLabel}>
                  {index + 1}/{videos.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active editor */}
        <div className={s.batchEditor}>
          <div className={s.formGroup}>
            <label className={s.label}>Format</label>
            <div className={s.typeGrid}>
              <button
                type="button"
                className={`${s.typeCard} ${videoType === 'home' ? s.active : ''} ${homeDisabled ? s.typeCardDisabled : ''}`}
                disabled={posting || homeDisabled}
                onClick={() => setVideoType('home')}
                aria-pressed={videoType === 'home'}
              >
                <Video size={22} style={{ marginBottom: '0.35rem', opacity: videoType === 'home' ? 1 : 0.3 }} />
                <div style={{ fontWeight: 800 }}>Home</div>
              </button>
              <button
                type="button"
                className={`${s.typeCard} ${videoType === 'flash' ? s.active : ''} ${flashDisabled ? s.typeCardDisabled : ''}`}
                disabled={posting || flashDisabled}
                onClick={() => setVideoType('flash')}
                aria-pressed={videoType === 'flash'}
              >
                <Zap size={22} style={{ marginBottom: '0.35rem', opacity: videoType === 'flash' ? 1 : 0.3 }} />
                <div style={{ fontWeight: 800 }}>Flash</div>
              </button>
            </div>
            {flashDisabled && (
              <p className={s.batchAspectNote}>
                This video is horizontal — post as Flash requires a vertical video
              </p>
            )}
            {homeDisabled && (
              <p className={s.batchAspectNote}>
                This video is vertical — post as Home requires a horizontal video
              </p>
            )}
            {isSquare && orientation === 'square' && (
              <p className={s.batchHint}>Near-square video — you can choose Home or Flash</p>
            )}
          </div>

          <div className={s.batchCoverBlock}>
            <label className={s.label}>Cover</label>
            <div className={s.coverToggle} role="tablist" aria-label="Cover source">
              <button
                type="button"
                role="tab"
                aria-selected={coverSource === 'auto'}
                className={`${s.coverToggleBtn} ${coverSource === 'auto' ? s.coverToggleBtnActive : ''}`}
                disabled={posting}
                onClick={() => setCoverSource('auto')}
              >
                <Sparkles size={16} />
                Use thumbnail
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={coverSource === 'custom'}
                className={`${s.coverToggleBtn} ${coverSource === 'custom' ? s.coverToggleBtnActive : ''}`}
                disabled={posting}
                onClick={() => setCoverSource('custom')}
              >
                <ImageIcon size={16} />
                Upload cover
              </button>
            </div>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onCoverFilePicked}
            />

            {coverSource === 'auto' ? (
              <p className={s.batchHint}>We&apos;ll generate one automatically</p>
            ) : (
              <div className={s.coverUploadPanel}>
                {draft.coverPreviewUrl ? (
                  <div className={s.coverUploadPreview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.coverPreviewUrl} alt="Cover preview" />
                    <button
                      type="button"
                      className={s.coverUploadClear}
                      aria-label="Remove cover"
                      disabled={posting}
                      onClick={clearCustomCover}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={s.coverUploadEmpty}
                    disabled={posting}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <ImageIcon size={28} />
                    <span>Choose an image</span>
                  </button>
                )}
                {draft.coverFile && (
                  <button
                    type="button"
                    className={s.coverUploadChange}
                    disabled={posting}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    Change image
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor={`caption-${active.id}`}>
              Caption <span className={s.batchRequired}>required</span>
            </label>
            <div className={s.inputWrapper}>
              <AlignLeft className={s.inputIcon} style={{ top: '1.5rem' }} size={18} />
              <textarea
                id={`caption-${active.id}`}
                className={`${s.input} ${s.textarea}`}
                value={draft.caption}
                disabled={posting}
                onChange={(e) => onDraftChange(active.id, { caption: e.target.value })}
                placeholder="Write a caption for this video…"
                rows={4}
              />
            </div>
          </div>

          <div className={s.formGroup}>
            <label className={s.label} htmlFor={`tags-${active.id}`}>
              Tags <span className={s.batchOptional}>optional</span>
            </label>
            <div className={s.inputWrapper}>
              <Tag className={s.inputIcon} size={18} />
              <input
                id={`tags-${active.id}`}
                className={s.input}
                value={draft.tags}
                disabled={posting}
                onChange={(e) => onDraftChange(active.id, { tags: e.target.value })}
                placeholder="anime, gaming, etc."
              />
            </div>
          </div>

          <p className={s.batchFileName} title={active.name}>
            {active.name}
          </p>
        </div>

        <div className={s.batchFooter}>
          {!allHaveCaption && (
            <p className={s.batchFooterHint}>
              Add a caption to every video to enable Post all
            </p>
          )}
          {mismatchIds.size > 0 && (
            <p className={s.batchFooterHint} style={{ color: '#f87171' }}>
              {mismatchIds.size} video{mismatchIds.size > 1 ? 's have' : ' has'} a format mismatch — fix the highlighted {mismatchIds.size > 1 ? 'items' : 'item'} in the strip
            </p>
          )}
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={!allHaveCaption || mismatchIds.size > 0 || posting}
            onClick={onPostAll}
          >
            {posting ? (
              <>
                <Loader2 className={s.spin} size={18} style={{ marginRight: 8 }} />
                Posting…
              </>
            ) : (
              `Post all (${videos.length})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
