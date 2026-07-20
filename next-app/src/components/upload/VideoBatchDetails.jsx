'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlignLeft, ChevronLeft, Loader2, Tag, Video, Zap } from 'lucide-react';
import { captureCoverFrame } from '@/utils/coverFrame';
import { formatDuration } from '@/utils/videoSelect';
import s from '@/styles/pages/UploadV2.module.css';

/**
 * Per-video caption / tags / cover-frame step after multi-select.
 *
 * @param {{
 *   videos: Array<{ id: string, file: File, name: string, thumbnailUrl: string|null, duration: number|null }>,
 *   drafts: Record<string, { caption: string, tags: string, coverTime: number, coverUrl: string|null, coverBlob: Blob|null }>,
 *   activeId: string,
 *   onActiveChange: (id: string) => void,
 *   onDraftChange: (id: string, patch: object) => void,
 *   onBack: () => void,
 *   onPostAll: () => void,
 *   posting?: boolean,
 *   videoType?: 'home' | 'flash',
 *   onVideoTypeChange?: (type: 'home' | 'flash') => void,
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
  videoType = 'home',
  onVideoTypeChange,
}) {
  const videoRef = useRef(null);
  const scrubTimerRef = useRef(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const active = videos.find((v) => v.id === activeId) || videos[0];
  const draft = active ? drafts[active.id] : null;

  const allHaveCaption = videos.every((v) => (drafts[v.id]?.caption || '').trim().length > 0);
  const captionReadyCount = videos.filter((v) => (drafts[v.id]?.caption || '').trim().length > 0).length;

  // Object URL for the active video (cover scrubber)
  useEffect(() => {
    if (!active?.file) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(active.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [active?.id, active?.file]);

  // Seek preview video when coverTime / objectUrl changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !objectUrl || draft == null) return;
    const t = draft.coverTime ?? 0;
    const apply = () => {
      try {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.currentTime = Math.min(t, Math.max(0, el.duration - 0.05));
        } else {
          el.currentTime = t;
        }
      } catch {
        /* ignore seek race */
      }
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener('loadedmetadata', apply, { once: true });
  }, [objectUrl, draft?.coverTime, active?.id]);

  useEffect(() => {
    return () => {
      if (scrubTimerRef.current) clearTimeout(scrubTimerRef.current);
    };
  }, []);

  if (!active || !draft) return null;

  const duration = active.duration ?? 0;
  const maxTime = duration > 0 ? Math.max(0, duration - 0.05) : 0;

  const scheduleCoverCapture = (timeSec) => {
    if (scrubTimerRef.current) clearTimeout(scrubTimerRef.current);
    setScrubbing(true);
    scrubTimerRef.current = setTimeout(async () => {
      setCapturing(true);
      try {
        const { coverUrl, coverBlob } = await captureCoverFrame(active.file, timeSec);
        const prevUrl = drafts[active.id]?.coverUrl;
        onDraftChange(active.id, { coverTime: timeSec, coverUrl, coverBlob });
        // Revoke previous blob: URL (not data: from initial select)
        if (prevUrl && prevUrl.startsWith('blob:') && prevUrl !== coverUrl) {
          URL.revokeObjectURL(prevUrl);
        }
      } catch (err) {
        console.warn('Cover capture failed', err);
      } finally {
        setCapturing(false);
        setScrubbing(false);
      }
    }, 180);
  };

  const onScrub = (value) => {
    const timeSec = Number(value);
    onDraftChange(active.id, { coverTime: timeSec });
    scheduleCoverCapture(timeSec);
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
            const thumb = d?.coverUrl || v.thumbnailUrl;
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
                <div className={s.batchStripThumb}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" />
                  ) : (
                    <div className={s.batchStripFallback}>{index + 1}</div>
                  )}
                </div>
                <span
                  className={`${s.batchStripDot} ${hasCaption ? s.batchStripDotFilled : ''}`}
                  title={hasCaption ? 'Caption set' : 'Needs caption'}
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
          <div className={s.batchCoverBlock}>
            <label className={s.label}>Cover frame</label>
            <div className={s.batchCoverPreview}>
              {objectUrl ? (
                <video
                  ref={videoRef}
                  src={objectUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className={s.batchCoverVideo}
                />
              ) : null}
              {(scrubbing || capturing) && (
                <div className={s.batchCoverBusy}>
                  <Loader2 className={s.spin} size={22} />
                </div>
              )}
              {draft.coverUrl && (
                <div className={s.batchCoverBadge}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.coverUrl} alt="" />
                  <span>Cover</span>
                </div>
              )}
            </div>
            <div className={s.batchScrubRow}>
              <input
                type="range"
                className={s.batchScrub}
                min={0}
                max={maxTime || 0}
                step={0.05}
                value={Math.min(draft.coverTime || 0, maxTime || 0)}
                disabled={!maxTime || posting || capturing}
                onChange={(e) => onScrub(e.target.value)}
                aria-label="Scrub to pick cover frame"
              />
              <span className={s.batchScrubTime}>
                {formatDuration(draft.coverTime || 0)}
                {duration ? ` / ${formatDuration(duration)}` : ''}
              </span>
            </div>
            <p className={s.batchHint}>Drag to choose the frame that appears as the thumbnail.</p>
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
          {onVideoTypeChange && (
            <div className={s.formGroup} style={{ marginBottom: 0 }}>
              <label className={s.label}>Format</label>
              <div className={s.typeGrid}>
                <div
                  className={`${s.typeCard} ${videoType === 'home' ? s.active : ''}`}
                  onClick={() => !posting && onVideoTypeChange('home')}
                >
                  <Video size={22} style={{ marginBottom: '0.35rem', opacity: videoType === 'home' ? 1 : 0.3 }} />
                  <div style={{ fontWeight: 800 }}>Home</div>
                </div>
                <div
                  className={`${s.typeCard} ${videoType === 'flash' ? s.active : ''}`}
                  onClick={() => !posting && onVideoTypeChange('flash')}
                >
                  <Zap size={22} style={{ marginBottom: '0.35rem', opacity: videoType === 'flash' ? 1 : 0.3 }} />
                  <div style={{ fontWeight: 800 }}>Flash</div>
                </div>
              </div>
            </div>
          )}
          {!allHaveCaption && (
            <p className={s.batchFooterHint}>
              Add a caption to every video to enable Post all
            </p>
          )}
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={!allHaveCaption || posting}
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
