import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home as HomeIcon, Zap, UploadCloud,
  Clapperboard, Trophy, TrendingUp,
  Crown, Users, History, Clock, 
  ThumbsUp, Telescope, Handshake
} from 'lucide-react';



import { useAuth } from '../context/AuthContext';

/* ── Small group label ─────────────────────────────────── */

const NavGroup = ({ label }) => (
  <div className="nav-group-label">{label}</div>
);

/* ── Section Divider ───────────────────────────────────── */
const NavDivider = () => <div className="nav-divider" />;


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
    <aside className={`sidebar glass-morphism ${isOpen ? 'open' : ''}`}>
      <nav className="nav-menu">

        {/* ── FEED (TikTok Focus) ────────────────────────── */}
        <NavItem to="/home"     icon={<HomeIcon size={24} />}  label="For You"     onClick={onClose} />
        <NavItem to="/flash"    icon={<Zap size={24} />}       label="Flash Clips" onClick={onClose} accent="#ff3b30" />
        <NavItem to="/following" icon={<Users size={24} />}    label="Following"   onClick={onClose} />


        <NavDivider />

        {/* ── FOLLOWING (TikTok Avatars) ──────────────────── */}
        <NavGroup label="Following" />
        <div className="following-list">
          {/* Mock Avatars */}
          <div className="following-avatar-item" title="Felix">
            <div className="avatar-wrapper live">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
            </div>
            <span className="following-name">Felix</span>
          </div>
          <div className="following-avatar-item" title="Sonia_Vibe">
            <div className="avatar-wrapper">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sonia" alt="avatar" />
            </div>
            <span className="following-name">Sonia_Vibe</span>
          </div>
          <div className="following-avatar-item" title="AlexLive">
            <div className="avatar-wrapper live">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="avatar" />
            </div>
            <span className="following-name">AlexLive</span>
          </div>
        </div>

        <NavDivider />

        {/* ── DISCOVER (YouTube Focus) ───────────────────── */}
        <NavGroup label="Discover" />
        <NavItem to="/trending"   icon={<TrendingUp size={24} />} label="Trending"   onClick={onClose} />
        <NavItem to="/challenges" icon={<Trophy size={24} />}     label="Challenges" onClick={onClose} accent="var(--accent-primary)" />


        <NavDivider />

        {/* ── LIBRARY (YouTube Style) ───────────────────── */}
        <NavGroup label="Library" />
        <NavItem to="/history"    icon={<History size={24} />}    label="History"     onClick={onClose} />
        <NavItem to="/watch-later" icon={<Clock size={24} />}      label="Watch Later" onClick={onClose} />
        <NavItem to="/liked"      icon={<ThumbsUp size={24} />}    label="Liked Videos" onClick={onClose} />

        <NavDivider />

        {/* ── STUDIO / CREATE ──────────────────────────── */}
        <NavGroup label="Studio" />
        <NavItem
          to="/upload"
          icon={<UploadCloud size={24} strokeWidth={2.5} />}
          label="Create"
          onClick={onClose}
          accent="var(--accent-primary)"
          bold
        />
        {token && (
          <NavItem to="/manage" icon={<Clapperboard size={24} />} label="Manage Content" onClick={onClose} />
        )}
        {token && (
          <NavItem to="/insights" icon={<TrendingUp size={24} />} label="Analytics" onClick={onClose} accent="#f59e0b" />
        )}

        <NavDivider />

        {/* ── MONTEEQ ─────────────────────────────────── */}
        <NavGroup label="Monteeq" />
        <NavItem to="/pro" icon={<Crown size={24} />} label="Monteeq Pro" onClick={onClose} accent="#ffd700" bold />
        <NavItem to="/partner" icon={<Handshake size={24} />} label="Partner With Us" onClick={onClose} />
        <NavItem to="/about" icon={<Telescope size={24} />} label="About Monteeq" onClick={onClose} accent="#60a5fa" />


      </nav>

    </aside>

  );

};

export default Sidebar;
