'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ShieldCheck, Lock, AlertCircle, ExternalLink, RefreshCw, Flag, Trash2, Ban, ShieldAlert, ListFilter, FileText } from 'lucide-react';
const logo = '/images/logo.png';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { API_BASE_URL } from '@/lib/browserApi';

const AdminPortal = () => {
    const { user, token } = useAuth();
    const { showNotification } = useNotification();
    const router = useRouter();

    // Tab control: 'console' | 'reports' | 'audit'
    const [activeTab, setActiveTab] = useState('console');
    
    // Data states
    const [reports, setReports] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // reportId currently being modified

    // Filters
    const [filterStatus, setFilterStatus] = useState('pending');
    const [filterType, setFilterType] = useState('all');

    // Notes inputs per report
    const [notes, setNotes] = useState({});

    // Verification Logic states
    const isAuthenticated = !!token;
    const isAdmin = user?.role === 'admin';

    const fetchReports = async () => {
        if (!token) return;
        setLoading(true);
        try {
            let url = `${API_BASE_URL}/admin/reports`;
            const params = [];
            if (filterStatus !== 'all') params.push(`status=${filterStatus}`);
            if (filterType !== 'all') params.push(`content_type=${filterType}`);
            if (params.length > 0) url += `?${params.join('&')}`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setReports(data);
            } else {
                showNotification('error', 'Failed to fetch reports.');
            }
        } catch (err) {
            console.error(err);
            showNotification('error', 'Failed to fetch reports.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/admin/moderation/audit-logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAuditLogs(data);
            } else {
                showNotification('error', 'Failed to fetch audit logs.');
            }
        } catch (err) {
            console.error(err);
            showNotification('error', 'Failed to fetch audit logs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            if (activeTab === 'reports') {
                fetchReports();
            } else if (activeTab === 'audit') {
                fetchAuditLogs();
            }
        }
    }, [activeTab, filterStatus, filterType, isAdmin]);

    const handleAction = async (reportId, action) => {
        if (!token) return;
        
        const actionNotes = notes[reportId] || '';
        if ((action === 'delete_content' || action === 'suspend_user') && !actionNotes.trim()) {
            showNotification('error', 'Please provide internal moderation notes explaining this action.');
            return;
        }

        setActionLoading(reportId);
        try {
            const res = await fetch(`${API_BASE_URL}/admin/reports/${reportId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action,
                    notes: actionNotes
                })
            });

            if (res.ok) {
                showNotification('success', `Report successfully resolved with: ${action}`);
                // Refresh list
                fetchReports();
                // Clear notes for this report
                setNotes(prev => {
                    const next = { ...prev };
                    delete next[reportId];
                    return next;
                });
            } else {
                const data = await res.json();
                showNotification('error', data.detail || 'Failed to complete action.');
            }
        } catch (err) {
            console.error(err);
            showNotification('error', 'A network error occurred.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleLaunchDashboard = () => {
        window.location.href = 'https://admin.monteeq.com';
    };

    if (!isAuthenticated) {
        return (
            <div className="admin-portal-container page-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="portal-card glass" style={{ maxWidth: '500px', width: '100%', padding: '3rem 2rem', borderRadius: '32px', textAlign: 'center', border: '1px solid var(--border-glass)', background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    <div className="admin-logo-header" style={{ marginBottom: '2.5rem' }}>
                        <img src={logo} alt="Monteeq" style={{ height: '36px', width: 'auto' }} />
                    </div>
                    <div className="portal-icon-wrapper" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--text-muted)' }}>
                        <Lock size={40} />
                    </div>
                    <div className="portal-content">
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Admin Access</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
                            Please log in with your administrative credentials to continue to the management console.
                        </p>
                        <button className="hero-btn" onClick={() => router.push('/login?redirect=/admin')} style={{ width: '100%' }}>
                            Log In to Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="admin-portal-container page-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="portal-card glass" style={{ maxWidth: '500px', width: '100%', padding: '3rem 2rem', borderRadius: '32px', textAlign: 'center', border: '1px solid var(--border-glass)', background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    <div className="admin-logo-header" style={{ marginBottom: '2.5rem' }}>
                        <img src={logo} alt="Monteeq" style={{ height: '36px', width: 'auto' }} />
                    </div>
                    <div className="portal-icon-wrapper" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 62, 62, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#ff3e3e', boxShadow: '0 0 30px rgba(255, 62, 62, 0.2)' }}>
                        <AlertCircle size={40} />
                    </div>
                    <div className="portal-content">
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: '#ff3e3e' }}>Invalid Credentials</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
                            Access Denied. Your account (<strong>@{user.username}</strong>) does not have the required administrative privileges to access this portal.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="glass" onClick={() => router.push('/home')} style={{ flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer', color: 'white' }}>
                                Back to Home
                            </button>
                            <button className="hero-btn" onClick={() => router.push('/login')} style={{ flex: 1 }}>
                                Switch Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-portal-container page-container" style={{ padding: '2rem 1rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <Shield size={26} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>Security Console</h1>
                        <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>VERIFIED ADMINISTRATOR</span>
                    </div>
                </div>

                {/* Tab Menu Navigation */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border-glass)' }}>
                    <button 
                        onClick={() => setActiveTab('console')} 
                        style={{ 
                            padding: '8px 16px', 
                            borderRadius: '10px', 
                            background: activeTab === 'console' ? 'var(--accent-primary)' : 'transparent', 
                            border: 'none', 
                            color: 'white', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <ShieldAlert size={16} /> Console Redirect
                    </button>
                    <button 
                        onClick={() => setActiveTab('reports')} 
                        style={{ 
                            padding: '8px 16px', 
                            borderRadius: '10px', 
                            background: activeTab === 'reports' ? 'var(--accent-primary)' : 'transparent', 
                            border: 'none', 
                            color: 'white', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Flag size={16} /> Content Reports
                    </button>
                    <button 
                        onClick={() => setActiveTab('audit')} 
                        style={{ 
                            padding: '8px 16px', 
                            borderRadius: '10px', 
                            background: activeTab === 'audit' ? 'var(--accent-primary)' : 'transparent', 
                            border: 'none', 
                            color: 'white', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <FileText size={16} /> Audit Trail
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: CONSOLE REDIRECT */}
            {activeTab === 'console' && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem' }}>
                    <div className="portal-card glass" style={{ maxWidth: '500px', width: '100%', padding: '3rem 2rem', borderRadius: '32px', textAlign: 'center', border: '1px solid var(--border-glass)', background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div className="portal-icon-wrapper" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#10b981', boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)' }}>
                            <ShieldCheck size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '1rem' }}>Monteeq Management</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            You are logged in as admin. Click the button below to launch the advanced main site monitoring and administration system dashboard.
                        </p>
                        <button className="hero-btn" onClick={handleLaunchDashboard} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)' }}>
                            Launch Admin Console <ExternalLink size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CONTENT REPORTS */}
            {activeTab === 'reports' && (
                <div>
                    {/* Toolbar / Filters */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', borderRadius: '16px', padding: '1.2rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <ListFilter size={16} /> Filters:
                            </div>
                            
                            {/* Status filter */}
                            <select 
                                value={filterStatus} 
                                onChange={e => setFilterStatus(e.target.value)}
                                style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.4)', color: 'white', borderRadius: '8px', border: '1px solid var(--border-glass)', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="pending">Pending Review</option>
                                <option value="resolved">Resolved</option>
                                <option value="dismissed">Dismissed</option>
                                <option value="all">All Statuses</option>
                            </select>

                            {/* Content type filter */}
                            <select 
                                value={filterType} 
                                onChange={e => setFilterType(e.target.value)}
                                style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.4)', color: 'white', borderRadius: '8px', border: '1px solid var(--border-glass)', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="all">All Content Types</option>
                                <option value="video">Standard Videos</option>
                                <option value="flash">Flash Clips</option>
                                <option value="post">Posts</option>
                                <option value="comment">Comments</option>
                            </select>
                        </div>

                        <button onClick={fetchReports} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'none', border: '1px solid var(--border-glass)', borderRadius: '8px', color: 'white', cursor: 'pointer', transition: '0.2s' }}>
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>

                    {/* Reports Table/Cards list */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                            <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>Loading reported items...</p>
                        </div>
                    ) : reports.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px dotted var(--border-glass)', borderRadius: '20px' }}>
                            <Flag size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.4 }} />
                            <h3>No Reports Found</h3>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No reports match the current filter selection.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            {reports.map((report) => (
                                <div 
                                    key={report.id}
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--border-glass)',
                                        borderRadius: '16px',
                                        padding: '1.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem',
                                        transition: '0.2s',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {/* Report Header Row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                                            {/* Type Badge */}
                                            <span style={{ 
                                                fontSize: '0.75rem', 
                                                fontWeight: 800, 
                                                textTransform: 'uppercase', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                background: report.content_type === 'video' ? '#007aff' : (report.content_type === 'flash' ? '#ff2d55' : (report.content_type === 'post' ? '#ff9500' : '#ffcc00')),
                                                color: 'white'
                                            }}>
                                                {report.content_type}
                                            </span>
                                            
                                            {/* Reason Badge */}
                                            <span style={{ 
                                                fontSize: '0.75rem', 
                                                fontWeight: 800, 
                                                textTransform: 'uppercase', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                background: 'rgba(255, 59, 48, 0.1)', 
                                                color: '#ff3b30',
                                                border: '1px solid rgba(255, 59, 48, 0.2)'
                                            }}>
                                                {report.reason}
                                            </span>

                                            {/* Status Badge */}
                                            <span style={{ 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700, 
                                                textTransform: 'capitalize', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                background: report.status === 'pending' ? 'rgba(255,255,255,0.06)' : (report.status === 'dismissed' ? 'rgba(255,255,255,0.2)' : 'rgba(16, 185, 129, 0.2)'),
                                                color: report.status === 'pending' ? '#aaa' : (report.status === 'dismissed' ? '#8e8e93' : '#10b981'),
                                                border: '1px solid rgba(255,255,255,0.08)'
                                            }}>
                                                {report.status}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Reported {new Date(report.created_at).toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Report Content Body Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', mdGridTemplateColumns: '2fr 1fr', gap: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                                        {/* Left Side: Reported content details */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                Reporter: <strong style={{ color: 'white' }}>@{report.reporter_username}</strong>
                                            </div>
                                            
                                            <div style={{ fontSize: '0.95rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem', marginTop: '4px' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>
                                                    Reported Content Details
                                                </div>
                                                <div style={{ fontWeight: 700, color: 'white', fontSize: '1rem', marginBottom: '4px' }}>
                                                    Creator: @{report.reported_content_creator}
                                                </div>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                                    "{report.reported_content_preview}"
                                                </p>
                                                {report.content_type in { 'video': 1, 'flash': 1 } && (
                                                    <a 
                                                        href={`/watch/${report.content_id}`} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 700, marginTop: '8px' }}
                                                    >
                                                        Link to Content <ExternalLink size={12} />
                                                    </a>
                                                )}
                                            </div>

                                            {report.description && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>Additional description from reporter:</span>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', background: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
                                                        {report.description}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side: Decision Actions (Only visible for pending reports) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            {report.status === 'pending' ? (
                                                <>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        Take Action
                                                    </span>
                                                    
                                                    {/* Internal Notes textarea */}
                                                    <textarea 
                                                        value={notes[report.id] || ''}
                                                        onChange={e => setNotes({ ...notes, [report.id]: e.target.value })}
                                                        placeholder="Provide internal notes/rationale for this moderation action (Required for Deletions/Suspensions)..."
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '80px',
                                                            background: 'rgba(0,0,0,0.5)',
                                                            border: '1px solid var(--border-glass)',
                                                            borderRadius: '8px',
                                                            color: 'white',
                                                            padding: '8px 12px',
                                                            fontSize: '0.85rem',
                                                            outline: 'none',
                                                            resize: 'none'
                                                        }}
                                                    />

                                                    {/* Action Buttons Row */}
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                                        <button 
                                                            disabled={actionLoading === report.id}
                                                            onClick={() => handleAction(report.id, 'dismiss')}
                                                            style={{ flex: 1, padding: '8px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'transparent', color: 'white', cursor: 'pointer' }}
                                                        >
                                                            Dismiss
                                                        </button>
                                                        <button 
                                                            disabled={actionLoading === report.id}
                                                            onClick={() => handleAction(report.id, 'delete_content')}
                                                            style={{ flex: 1, padding: '8px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: 'none', background: '#ff3b30', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                                            title="Deletes the content and resolves this report"
                                                        >
                                                            <Trash2 size={12} /> Delete
                                                        </button>
                                                        <button 
                                                            disabled={actionLoading === report.id}
                                                            onClick={() => handleAction(report.id, 'suspend_user')}
                                                            style={{ flex: 1, padding: '8px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: 'none', background: '#e00000', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                                            title="Suspends the creator's account and resolves this report"
                                                        >
                                                            <Ban size={12} /> Suspend
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>MODERATION RATIONALE:</div>
                                                    <div style={{ color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                                                        {report.notes || 'No action notes entered.'}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                                        Resolved by: @{report.resolver_username || 'System'} {report.resolved_at && `on ${new Date(report.resolved_at).toLocaleString()}`}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: AUDIT TRAIL */}
            {activeTab === 'audit' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Showing recent moderation actions logged in compliance audit trail.
                        </div>
                        <button onClick={fetchAuditLogs} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'none', border: '1px solid var(--border-glass)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                            <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>Loading audit logs...</p>
                        </div>
                    ) : auditLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px dotted var(--border-glass)', borderRadius: '20px' }}>
                            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.4 }} />
                            <h3>No Logs Logged</h3>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>The moderation audit log is currently empty.</p>
                        </div>
                    ) : (
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '16px', overflow: 'hidden' }}>
                            {/* Desktop Log Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontWeight: 800 }}>
                                        <th style={{ padding: '1rem' }}>Timestamp</th>
                                        <th style={{ padding: '1rem' }}>Moderator</th>
                                        <th style={{ padding: '1rem' }}>Action</th>
                                        <th style={{ padding: '1rem' }}>Target</th>
                                        <th style={{ padding: '1rem' }}>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map((log) => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: '0.2s', cursor: 'default' }}>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 700, color: 'white' }}>
                                                @{log.moderator_username}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ 
                                                    padding: '3px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 800, 
                                                    background: log.action.includes('delete') || log.action.includes('suspend') ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255,255,255,0.06)',
                                                    color: log.action.includes('delete') || log.action.includes('suspend') ? '#ff3b30' : '#aaa'
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                                <span style={{ textTransform: 'capitalize' }}>{log.target_type}</span> ({log.target_id})
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-secondary)', maxWidth: '400px', wordBreak: 'break-word' }}>
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminPortal;
