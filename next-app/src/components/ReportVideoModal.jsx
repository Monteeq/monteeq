'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { submitVideoReport } from '@/services/reportService';
import { VIDEO_REPORT_REASONS } from '@/types/videoCardMenu';
import s from './ReportVideoModal.module.css';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled])';

/**
 * @param {Object} props
 * @param {string|number} props.videoId
 * @param {() => void} props.onClose
 * @param {React.RefObject<HTMLElement>} [props.returnFocusRef]
 */
const ReportVideoModal = ({ videoId, onClose, returnFocusRef }) => {
    const { token } = useAuth();
    const { showNotification } = useNotification();
    const modalRef = useRef(null);
    const closeTimerRef = useRef(null);

    const [reason, setReason] = useState('');
    const [otherDetails, setOtherDetails] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const requestClose = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
        closeTimerRef.current = window.setTimeout(() => {
            onClose();
            returnFocusRef?.current?.focus();
        }, 160);
    }, [isClosing, onClose, returnFocusRef]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                requestClose();
                return;
            }

            if (event.key !== 'Tab' || !modalRef.current) return;

            const focusable = Array.from(
                modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusTimer = window.setTimeout(() => {
            const first = modalRef.current?.querySelector(FOCUSABLE_SELECTOR);
            first?.focus();
        }, 0);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            window.clearTimeout(focusTimer);
            window.clearTimeout(closeTimerRef.current);
        };
    }, [requestClose]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!reason) {
            setErrorMsg('Please select a reason.');
            return;
        }
        if (!token) {
            showNotification('info', 'Sign in to report videos');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            await submitVideoReport({
                videoId,
                reason,
                description: reason === 'other' ? otherDetails : otherDetails.trim() || null,
                token,
            });
            setSubmitted(true);
            showNotification('success', 'Thank you. Report submitted successfully.');
        } catch (err) {
            setErrorMsg(err?.message || 'Failed to submit report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div
            className={`${s.reportOverlay} ${isClosing ? s.reportOverlayClosing : ''}`}
            onClick={requestClose}
            role="presentation"
        >
            <div
                ref={modalRef}
                className={`${s.modal} ${isClosing ? s.modalClosing : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-video-title"
                aria-describedby="report-video-description"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    className={s.closeBtn}
                    onClick={requestClose}
                    aria-label="Close report dialog"
                >
                    <X size={18} />
                </button>

                {submitted ? (
                    <div className={s.successState}>
                        <CheckCircle size={52} color="#10b981" aria-hidden="true" />
                        <h2 className={s.successTitle}>Report Submitted</h2>
                        <p className={s.successText}>
                            Thank you for helping keep Monteeq safe. Our moderation team will review this report as soon as possible.
                        </p>
                        <button type="button" className={s.submitBtn} onClick={requestClose}>
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <h2 id="report-video-title" className={s.title}>Report Video</h2>
                        <p id="report-video-description" className={s.description}>
                            Help us understand what&apos;s wrong with this video.
                        </p>

                        <fieldset className={s.reasonList}>
                            <legend className={s.srOnly}>Report reason</legend>
                            {VIDEO_REPORT_REASONS.map((option) => (
                                <label
                                    key={option.value}
                                    className={`${s.reasonOption} ${reason === option.value ? s.reasonOptionSelected : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="report-reason"
                                        value={option.value}
                                        checked={reason === option.value}
                                        onChange={() => setReason(option.value)}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </fieldset>

                        {reason === 'other' && (
                            <div className={s.otherDetails}>
                                <label htmlFor="report-other-details">Additional details (optional)</label>
                                <textarea
                                    id="report-other-details"
                                    value={otherDetails}
                                    onChange={(event) => setOtherDetails(event.target.value)}
                                    placeholder="Tell us more about the issue..."
                                />
                            </div>
                        )}

                        {errorMsg && (
                            <div className={s.error} role="alert">
                                <AlertTriangle size={16} aria-hidden="true" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className={s.actions}>
                            <button type="button" className={s.cancelBtn} onClick={requestClose}>
                                Cancel
                            </button>
                            <button type="submit" className={s.submitBtn} disabled={loading || !reason}>
                                {loading && <Loader2 size={16} className={s.spinner} aria-hidden="true" />}
                                Submit Report
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ReportVideoModal;
