import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home as HomeIcon, Zap, Layout, UploadCloud, LogIn, Clapperboard, Trophy, TrendingUp, MessageSquare, Wallet, Telescope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, token } = useAuth();

    return (
        <aside className={`sidebar glass ${isOpen ? 'open' : ''}`}>
            <nav className="nav-menu">
                <NavLink to="/" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <HomeIcon size={20} />
                    <span>Home</span>
                </NavLink>
                <NavLink to="/flash" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Zap size={20} />
                    <span>Flash Clips</span>
                </NavLink>
                <NavLink to="/posts" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Layout size={20} />
                    <span>Feed</span>
                </NavLink>
                <NavLink to="/challenges" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Trophy size={20} color="var(--accent-primary)" />
                    <span>Challenges</span>
                </NavLink>
                <NavLink to="/about" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Telescope size={20} color="#60a5fa" />
                    <span>About</span>
                </NavLink>

                {token && (
                    <NavLink to="/manage" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Clapperboard size={20} />
                        <span>Manage Content</span>
                    </NavLink>
                )}
                {token && (
                    <NavLink to="/achievements" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Trophy size={20} />
                        <span>Achievements</span>
                    </NavLink>
                )}
                {token && (
                    <NavLink to="/insights" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <TrendingUp size={20} color="#f59e0b" />
                        <span>Insights</span>
                    </NavLink>
                )}
                {token && (
                    <NavLink to="/monetization" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Wallet size={20} color="#eab308" />
                        <span>Monetization</span>
                    </NavLink>
                )}
                {token && (
                    <NavLink to="/chat" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <MessageSquare size={20} />
                        <span>Messages</span>
                    </NavLink>
                )}
                <NavLink to="/upload" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{
                    color: 'var(--accent-primary)',
                    fontWeight: 'bold', transition: 'all 0.3s ease'
                }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                   onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <UploadCloud size={20} strokeWidth={2.5} />
                    <span>Upload Content</span>
                </NavLink>
            </nav>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {token ? (
                    <>
                        <div className="user-info">
                            <div className="user-role">{user?.role || 'User'}</div>
                            <div className="user-name">{user?.username}</div>
                        </div>
                    </>
                ) : (
                    <NavLink to="/login" onClick={onClose} className="nav-item" style={{
                        background: 'linear-gradient(135deg, var(--accent-primary), #ff4b4b)',
                        color: 'white', fontWeight: 'bold', border: 'none',
                        boxShadow: '0 4px 15px rgba(255, 62, 62, 0.4)', transition: 'all 0.3s ease'
                    }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                       onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        <LogIn size={20} strokeWidth={2.5} />
                        <span>Login</span>
                    </NavLink>
                )}
            </div>

        </aside>
    );
};

export default Sidebar;
