import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MoreVertical, Bookmark, BookmarkMinus, Flag, Loader2 } from 'lucide-react';
import { videoCardMenuStore } from '../stores/videoCardMenuStore';
import { useWatchLaterToggle } from '../hooks/useWatchLaterToggle';
import ReportVideoModal from './ReportVideoModal';
import s from './VideoCardMenu.module.css';

/**
 * @param {Object} props
 * @param {string|number} props.videoId
 */
const VideoCardMenu = ({ videoId }) => {
    const menuRootRef = useRef(null);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [openAbove, setOpenAbove] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);

    const { isSaved, isPending, toggle } = useWatchLaterToggle(videoId);

    const isOpen = useSyncExternalStore(
        videoCardMenuStore.subscribe,
        () => videoCardMenuStore.getOpenMenuId() === String(videoId),
        () => false
    );

    const closeMenu = useCallback(() => {
        videoCardMenuStore.closeMenu();
    }, []);

    const handleToggleMenu = useCallback((event) => {
        event.stopPropagation();
        videoCardMenuStore.toggleMenu(videoId);
    }, [videoId]);

    const handleWatchLater = useCallback(async (event) => {
        event.stopPropagation();
        await toggle();
        closeMenu();
    }, [toggle, closeMenu]);

    const handleReportClick = useCallback((event) => {
        event.stopPropagation();
        closeMenu();
        setReportOpen(true);
    }, [closeMenu]);

    const handleReportClose = useCallback(() => {
        setReportOpen(false);
        triggerRef.current?.focus();
    }, []);

    useLayoutEffect(() => {
        if (!isOpen || !dropdownRef.current || !menuRootRef.current) return;

        const dropdownRect = dropdownRef.current.getBoundingClientRect();
        const rootRect = menuRootRef.current.getBoundingClientRect();
        const overflowBottom = rootRect.bottom + dropdownRect.height + 8 > window.innerHeight;
        const overflowTop = rootRect.top - dropdownRect.height - 8 < 0;
        setOpenAbove(overflowBottom && !overflowTop);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event) => {
            if (menuRootRef.current?.contains(event.target)) return;
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
            const items = Array.from(dropdownRef.current.querySelectorAll('[role="menuitem"]:not([disabled])'));
            if (items.length === 0) return;

            const currentIndex = items.indexOf(document.activeElement);
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const next = items[(currentIndex + 1 + items.length) % items.length];
                next?.focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const prev = items[(currentIndex - 1 + items.length) % items.length];
                prev?.focus();
            } else if (event.key === 'Home') {
                event.preventDefault();
                items[0]?.focus();
            } else if (event.key === 'End') {
                event.preventDefault();
                items[items.length - 1]?.focus();
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        const focusTimer = window.setTimeout(() => {
            dropdownRef.current?.querySelector('[role="menuitem"]')?.focus();
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.clearTimeout(focusTimer);
        };
    }, [isOpen, closeMenu]);

    return (
        <>
            <div className={s.menuRoot} ref={menuRootRef} onClick={(event) => event.stopPropagation()}>
                <button
                    ref={triggerRef}
                    type="button"
                    className={s.menuTrigger}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-label="More options"
                    onClick={handleToggleMenu}
                >
                    <MoreVertical size={20} aria-hidden="true" />
                </button>

                {isOpen && (
                    <div
                        ref={dropdownRef}
                        className={`${s.dropdown} ${openAbove ? s.dropdownAbove : ''}`}
                        role="menu"
                        aria-label="Video options"
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
                    </div>
                )}
            </div>

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
