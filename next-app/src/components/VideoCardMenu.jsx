'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Bookmark, BookmarkMinus, Flag, Loader2 } from 'lucide-react';
import { videoCardMenuStore } from '@/stores/videoCardMenuStore';
import { useWatchLaterToggle } from '@/hooks/useWatchLaterToggle';
import ReportVideoModal from './ReportVideoModal';
import s from './VideoCardMenu.module.css';

/**
 * @param {Object} props
 * @param {string|number} props.videoId
 * @param {'meta'|'overlay'} [props.placement='meta'] — meta = YouTube-style beside title
 */
const VideoCardMenu = ({ videoId, placement = 'meta' }) => {
    const menuRootRef = useRef(null);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [coords, setCoords] = useState(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    const { isSaved, isPending, toggle } = useWatchLaterToggle(videoId);

    const isOpen = useSyncExternalStore(
        videoCardMenuStore.subscribe,
        () => videoCardMenuStore.getOpenMenuId() === String(videoId),
        () => false
    );

    useEffect(() => {
        setMounted(true);
    }, []);

    const closeMenu = useCallback(() => {
        videoCardMenuStore.closeMenu();
    }, []);

    const handleToggleMenu = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        videoCardMenuStore.toggleMenu(videoId);
    }, [videoId]);

    const handleWatchLater = useCallback(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await toggle();
        closeMenu();
    }, [toggle, closeMenu]);

    const handleReportClick = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        setReportOpen(true);
    }, [closeMenu]);

    const handleReportClose = useCallback(() => {
        setReportOpen(false);
        triggerRef.current?.focus();
    }, []);

    const updateCoords = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const dropdownWidth = 220;
        const dropdownHeight = dropdownRef.current?.offsetHeight || 120;
        const gap = 6;
        const pad = 8;

        let top = rect.bottom + gap;
        let left = rect.right - dropdownWidth;

        const overflowBottom = top + dropdownHeight + pad > window.innerHeight;
        if (overflowBottom) {
            top = Math.max(pad, rect.top - dropdownHeight - gap);
        }

        left = Math.min(Math.max(pad, left), window.innerWidth - dropdownWidth - pad);
        setCoords({ top, left, width: dropdownWidth });
    }, []);

    useLayoutEffect(() => {
        if (!isOpen) {
            setCoords(null);
            return;
        }
        updateCoords();
        // Re-measure after portal mount so height is accurate
        const raf = window.requestAnimationFrame(updateCoords);
        return () => window.cancelAnimationFrame(raf);
    }, [isOpen, updateCoords]);

    useEffect(() => {
        if (!isOpen) return;

        // Ignore scroll for a beat — focusing the first menuitem can scroll the page
        // and VideoCardMenuRouteListener would close the menu immediately.
        videoCardMenuStore.suppressScrollClose(200);

        const handlePointerDown = (event) => {
            if (menuRootRef.current?.contains(event.target)) return;
            if (dropdownRef.current?.contains(event.target)) return;
            closeMenu();
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu();
                triggerRef.current?.focus();
                return;
            }

            if (!dropdownRef.current) return;
            const items = Array.from(
                dropdownRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')
            );
            if (items.length === 0) return;

            const currentIndex = items.indexOf(document.activeElement);
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                items[(currentIndex + 1 + items.length) % items.length]?.focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                items[(currentIndex - 1 + items.length) % items.length]?.focus();
            } else if (event.key === 'Home') {
                event.preventDefault();
                items[0]?.focus();
            } else if (event.key === 'End') {
                event.preventDefault();
                items[items.length - 1]?.focus();
            }
        };

        const handleReposition = () => updateCoords();

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleReposition);

        const focusTimer = window.setTimeout(() => {
            dropdownRef.current?.querySelector('[role="menuitem"]')?.focus();
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleReposition);
            window.clearTimeout(focusTimer);
        };
    }, [isOpen, closeMenu, updateCoords]);

    const dropdown =
        mounted &&
        isOpen &&
        coords &&
        createPortal(
            <div
                ref={dropdownRef}
                className={s.dropdownPortal}
                role="menu"
                aria-label="Video options"
                style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    role="menuitem"
                    className={s.menuItem}
                    disabled={isPending}
                    onClick={handleWatchLater}
                >
                    <span className={s.menuItemIcon} aria-hidden="true">
                        {isPending ? (
                            <Loader2 size={18} className={s.spinner} />
                        ) : isSaved ? (
                            <BookmarkMinus size={18} />
                        ) : (
                            <Bookmark size={18} />
                        )}
                    </span>
                    <span>{isSaved ? 'Remove from Watch Later' : 'Watch Later'}</span>
                </button>

                <button
                    type="button"
                    role="menuitem"
                    className={`${s.menuItem} ${s.menuItemDanger}`}
                    onClick={handleReportClick}
                >
                    <span className={s.menuItemIcon} aria-hidden="true">
                        <Flag size={18} />
                    </span>
                    <span>Report</span>
                </button>
            </div>,
            document.body
        );

    return (
        <>
            <div
                className={`${s.menuRoot} ${placement === 'meta' ? s.menuRootMeta : s.menuRootOverlay}`}
                ref={menuRootRef}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button
                    ref={triggerRef}
                    type="button"
                    className={`${s.menuTrigger} ${placement === 'meta' ? s.menuTriggerMeta : ''}`}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-label="More options"
                    onClick={handleToggleMenu}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <MoreVertical size={24} aria-hidden="true" />
                </button>
            </div>

            {dropdown}

            {reportOpen && (
                <ReportVideoModal
                    videoId={videoId}
                    onClose={handleReportClose}
                    returnFocusRef={triggerRef}
                />
            )}
        </>
    );
};

export default React.memo(VideoCardMenu);
