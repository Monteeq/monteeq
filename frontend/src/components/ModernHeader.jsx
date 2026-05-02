import React, { useState, useEffect, useRef } from 'react';
import {
    Zap, Menu, Search, Bell, Plus, User,
    Settings, LogOut, X, ArrowLeft, History, TrendingUp,
    ChevronRight, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useNavigate, Link } from 'react-router-dom';
import { getSearchSuggestions, getTrendingSuggestions } from '../api';
import logo from '../assets/images/logo.png';
import s from './ModernHeader.module.css';

const ModernHeader = ({ onMenuToggle, isMenuOpen }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [trending, setTrending] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchHistory, setSearchHistory] = useState([]);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    const dropdownRef = useRef(null);
    const profileRef = useRef(null);
    const { token, user, logout } = useAuth();
    const { unreadCount } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('monteeq_search_history') || '[]');
        setSearchHistory(history);

        const loadTrending = async () => {
            try {
                const data = await getTrendingSuggestions();
                setTrending(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Trending error:", err);
            }
        };
        loadTrending();

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

    const handleSearch = (q) => {
        const query = (typeof q === 'string' ? q : searchQuery).trim();
        if (query) {
            saveSearch(query);
            if (query.startsWith('@')) {
                navigate(`/profile/${query.replace('@', '')}`);
            } else {
                navigate(`/search?q=${encodeURIComponent(query)}`);
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
                    <Menu size={24} />
                </button>
                <div className={s.logo} onClick={() => navigate('/')}>
                    <img src={logo} alt="Monteeq" className={s.logoImg} />
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
                            type="text"
                            placeholder="Videos, users, tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setShowSuggestions(true)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
                                    <div key={i} className={s.suggestionItem} onClick={() => handleSearch(sug)}>
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
                    <Search size={22} />
                </button>

                {token && (
                    <button className={s.uploadBtn} onClick={() => navigate('/upload')}>
                        <Plus size={20} />
                        <span>Upload</span>
                    </button>
                )}

                <div className={s.actionGroup}>
                    <button className={s.actionBtn} onClick={() => navigate('/notifications')}>
                        <Bell size={22} />
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
                            <Link to="/login" className={s.signInBtn}>
                                <User size={20} />
                                <span>Sign In</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Premium Profile Drawer */}
            <AnimatePresence>
                {showProfileMenu && (
                    <>
                        <motion.div
                            className={s.drawerOverlay}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeDrawer}
                        />
                        <motion.div
                            className={s.profileDrawer}
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
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
                                <button className={s.navItem} onClick={() => { closeDrawer(); navigate(`/profile/${user?.username}`); }}>
                                    <div className={s.navIcon}><User size={20} /></div>
                                    <span>My Profile</span>
                                    <ChevronRight size={18} className={s.chevron} />
                                </button>
                                <button className={s.navItem} onClick={() => { closeDrawer(); navigate('/settings'); }}>
                                    <div className={s.navIcon}><Settings size={20} /></div>
                                    <span>Settings</span>
                                    <ChevronRight size={18} className={s.chevron} />
                                </button>

                                <div className={s.navDivider} />

                                <button className={`${s.navItem} ${s.logoutBtn}`} onClick={() => { closeDrawer(); logout(); navigate('/login'); }}>
                                    <div className={s.navIcon}><LogOut size={20} /></div>
                                    <span>Sign Out</span>
                                </button>
                            </nav>

                            <div className={s.drawerFooter}>
                                <div className={s.footerLogo}>
                                    <img src={logo} alt="" className={s.footerLogoImg} />
                                    <span>Monteeq v2.0</span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
};

export default ModernHeader;
