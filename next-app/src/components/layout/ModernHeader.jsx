"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Zap, Menu, Search, Bell, Plus, User,
    Settings, LogOut, X, ArrowLeft, History, TrendingUp,
    ChevronRight, Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSearchSuggestions, getTrendingSuggestions } from '@/lib/clientApi';
import s from '@/styles/components/ModernHeader.module.css';


const ModernHeader = ({ onMenuToggle, isMenuOpen }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [trending, setTrending] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchHistory, setSearchHistory] = useState([]);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const dropdownRef = useRef(null);
    const profileRef = useRef(null);
    const { token, user, logout } = useAuth();
    const { unreadCount } = useNotification();
    const router = useRouter();

    const prefetchHome = () => {};

    const prefetchNotifications = () => {};


    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('monteeq_search_history') || '[]');
        setSearchHistory(history);

        // Load trending only when search is focused
        // Will be called in onFocus of search bar
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                // If drawer is open, we handle closing via overlay
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length > 1) {
                try {
                    const data = await getSearchSuggestions(searchQuery);
                    setSuggestions(Array.isArray(data) ? data : []);
                    setShowSuggestions(true);
                } catch (err) {
                    setSuggestions([]);
                }
            } else {
                setSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        setHighlightedIndex(-1);
    }, [suggestions]);

    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) {
            if (e.key === 'Enter') {
                handleSearch(searchQuery);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                    handleSearch(suggestions[highlightedIndex].query || suggestions[highlightedIndex]);
                } else {
                    handleSearch(searchQuery);
                }
                setHighlightedIndex(-1);
                break;
            case 'Escape':
                setShowSuggestions(false);
                setHighlightedIndex(-1);
                break;
            default:
                break;
        }
    };

    const handleSearch = (q) => {
        const query = (typeof q === 'string' ? q : searchQuery).trim();
        if (query) {
            saveSearch(query);
            if (query.startsWith('@')) {
                router.push(`/profile/${query.replace('@', '')}`);
            } else {
                router.push(`/search?q=${encodeURIComponent(query)}`);
            }
            setShowSuggestions(false);
            setIsSearchExpanded(false);
        }
    };

    const saveSearch = (query) => {
        if (!query || query.startsWith('@')) return;
        const history = JSON.parse(localStorage.getItem('monteeq_search_history') || '[]');
        const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 5);
        localStorage.setItem('monteeq_search_history', JSON.stringify(newHistory));
        setSearchHistory(newHistory);
    };

    const closeDrawer = () => setShowProfileMenu(false);

    return (
        <header className={s.header}>
            <div className={`${s.navSection} ${s.sectionLeft}`}>
                <button className={s.menuBtn} onClick={onMenuToggle}>
                    <Menu size={26} />
                </button>
                <div className={s.logo} onClick={() => router.push('/home')} onMouseEnter={prefetchHome}>

                    <img src="/images/logo.png" alt="Monteeq" className={s.logoImg} />
                    <span className={s.brandName}>MONTEEQ</span>
                </div>
            </div>

            <div className={`${s.navSection} ${s.sectionCenter} ${isSearchExpanded ? s.searchVisible : ''}`}>
                <div className={s.searchWrapper} ref={dropdownRef}>
                    {isSearchExpanded && (
                        <button className={s.backBtn} onClick={() => setIsSearchExpanded(false)}>
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div className={s.searchBar}>
                        <Search size={18} className={s.searchIcon} />
                        <input
                            id="header-search-input"
                            name="search"
                            type="text"
                            placeholder="Videos, users, tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={async () => {
                                setShowSuggestions(true);
                                if (trending.length === 0) {
                                    try {
                                        const data = await getTrendingSuggestions();
                                        setTrending(Array.isArray(data) ? data : []);
                                    } catch (err) {}
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            aria-autocomplete="list"
                            aria-expanded={showSuggestions}
                            aria-activedescendant={highlightedIndex >= 0 ? `suggestion-${highlightedIndex}` : undefined}
                        />
                        {searchQuery && (
                            <button className={s.clearBtn} onClick={() => setSearchQuery('')}>
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {showSuggestions && (
                        <div className={s.suggestionDropdown}>
                            {searchQuery.trim() === '' ? (
                                <>
                                    {searchHistory.length > 0 && <label>Recent</label>}
                                    {searchHistory.map((h, i) => (
                                        <div key={i} className={s.suggestionItem} onClick={() => handleSearch(h)}>
                                            <History size={16} /> <span>{h}</span>
                                        </div>
                                    ))}
                                    {trending.length > 0 && <label>Trending</label>}
                                    {trending.slice(0, 5).map((t, i) => (
                                        <div key={i} className={s.suggestionItem} onClick={() => handleSearch(t)}>
                                            <TrendingUp size={16} /> <span>{t}</span>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                suggestions.map((sug, i) => (
                                    <div
                                        key={i}
                                        id={`suggestion-${i}`}
                                        role="option"
                                        aria-selected={highlightedIndex === i}
                                        className={s.suggestionItem}
                                        onClick={() => handleSearch(sug)}
                                        style={{
                                            background: highlightedIndex === i
                                                ? 'rgba(255, 255, 255, 0.08)'
                                                : 'transparent',
                                            borderRadius: '8px',
                                        }}
                                        onMouseEnter={() => setHighlightedIndex(i)}
                                        onMouseLeave={() => setHighlightedIndex(-1)}
                                    >
                                        <Search size={16} /> <span>{sug}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={`${s.navSection} ${s.sectionRight}`}>
                <button className={s.mobileOnlySearch} onClick={() => setIsSearchExpanded(true)}>
                    <Search size={26} />
                </button>

                {token && (
                    <button className={s.uploadBtn} onClick={() => router.push('/upload')}>
                        <Plus size={26} />
                        <span>Upload</span>
                    </button>
                )}

                <div className={s.actionGroup}>
                    <button className={s.actionBtn} onClick={() => router.push('/notifications')} onMouseEnter={prefetchNotifications}>

                        <Bell size={26} />
                        {unreadCount > 0 && <span className={s.dashBadge} title={`${unreadCount} unread`} />}
                    </button>

                    <div className={s.profileMenu} ref={profileRef}>
                        {token ? (
                            <button className={s.avatarLink} onClick={() => setShowProfileMenu(true)}>
                                {user?.profile_pic ? (
                                    <img src={user.profile_pic} alt="" />
                                ) : (
                                    <div className={s.fallbackAvatar}>{user?.username?.charAt(0).toUpperCase() || 'U'}</div>
                                )}
                            </button>
                        ) : (
                            <Link href="/login" className={s.signInBtn}>
                                <User size={20} />
                                <span>Sign In</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Premium Profile Drawer - CSS transitions replacing Framer Motion */}
            {showProfileMenu && (
                <>
                    <div
                        className={`${s.drawerOverlay} ${showProfileMenu ? s.active : ''}`}
                        onClick={closeDrawer}
                    />
                    <div className={`${s.profileDrawer} ${showProfileMenu ? s.active : ''}`}>
                        <div className={s.drawerHeader}>
                            <h2>Account</h2>
                            <button onClick={closeDrawer} className={s.closeBtn}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className={s.drawerHero}>
                            <div className={s.heroAvatar}>
                                {user?.profile_pic ? (
                                    <img src={user.profile_pic} alt="" />
                                ) : (
                                    <div className={s.fallbackAvatarLarge}>{user?.username?.charAt(0).toUpperCase()}</div>
                                )}
                            </div>
                            <div className={s.heroInfo}>
                                <h3>{user?.full_name || user?.username}</h3>
                                <p>@{user?.username}</p>
                                {user?.is_premium && (
                                    <div className={s.proBadge}>
                                        <Sparkles size={12} /> PRO
                                    </div>
                                )}
                            </div>
                        </div>

                        <nav className={s.drawerNav}>
                            <button className={s.navItem} onClick={() => { closeDrawer(); router.push(`/profile/${user?.username}`); }}>
                                <div className={s.navIcon}><User size={20} /></div>
                                <span>My Profile</span>
                                <ChevronRight size={18} className={s.chevron} />
                            </button>
                            <button className={s.navItem} onClick={() => { closeDrawer(); router.push('/settings'); }}>
                                <div className={s.navIcon}><Settings size={20} /></div>
                                <span>Settings</span>
                                <ChevronRight size={18} className={s.chevron} />
                            </button>

                            <div className={s.navDivider} />

                            <button className={`${s.navItem} ${s.logoutBtn}`} onClick={() => { closeDrawer(); logout(); router.push('/login'); }}>
                                <div className={s.navIcon}><LogOut size={20} /></div>
                                <span>Sign Out</span>
                            </button>
                        </nav>

                        <div className={s.drawerFooter}>
                            <div className={s.footerLogo}>
                                <img src="/images/logo.png" alt="" className={s.footerLogoImg} />
                                <span>Monteeq v2.0</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </header>
    );
};

export default ModernHeader;
