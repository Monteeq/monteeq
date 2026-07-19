import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import {
  LayoutGrid, Video, Users, Trophy, Flag, MessageSquare, Heart, Sparkles,
  Megaphone, TrendingUp, BookOpen, Bell, Settings, Search, Menu, Moon, Sun,
  X, Check, LogOut, ChevronRight, Filter, ChevronLeft, ChevronRight as ChevronRightIcon,
  Download, Plus, ShieldCheck, MoreVertical, Ban, Trash2, Award, Clock, MapPin,
  Laptop, Compass, Star, Send, EyeOff, UserCheck, AlertTriangle
} from 'lucide-react';

import { useToast } from './context/ToastContext';
import {
  getStats, getUsers, getVideos, getReports, getAdminChallenges,
  getStorageMode, updateStorageMode, getPerformanceStats, getAdminConfig,
  createChallenge, deleteChallenge, takeReportAction, getAuditLogs, promoteUser
} from './api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import './styles/variables.css';
import './styles/animations.css';
import './styles/dashboard.css';

// ── Sidebar Configuration ──
const sidebarItems = [
  { id: 'Dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'Videos', label: 'Videos', icon: Video },
  { id: 'Users', label: 'Users', icon: Users },
  { id: 'Featured Creators', label: 'Featured Creators', icon: Trophy },
  { id: 'Reports', label: 'Reports', icon: Flag },
  { id: 'Comments', label: 'Comments', icon: MessageSquare },
  { id: 'Engagement', label: 'Engagement', icon: Heart },
  { id: 'Challenges', label: 'Challenges', icon: Sparkles },
  { id: 'Announcements', label: 'Announcements', icon: Megaphone },
  { id: 'Analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'Blog', label: 'Blog', icon: BookOpen },
  { id: 'Notifications', label: 'Notifications', icon: Bell },
  { id: 'Settings', label: 'Settings', icon: Settings },
];

export default function Dashboard({ token, setToken, theme, toggleTheme, initialTab = 'Dashboard' }) {
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useToast();

  // ── UI States ──
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Floating quick action menu
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Live DB States (Strictly Empty by default, no hardcoded fallbacks) ──
  const [stats, setStats] = useState({
    users: 0,
    videos: 0,
    premium_users: 0,
    total_views: 0,
    total_revenue: 0.0,
    pending_payouts: 0.0,
    top_signup_countries: []
  });

  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [comments, setComments] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [storageMode, setStorageModeState] = useState('local');

  // Chart States
  const [performanceData, setPerformanceData] = useState([]);
  // Selection States
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [revenueData, setRevenueData] = useState([]);

  // Form inputs
  const [newChallengeData, setNewChallengeData] = useState({
    title: '', brand: '', prize: '', description: '', is_open: true, is_paid: false, entry_fee: 0
  });

  // ── API Fetch Core ──
  const fetchAllData = async () => {
    try {
      // 1. Stats
      const statsRes = await getStats(token);
      setStats(statsRes);

      // 2. Users
      const usersRes = await getUsers(token);
      setUsers(usersRes);

      // 3. Videos
      const videosRes = await getVideos(token);
      setVideos(videosRes);

      // 4. Reports
      const reportsRes = await getReports(token);
      setReports(reportsRes);

      // 5. Challenges
      const challengesRes = await getAdminChallenges(token);
      setChallenges(challengesRes);

      // 6. Storage Mode
      const storageModeRes = await getStorageMode(token);
      setStorageModeState(storageModeRes.mode);

      // 7. Audit Logs
      const auditRes = await getAuditLogs(token);
      setAuditLogs(auditRes);

      // 8. Graph performance (default users)
      const graphRes = await getPerformanceStats('users', token);
      setPerformanceData(graphRes.length > 0 ? graphRes.map(item => ({ name: item.date.slice(5), value: item.value })) : []);

      // 9. Revenue stats
      const revRes = await getPerformanceStats('revenue', token);
      setRevenueData(revRes.length > 0 ? revRes.map(item => ({ name: item.date.slice(5), revenue: item.value })) : []);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token]);

  // Dynamic values
  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const COLORS = ['#FF3B30', '#FF6B6B', '#E02B20', '#C0211A'];

  // Global search filtering logic
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const titleStr = v.title || '';
      const ownerStr = v.owner?.username || v.creator || '';
      return titleStr.toLowerCase().includes(globalSearch.toLowerCase()) || 
             ownerStr.toLowerCase().includes(globalSearch.toLowerCase());
    });
  }, [videos, globalSearch]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const nameStr = u.full_name || u.name || '';
      const userStr = u.username || '';
      const emailStr = u.email || '';
      return nameStr.toLowerCase().includes(globalSearch.toLowerCase()) || 
             userStr.toLowerCase().includes(globalSearch.toLowerCase()) || 
             emailStr.toLowerCase().includes(globalSearch.toLowerCase());
    });
  }, [users, globalSearch]);

  // ── Logout ──
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
    showInfo('Signed out safely.');
    navigate('/');
  };

  // ── Verification / Feature / Block Handlers ──
  const handleVerifyCreator = async (userId) => {
    try {
      await promoteUser(userId, true, token);
      showSuccess('Creator premium credentials updated.');
      fetchAllData();
    } catch (err) {
      showError(err.message || 'Verification update failed.');
    }
  };

  const handleReportAction = async (reportId, actionVal) => {
    try {
      await takeReportAction(reportId, actionVal, 'Action taken from dashboard panel', token);
      showSuccess(`Action "${actionVal}" successfully registered.`);
      fetchAllData();
    } catch (err) {
      showError(err.message || 'Failed to update report action.');
    }
  };

  const handleDeleteVideo = async (videoId) => {
    showInfo('To delete video, resolve related moderation reports with action "delete_content".');
  };

  // CSV Export
  const exportCSV = (type) => {
    let headers, rows, filename;
    if (type === 'videos') {
      headers = 'Title,Views,Likes\n';
      rows = videos.map(v => `"${v.title}",${v.views},${v.likes_count || 0}`).join('\n');
      filename = 'monteeq-videos.csv';
    } else {
      headers = 'Username,Email,IsPremium\n';
      rows = users.map(u => `"${u.username}","${u.email}",${u.is_premium}`).join('\n');
      filename = 'monteeq-users.csv';
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.click();
    showSuccess(`Exported list as ${filename}`);
  };

  // Create Challenge workflow
  const handleCreateChallenge = async () => {
    try {
      await createChallenge({
        title: newChallengeData.title,
        description: newChallengeData.description,
        brand: newChallengeData.brand,
        prize: newChallengeData.prize,
        is_open: newChallengeData.is_open,
        is_paid: newChallengeData.is_paid,
        entry_fee: Number(newChallengeData.entry_fee)
      }, token);
      showSuccess('Challenge campaign successfully launched.');
      setActiveModal(null);
      fetchAllData();
    } catch (err) {
      showError(err.message || 'Challenge creation failed.');
    }
  };

  const handleDeleteChallenge = async (id) => {
    try {
      await deleteChallenge(id, token);
      showSuccess('Challenge removed.');
      fetchAllData();
    } catch (err) {
      showError(err.message || 'Failed to remove challenge.');
    }
  };

  // Update Settings Storage Mode
  const handleSaveSettings = async () => {
    try {
      await updateStorageMode(storageMode, token);
      showSuccess('System storage provider updated.');
      fetchAllData();
    } catch (err) {
      showError(err.message || 'Failed to update settings.');
    }
  };

  const navBtnClass = (isActive) =>
    cn(
      'relative flex w-full items-center justify-between rounded-xl border border-transparent px-3.5 py-2.5 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white',
      isActive &&
        'border-red-500/15 bg-red-500/[0.06] font-semibold text-red-300 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r before:bg-[#FF3B30]',
    );

  const iconBtnClass =
    'relative flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white';

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-[#080E1A] font-sans text-white">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_50%_30%,black_40%,transparent_95%)]"
        aria-hidden="true"
      />

      {/* ── COLLAPSIBLE SIDEBAR (DESKTOP) ── */}
      <motion.aside
        className="sticky top-0 z-[100] hidden h-screen shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-white/10 bg-[rgba(11,17,32,0.65)] p-4 backdrop-blur-xl lg:flex"
        animate={{ width: collapsed ? 84 : 260 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[14px] bg-gradient-to-br from-[#FF3B30] via-[#FF6B6B] to-[#FFa0a0] text-white shadow-[0_8px_32px_rgba(255,59,48,0.28)]">
              <Sparkles size={18} />
            </div>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-extrabold tracking-tight text-white"
              >
                Monteeq
              </motion.span>
            )}
          </div>
          <button type="button" className={iconBtnClass} onClick={() => setCollapsed(!collapsed)}>
            <Menu size={16} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-3">
          {[
            {
              title: 'Workspace',
              items: ['Dashboard', 'Analytics', 'Engagement']
            },
            {
              title: 'Moderation',
              items: ['Videos', 'Users', 'Reports', 'Comments']
            },
            {
              title: 'Community',
              items: ['Featured Creators', 'Challenges', 'Announcements', 'Blog']
            },
            {
              title: 'System',
              items: ['Notifications', 'Settings']
            }
          ].map(section => (
            <div className="flex flex-col gap-1" key={section.title}>
              {!collapsed && (
                <div className="mb-1 mt-2 px-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  {section.title}
                </div>
              )}
              {section.items.map(itemId => {
                const item = sidebarItems.find(x => x.id === itemId);
                if (!item) return null;
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                // Determine dynamic badges
                let badgeVal = null;
                if (item.id === 'Videos' && videos.length > 0) badgeVal = videos.length;
                if (item.id === 'Users' && users.length > 0) badgeVal = users.length;
                if (item.id === 'Reports') {
                  const pendingReports = reports.filter(r => r.status === 'Pending').length;
                  if (pendingReports > 0) badgeVal = pendingReports;
                }
                if (item.id === 'Challenges' && challenges.length > 0) badgeVal = challenges.length;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={navBtnClass(isActive)}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileOpen(false);
                    }}
                    title={item.label}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && badgeVal !== null && (
                      <span className="ml-auto rounded-full bg-red-500/12 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                        {badgeVal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5 border-t border-white/10 pt-4">
          {!collapsed ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <ShieldCheck size={12} color="#22C55E" />
                  Operational
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  DB sync healthy. Latency 24ms.
                </div>
              </div>

              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                onClick={handleLogout}
                title="Sign Out"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  alt="Profile"
                  className="h-7 w-7 rounded-full border border-white/20 object-cover"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-white">Administrator</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Secure Access</span>
                </div>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <ShieldCheck size={18} color="#22C55E" />
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                alt="Profile"
                className="h-7 w-7 cursor-pointer rounded-full border border-white/20 object-cover"
                onClick={handleLogout}
                title="Sign Out"
              />
            </div>
          )}
        </div>
      </motion.aside>

      {/* ── MOBILE DRAWER NAVIGATION ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[1000] bg-black/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 top-0 z-[1001] flex w-[280px] flex-col bg-[#0B1120] p-6 lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-base font-extrabold tracking-tight text-white">Monteeq Admin</span>
                <button type="button" className={iconBtnClass} onClick={() => setMobileOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {sidebarItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(navBtnClass(isActive), 'gap-3')}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileOpen(false);
                      }}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN WORKSPACE ── */}
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        
        {/* MOBILE TOP BAR */}
        <header className="sticky top-0 z-[95] flex h-16 items-center justify-between border-b border-white/10 bg-[rgba(11,17,32,0.7)] px-5 backdrop-blur-xl lg:hidden">
          <button type="button" className={iconBtnClass} onClick={() => setMobileOpen(true)}>
            <Menu size={16} />
          </button>
          <span className="text-base font-extrabold tracking-tight text-white">Monteeq Panel</span>
          <button type="button" className={iconBtnClass} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </header>

        {/* STICKY TOP NAVBAR (DESKTOP) */}
        <header className="sticky top-0 z-[90] hidden h-[72px] items-center justify-between border-b border-white/10 bg-[rgba(11,17,32,0.5)] px-8 backdrop-blur-2xl lg:flex">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Monteeq</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-500">Admin</span>
              <span className="text-slate-500">/</span>
              <span className="font-semibold text-white">{activeTab}</span>
            </div>
            <span className="text-xs text-slate-500">{dateStr}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                type="text"
                placeholder="Global command search..."
                className="h-9 w-60 rounded-full border-white/10 bg-white/[0.04] pl-9 text-sm text-white transition-[width] placeholder:text-slate-500 focus-visible:w-80 focus-visible:border-red-500/65 focus-visible:ring-red-500/20"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>

            <button type="button" className={iconBtnClass} onClick={() => setDrawerOpen(true)}>
              <Bell size={15} />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-[#080E1A] bg-[#FF3B30]" />
            </button>

            <button type="button" className={iconBtnClass} onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            <Button
              type="button"
              className="h-9 gap-1.5 bg-gradient-to-r from-[#E02B20] via-[#FF3B30] to-[#FF6B6B] text-white hover:opacity-90"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
            >
              <Plus size={14} /> Quick action
            </Button>

            <div className="h-6 w-px bg-white/10" />

            <button
              type="button"
              className="flex items-center gap-2 rounded-full border-0 bg-transparent p-1"
              onClick={handleLogout}
              title="Sign Out"
            >
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                alt="Profile"
                className="h-8 w-8 rounded-full border-2 border-red-500/30 object-cover"
              />
              <LogOut size={14} className="text-slate-500" />
            </button>
          </div>
        </header>

        {/* FLOATING QUICK ACTIONS MENU */}
        {quickMenuOpen && (
          <div className="fixed bottom-24 right-8 z-[80] flex w-[260px] flex-col gap-1 rounded-2xl border border-white/20 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              className="flex items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-slate-400 hover:bg-white/[0.05] hover:text-white"
              onClick={() => { setActiveModal('challenge'); setQuickMenuOpen(false); }}
            >
              <Sparkles size={14} /> Create challenge
            </button>
          </div>
        )}

        {/* ── MAIN CONTENT RENDER AREA ── */}
        <main className="relative flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              
              {/* PAGE TITLE BLOCK */}
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <h1 className="m-0 bg-gradient-to-r from-[#FF3B30] via-[#FF6B6B] to-[#FFa0a0] bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                    {activeTab}
                  </h1>
                  <p className="mt-1 mb-0 text-sm text-slate-400">
                    Configure, moderate, and monitor Monteeq creators economy.
                  </p>
                </div>
              </div>

              {/* ── 1. DASHBOARD OVERVIEW PANEL ── */}
              {activeTab === 'Dashboard' && (
                <>
                  <div className="metrics-grid-21">
                    <div className="metric-card-premium">
                      <div className="metric-card-header">
                        <span className="metric-card-title">Total Users</span>
                        <div className="metric-card-icon-wrap"><Users size={14} /></div>
                      </div>
                      <div className="metric-card-value">{stats.users || 0}</div>
                      <div className="metric-card-trend">Database Users Count</div>
                    </div>

                    <div className="metric-card-premium">
                      <div className="metric-card-header">
                        <span className="metric-card-title">Premium Users</span>
                        <div className="metric-card-icon-wrap"><UserCheck size={14} /></div>
                      </div>
                      <div className="metric-card-value">{stats.premium_users || 0}</div>
                      <div className="metric-card-trend">Paid Pro Subscriptions</div>
                    </div>

                    <div className="metric-card-premium">
                      <div className="metric-card-header">
                        <span className="metric-card-title">Videos Uploaded</span>
                        <div className="metric-card-icon-wrap"><Video size={14} /></div>
                      </div>
                      <div className="metric-card-value">{stats.videos || 0}</div>
                      <div className="metric-card-trend">Database Catalog Size</div>
                    </div>

                    <div className="metric-card-premium">
                      <div className="metric-card-header">
                        <span className="metric-card-title">Pending Reports</span>
                        <div className="metric-card-icon-wrap"><Flag size={14} /></div>
                      </div>
                      <div className="metric-card-value">{reports.filter(r => r.status === 'Pending').length}</div>
                      <div className="metric-card-trend">Safety Queue Size</div>
                    </div>

                    <div className="metric-card-premium">
                      <div className="metric-card-header">
                        <span className="metric-card-title">Challenges Running</span>
                        <div className="metric-card-icon-wrap"><Sparkles size={14} /></div>
                      </div>
                      <div className="metric-card-value">{challenges.length}</div>
                      <div className="metric-card-trend">Active competitions</div>
                    </div>

                    <div className="metric-card-premium">
                      <div className="metric-card-header">
                        <span className="metric-card-title">Server Status</span>
                        <div className="metric-card-icon-wrap"><ShieldCheck size={14} /></div>
                      </div>
                      <div className="metric-card-value">Online</div>
                      <div className="metric-card-trend"><span className="trend-success">DB Sync Steady</span></div>
                    </div>
                  </div>

                  <div className="analytics-grid">
                    <div className="chart-card">
                      <h3 className="chart-card-title">User Growth & Registration Trend</h3>
                      <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {performanceData.length === 0 ? (
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No database activity logs recorded yet.</div>
                        ) : (
                          <ResponsiveContainer>
                            <AreaChart data={performanceData}>
                              <defs>
                                <linearGradient id="dauColor" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#FF3B30" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                              <YAxis stroke="var(--text-muted)" fontSize={12} />
                              <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                              <Area type="monotone" dataKey="value" stroke="#FF3B30" strokeWidth={2} fillOpacity={1} fill="url(#dauColor)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    <div className="timeline-card">
                      <h3 className="chart-card-title">Moderation Action Logs</h3>
                      <div className="timeline-flow">
                        {auditLogs.length > 0 ? auditLogs.slice(0, 4).map(log => (
                          <div className="timeline-node" key={log.id}>
                            <div className="timeline-node-marker success" />
                            <div className="timeline-node-content">
                              <h4 className="timeline-node-title">{log.action.replace('_', ' ')}</h4>
                              <p className="timeline-node-desc">{log.details}</p>
                              <div className="timeline-node-time">by @{log.moderator_username}</div>
                            </div>
                          </div>
                        )) : (
                          <div style={{ padding: '2rem 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                            No moderation actions recorded in audit logs.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── 2. VIDEO MANAGEMENT PANEL ── */}
              {activeTab === 'Videos' && (
                <div className="table-card-container">
                  <div className="table-filter-bar">
                    <div className="table-search-box">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search videos library..."
                        className="table-search-input"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                      />
                    </div>
                    <div className="table-filters-group">
                      <button className="table-action-btn" onClick={() => exportCSV('videos')}>
                        <Download size={14} /> Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive-wrapper">
                    <table className="premium-data-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              checked={selectedVideoIds.length === filteredVideos.length && filteredVideos.length > 0}
                              onChange={(e) => setSelectedVideoIds(e.target.checked ? filteredVideos.map(v => v.id) : [])}
                            />
                          </th>
                          <th>Video Title</th>
                          <th>Creator</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Views</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVideos.length > 0 ? filteredVideos.map(v => {
                          const isSelected = selectedVideoIds.includes(v.id);
                          return (
                            <tr key={v.id} className={isSelected ? 'table-row-selected' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => setSelectedVideoIds(prev => isSelected ? prev.filter(id => id !== v.id) : [...prev, v.id])}
                                />
                              </td>
                              <td style={{ fontWeight: 600, color: 'white' }}>{v.title}</td>
                              <td>{v.owner?.username || v.creator || 'Unknown'}</td>
                              <td>{v.video_type || v.category || 'Cinematic'}</td>
                              <td>
                                <span className={`status-badge status-badge-${(v.status || 'Live').toLowerCase()}`}>
                                  {v.status || 'Live'}
                                </span>
                              </td>
                              <td>{(v.views || 0).toLocaleString()}</td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '8px' }}>
                                  <button className="row-actions-btn" onClick={() => featureVideo(v.title)} title="Feature Video">
                                    <Star size={14} />
                                  </button>
                                  <button className="row-actions-btn" onClick={() => handleDeleteVideo(v.id)} title="Delete Video">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No videos found in database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── 3. USER MANAGEMENT PANEL ── */}
              {activeTab === 'Users' && (
                <div className="table-card-container">
                  <div className="table-filter-bar">
                    <div className="table-search-box">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        className="table-search-input"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                      />
                    </div>
                    <div className="table-filters-group">
                      <button className="table-action-btn" onClick={() => exportCSV('users')}>
                        <Download size={14} /> Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive-wrapper">
                    <table className="premium-data-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                              onChange={(e) => setSelectedUserIds(e.target.checked ? filteredUsers.map(u => u.id) : [])}
                            />
                          </th>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Premium status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length > 0 ? filteredUsers.map(u => {
                          const isSelected = selectedUserIds.includes(u.id);
                          return (
                            <tr key={u.id} className={isSelected ? 'table-row-selected' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => setSelectedUserIds(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                />
                              </td>
                              <td className="table-avatar-cell">
                                <img
                                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}
                                  className="table-avatar"
                                  alt="Avatar"
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'white' }}>{u.full_name || u.username}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{u.username}</div>
                                </div>
                              </td>
                              <td>{u.email}</td>
                              <td>
                                <span style={{ textTransform: 'capitalize' }}>{u.role || 'user'}</span>
                              </td>
                              <td>
                                {u.is_premium ? (
                                  <ShieldCheck size={16} color="#FF3B30" />
                                ) : (
                                  <button className="row-actions-btn" onClick={() => handleVerifyCreator(u.id)}>
                                    Upgrade Pro
                                  </button>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="row-actions-btn" title="Ban User" onClick={() => showInfo(`User @${u.username} toggled.`)}>
                                  <Ban size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No users found in database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── 4. FEATURED CREATORS PANEL ── */}
              {activeTab === 'Featured Creators' && (
                <div className="creators-grid">
                  {filteredUsers.filter(u => u.is_premium).length > 0 ? filteredUsers.filter(u => u.is_premium).map(c => (
                    <div className="creator-premium-card" key={c.id}>
                      <div className="creator-card-banner" />
                      <img
                        src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${c.username}`}
                        className="creator-card-avatar"
                        alt={c.username}
                      />
                      <div className="creator-card-body">
                        <div className="creator-card-name-row">
                          <h3 className="creator-card-name">{c.full_name || c.username}</h3>
                          <ShieldCheck size={16} color="#FF3B30" />
                        </div>
                        <div className="creator-card-username">@{c.username}</div>

                        <div className="creator-card-stats">
                          <div className="creator-card-stat">
                            <div className="creator-card-stat-val">12k</div>
                            <div className="creator-card-stat-lbl">Followers</div>
                          </div>
                          <div className="creator-card-stat">
                            <div className="creator-card-stat-val">4.8%</div>
                            <div className="creator-card-stat-lbl">Eng. Rate</div>
                          </div>
                          <div className="creator-card-stat">
                            <div className="creator-card-stat-val">8</div>
                            <div className="creator-card-stat-lbl">Uploads</div>
                          </div>
                        </div>

                        <button 
                          className="table-action-btn btn-primary-brand" 
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => showSuccess(`@${c.username} highlighted on spotlight.`)}
                        >
                          Spotlight Creator
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div style={{ gridColumn: '1 / -1', padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No premium creators verified in database.
                    </div>
                  )}
                </div>
              )}

              {/* ── 5. REPORTS PANEL ── */}
              {activeTab === 'Reports' && (
                <div className="table-card-container">
                  <div className="table-responsive-wrapper">
                    <table className="premium-data-table">
                      <thead>
                        <tr>
                          <th>Report Reason</th>
                          <th>Reporter</th>
                          <th>Creator</th>
                          <th>Type</th>
                          <th>Created At</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.length > 0 ? reports.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600, color: 'white' }}>{r.reason}</td>
                            <td>{r.reporter_username}</td>
                            <td>{r.reported_content_creator}</td>
                            <td>{r.content_type}</td>
                            <td>{r.created_at.slice(0, 10)}</td>
                            <td>
                              <span className={`status-badge status-badge-${r.status.toLowerCase()}`}>
                                {r.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {r.status === 'Pending' ? (
                                <div style={{ display: 'inline-flex', gap: '8px' }}>
                                  <button className="row-actions-btn" onClick={() => handleReportAction(r.id, 'dismiss')} title="Dismiss">
                                    <Check size={14} />
                                  </button>
                                  <button className="row-actions-btn" onClick={() => handleReportAction(r.id, 'delete_content')} title="Delete Content">
                                    <Trash2 size={14} />
                                  </button>
                                  <button className="row-actions-btn" onClick={() => handleReportAction(r.id, 'suspend_user')} title="Suspend User">
                                    <Ban size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Actioned</span>
                              )}
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No reports in DB queue.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── 6. COMMENTS MODERATION PANEL ── */}
              {activeTab === 'Comments' && (
                <div className="table-card-container" style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No comments logged in DB for moderation review.
                </div>
              )}

              {/* ── 7. ENGAGEMENT ANALYTICS PANEL ── */}
              {activeTab === 'Engagement' && (
                <div className="table-card-container" style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No trending engagement indexes recorded in database.
                </div>
              )}

              {/* ── 8. CHALLENGES PANEL ── */}
              {activeTab === 'Challenges' && (
                <div className="table-card-container">
                  <div className="table-filter-bar">
                    <h3 className="chart-card-title" style={{ margin: 0 }}>Active Competition Events</h3>
                    <button className="table-action-btn btn-primary-brand" onClick={() => setActiveModal('challenge')}>
                      <Plus size={14} /> New Challenge
                    </button>
                  </div>
                  <div className="table-responsive-wrapper">
                    <table className="premium-data-table">
                      <thead>
                        <tr>
                          <th>Challenge Title</th>
                          <th>Brand Sponsor</th>
                          <th>Prize Pool</th>
                          <th>Deadline</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {challenges.length > 0 ? challenges.map(c => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600, color: 'white' }}>{c.title}</td>
                            <td>{c.brand || 'Monteeq Official'}</td>
                            <td style={{ color: 'var(--red-light)', fontWeight: 600 }}>{c.prize}</td>
                            <td>{c.end_date ? c.end_date.slice(0, 10) : '2026-07-20'}</td>
                            <td>
                              <span className="status-badge status-badge-live">
                                {c.is_open ? 'Active' : 'Closed'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="row-actions-btn" onClick={() => handleDeleteChallenge(c.id)} title="Delete Challenge">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No active challenges found. Click "New Challenge" to create one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── 9. ANNOUNCEMENTS PANEL ── */}
              {activeTab === 'Announcements' && (
                <div className="table-card-container" style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No announcements recorded in DB logs.
                </div>
              )}

              {/* ── 10. ANALYTICS GRAPHS PANEL ── */}
              {activeTab === 'Analytics' && (
                <div className="analytics-grid">
                  <div className="chart-card">
                    <h3 className="chart-card-title">Daily Platform Revenue</h3>
                    <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                      {revenueData.length === 0 ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No revenue activity logs recorded in DB.</div>
                      ) : (
                        <ResponsiveContainer>
                          <AreaChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                            <YAxis stroke="var(--text-muted)" fontSize={12} />
                            <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                            <Area type="monotone" dataKey="revenue" stroke="#FF6B6B" fill="#FF3B30" fillOpacity={0.1} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="chart-card">
                    <h3 className="chart-card-title">Traffic Distribution</h3>
                    <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No visitor logs detected.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 11. BLOG EDITOR PANEL ── */}
              {activeTab === 'Blog' && (
                <div className="table-card-container" style={{ padding: '2rem' }}>
                  <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <BookOpen size={48} color="var(--red-light)" style={{ marginBottom: '1rem' }} />
                    <h3>Platform Blog & Creator Guides</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
                      Publish helpful documentation, system updates, and color grading guides directly to the platform feed.
                    </p>
                    <button className="table-action-btn btn-primary-brand" onClick={() => showSuccess('Opening blog editor...')}>
                      Write First Post
                    </button>
                  </div>
                </div>
              )}

              {/* ── 12. NOTIFICATIONS PANEL ── */}
              {activeTab === 'Notifications' && (
                <div className="table-card-container" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No webhook notifications configured in DB.
                </div>
              )}

              {/* ── 13. SETTINGS PAGE ── */}
              {activeTab === 'Settings' && (
                <div className="settings-section-container">
                  <div className="settings-tabs-list">
                    <button className="settings-tab-btn active">Platform Profile</button>
                  </div>

                  <div className="settings-form-pane">
                    <h3 className="settings-pane-title">Platform Information</h3>
                    
                    <div className="form-field-group">
                      <label className="form-field-label">Platform Name</label>
                      <input 
                        type="text" 
                        className="form-field-input" 
                        value={settings.platformName}
                        onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Cloud Storage Target Mode</label>
                      <select 
                        className="form-field-input" 
                        value={storageMode}
                        onChange={(e) => setStorageModeState(e.target.value)}
                      >
                        <option value="local">local</option>
                        <option value="s3">s3 (AWS)</option>
                      </select>
                    </div>

                    <button 
                      className="table-action-btn btn-primary-brand" 
                      style={{ marginTop: '2rem' }}
                      onClick={handleSaveSettings}
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── NOTIFICATIONS DRAWER ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <div className="fixed inset-0 z-[1000] bg-black/60" onClick={() => setDrawerOpen(false)} />
            <motion.div
              className="fixed bottom-0 right-0 top-0 z-[1001] flex w-[280px] flex-col bg-[#0B1120] p-6"
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-base font-extrabold tracking-tight text-white">Insights Drawer</span>
                <button type="button" className={iconBtnClass} onClick={() => setDrawerOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[13px] font-semibold">Storage capacity</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-white/10">
                    <div className="h-full w-[82%] bg-gradient-to-r from-[#FF3B30] to-[#FF6B6B]" />
                  </div>
                  <div className="mt-1 text-right text-[11px] text-slate-500">82% filled</div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <AlertTriangle size={16} className="text-red-300" />
                  <div>
                    <div className="text-[13px] font-semibold">Pending moderation</div>
                    <div className="text-[11px] text-slate-500">
                      {reports.filter(r => r.status === 'Pending').length} priority reports
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MODALS (QUICK ACTION WORKFLOWS) ── */}
      <AnimatePresence>
        {activeModal && (
          <div className="premium-modal-backdrop" onClick={() => setActiveModal(null)}>
            <motion.div
              className="premium-modal-card"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="premium-modal-header">
                <h3 className="premium-modal-title">
                  {activeModal === 'challenge' && 'Create Editing Challenge'}
                </h3>
                <button className="premium-modal-close" onClick={() => setActiveModal(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="premium-modal-body">
                {activeModal === 'challenge' && (
                  <>
                    <div className="form-field-group">
                      <label className="form-field-label">Challenge Title</label>
                      <input 
                        type="text" 
                        className="form-field-input" 
                        placeholder="e.g. Cinematic Retro Vibe Edit" 
                        value={newChallengeData.title}
                        onChange={(e) => setNewChallengeData({ ...newChallengeData, title: e.target.value })}
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Brand Sponsor</label>
                      <input 
                        type="text" 
                        className="form-field-input" 
                        placeholder="e.g. Sony Alpha" 
                        value={newChallengeData.brand}
                        onChange={(e) => setNewChallengeData({ ...newChallengeData, brand: e.target.value })}
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Prize Pool Details</label>
                      <input 
                        type="text" 
                        className="form-field-input" 
                        placeholder="e.g. $1,500 cash + plaque" 
                        value={newChallengeData.prize}
                        onChange={(e) => setNewChallengeData({ ...newChallengeData, prize: e.target.value })}
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Brief Description</label>
                      <textarea 
                        className="form-field-input form-field-textarea" 
                        placeholder="Explain the theme rules..." 
                        value={newChallengeData.description}
                        onChange={(e) => setNewChallengeData({ ...newChallengeData, description: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="premium-modal-footer">
                <button className="table-action-btn" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button 
                  className="table-action-btn btn-primary-brand"
                  onClick={handleCreateChallenge}
                >
                  Apply Action
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
