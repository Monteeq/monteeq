import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home as HomeIcon, Zap, Layout, UploadCloud, LogIn,
  Clapperboard, Trophy, TrendingUp, MessageSquare,
  Wallet, Telescope, Handshake, Crown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ── Small group label ─────────────────────────────────── */
const NavGroup = ({ label, show }) => (
  show ? <div className="nav-group-label">{label}</div> : null
);

/* ── Single nav link ───────────────────────────────────── */
const NavItem = ({ to, icon, label, onClick, accent, bold }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${bold ? ' nav-item-bold' : ''}`}
    style={accent ? { color: accent } : undefined}
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

/* ═══════════════════════════════════════════════════════ */
const Sidebar = ({ isOpen, onClose }) => {
  const { user, token } = useAuth();

  return (
    <aside className={`sidebar glass ${isOpen ? 'open' : ''}`}>
      <nav className="nav-menu">

        {/* ── DISCOVER ────────────────────────────────── */}
        <NavGroup label="Discover" show={isOpen} />
        <NavItem to="/"         icon={<HomeIcon size={24} />}  label="Home"        onClick={onClose} />
        <NavItem to="/flash"    icon={<Zap size={24} />}       label="Flash Clips" onClick={onClose} />
        <NavItem to="/posts"    icon={<Layout size={24} />}    label="Feed"        onClick={onClose} />
        <NavItem to="/challenges" icon={<Trophy size={24} />}  label="Challenges"  onClick={onClose} accent="var(--accent-primary)" />

        {/* ── CREATE ──────────────────────────────────── */}
        <NavGroup label="Create" show={isOpen} />
        <NavItem
          to="/upload"
          icon={<UploadCloud size={24} strokeWidth={2.5} />}
          label="Upload Content"
          onClick={onClose}
          accent="var(--accent-primary)"
          bold
        />
        {token && (
          <NavItem to="/manage" icon={<Clapperboard size={24} />} label="Manage Content" onClick={onClose} />
        )}

        {/* ── GROW ─────────────────────────────────────
            Only shown when logged in */}
        {token && (
          <>
            <NavGroup label="Grow" show={isOpen} />
            <NavItem to="/insights"     icon={<TrendingUp size={24} />}    label="Insights"        onClick={onClose} accent="#f59e0b" />
            <NavItem to="/achievements" icon={<Trophy size={24} />}        label="Achievements"    onClick={onClose} />
            <NavItem 
              to="/pro" 
              icon={<Crown size={24} />} 
              label="Monteeq Pro" 
              onClick={onClose} 
              accent="#ffd700"
              bold 
            />
          </>
        )}

        {/* ── SOCIAL ───────────────────────────────────
            Only shown when logged in */}
        {token && (
          <>
            <NavGroup label="Social" show={isOpen} />
            <NavItem to="/chat" icon={<MessageSquare size={24} />} label="Messages" onClick={onClose} />
          </>
        )}

        {/* ── MONTEEQ ──────────────────────────────────
            Always visible */}
        <NavGroup label="Monteeq" show={isOpen} />
        <NavItem to="/partner" icon={<Handshake size={24} />}  label="Partner With Us" onClick={onClose} />
        <NavItem to="/about"   icon={<Telescope size={24} />}  label="About"           onClick={onClose} accent="#60a5fa" />

      </nav>

      {/* ── Bottom: user info or login ─────────────── */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {token ? null : (
          <NavLink
            to="/login"
            onClick={onClose}
            className="nav-item nav-item-bold"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), #ff4b4b)',
              color: 'white', border: 'none',
              boxShadow: '0 4px 15px rgba(255,62,62,0.4)',
            }}
          >
            <LogIn size={24} strokeWidth={2.5} />
            <span>Login</span>
          </NavLink>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
