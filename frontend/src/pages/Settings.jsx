import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Settings as AccountIcon,
    Award,
    CreditCard,
    Bell,
    Shield,
    Save,
    Check,
    AlertCircle,
    Camera,
    ChevronRight, ChevronLeft,
    Globe,
    ExternalLink,
    Copy,
    Key,
    Loader2,
    Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';
import { API_BASE_URL, linkGoogleAccount } from '../api';
import DashboardBannerAd from '../components/ads/DashboardBannerAd';
import { useGoogleLogin } from '@react-oauth/google';
import { useLocation } from 'react-router-dom';

const Settings = () => {
    const { user, token, updateAuthToken, setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { showNotification } = useNotification();

    // Deep link support via query params (e.g., ?tab=payments)
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'profile';

    const [activeTab, setActiveTab] = useState(initialTab);
    const [isMobileDetail, setIsMobileDetail] = useState(!!queryParams.get('tab'));
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const [formData, setFormData] = useState({
        username: '',
        full_name: '',
        bio: '',
        show_wins: true,
        show_trophies: true,
        two_factor_enabled: false,
        interests: '',
        goals: '',
        referral_source: ''
    });

    const [insights, setInsights] = useState(null);
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [isPasswordExpanded, setIsPasswordExpanded] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [qrCodeData, setQrCodeData] = useState(null);
    const [totpCode, setTotpCode] = useState('');
    const [twoFactorLoading, setTwoFactorLoading] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [confirmDeleteText, setConfirmDeleteText] = useState('');
    const [copied, setCopied] = useState(false);
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [recoveryCodeCount, setRecoveryCodeCount] = useState(0);
    const [generatingRecovery, setGeneratingRecovery] = useState(false);

    const [avatarPreview, setAvatarPreview] = useState(null);
    const [googleLinking, setGoogleLinking] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                full_name: user.full_name || '',
                bio: user.bio || '',
                show_wins: user.show_wins ?? true,
                show_trophies: user.show_trophies ?? true,
                two_factor_enabled: user.two_factor_enabled ?? false,
                interests: user.interests || '',
                goals: user.goals || '',
                referral_source: user.referral_source || '',
                // Notification preferences — read from user so toggles reflect saved state
                notif_new_follower: user.notif_new_follower ?? true,
                notif_likes: user.notif_likes ?? false,
                notif_comments: user.notif_comments ?? true,
                notif_challenge_win: user.notif_challenge_win ?? true,
                email_weekly: user.email_weekly ?? true,
                email_challenges: user.email_challenges ?? true,
                email_payouts: user.email_payouts ?? true,
                email_marketing: user.email_marketing ?? false,
            });
            setAvatarPreview(user.profile_pic);
        }
    }, [user]);

    useEffect(() => {
        const fetchInsights = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/users/me/insights`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setInsights(res.data);
            } catch (err) {
                console.error("Failed to fetch insights", err);
            }
        };
        if (token) fetchInsights();
    }, [token]);

    useEffect(() => {
        const fetchSessions = async () => {
            setSessionsLoading(true);
            try {
                const res = await axios.get(`${API_BASE_URL}/users/me/sessions`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSessions(res.data);
            } catch (err) {
                console.error("Failed to fetch sessions", err);
            } finally {
                setSessionsLoading(false);
            }
        };
        if (token && activeTab === 'security') fetchSessions();
    }, [token, activeTab]);

    useEffect(() => {
        const fetchRecoveryStatus = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/users/me/2fa/recovery-codes-status`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRecoveryCodeCount(res.data.count);
            } catch (err) {
                console.error("Failed to fetch recovery status", err);
            }
        };
        if (token && activeTab === 'security') fetchRecoveryStatus();
    }, [token, activeTab]);

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setHasChanges(true);
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAvatarPreview(URL.createObjectURL(file));
        const uploadData = new FormData();
        uploadData.append('file', file);

        setUploadingAvatar(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/users/upload-avatar`, uploadData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setUser(prev => ({ ...prev, profile_pic: res.data.profile_pic }));
            showNotification('success', 'Avatar updated successfully');
        } catch (err) {
            showNotification('error', err?.message || 'Failed to upload avatar');
            setAvatarPreview(user.profile_pic);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await axios.put(`${API_BASE_URL}/users/me`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const { user: updatedUser, access_token } = res.data;
            if (access_token) updateAuthToken(access_token);
            setUser(updatedUser);
            setHasChanges(false);
            showNotification('success', 'All changes saved successfully');
        } catch (err) {
            showNotification('error', err.response?.data?.detail || 'Failed to update settings');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSave = async (e) => {
        let err;
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            showNotification('error', err?.message || 'New passwords do not match');
            return;
        }

        setPasswordLoading(true);
        try {
            await axios.put(`${API_BASE_URL}/users/me/password`, {
                current_password: passwordData.current_password,
                new_password: passwordData.new_password
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showNotification('success', 'Password updated successfully');
            setIsPasswordExpanded(false);
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            showNotification('error', err.response?.data?.detail || 'Failed to update password');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleSetup2FA = async () => {
        setTwoFactorLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/users/me/2fa/setup`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQrCodeData(res.data);
            setShow2FAModal(true);
        } catch (err) {
            showNotification('error', err?.message || 'Failed to initialize 2FA setup');
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handleVerify2FA = async () => {
        if (totpCode.length !== 6) return;
        setTwoFactorLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/users/me/2fa/verify`, { code: totpCode }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prev => ({ ...prev, two_factor_enabled: true }));
            setFormData(prev => ({ ...prev, two_factor_enabled: true }));
            showNotification('success', 'Shield Active: TOTP 2FA enabled');
            setShow2FAModal(false);
        } catch (err) {
            showNotification('error', err?.message || 'Invalid verification code');
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handleDisable2FA = async () => {
        setTwoFactorLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/users/me/2fa/disable`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prev => ({ ...prev, two_factor_enabled: false }));
            setFormData(prev => ({ ...prev, two_factor_enabled: false }));
            showNotification('info', '2FA has been disabled');
        } catch (err) {
            showNotification('error', err?.message || 'Failed to disable 2FA');
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handleGenerateRecoveryCodes = async () => {
        setGeneratingRecovery(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/users/me/2fa/recovery-codes`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRecoveryCodes(res.data);
            setRecoveryCodeCount(res.data.length);
            setShowRecoveryModal(true);
            showNotification('success', 'Recovery codes generated');
        } catch (err) {
            showNotification('error', err?.message || 'Failed to generate recovery codes');
        } finally {
            setGeneratingRecovery(false);
        }
    };

    const downloadRecoveryCodes = () => {
        const content = `MONTEEQ RECOVERY CODES\n\nStore these codes in a safe place. Each code is one-time use.\n\n${recoveryCodes.join('\n')}\n\nGenerated on: ${new Date().toLocaleString()}`;
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `monteeq-recovery-codes-${user.username}.txt`;
        document.body.appendChild(element);
        element.click();
    };

    const handleRevokeSession = async (sessionId) => {
        try {
            await axios.delete(`${API_BASE_URL}/users/me/sessions/${sessionId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            showNotification('success', 'Session revoked successfully');
        } catch (err) {
            showNotification('error', err?.message || 'Failed to revoke session');
        }
    };

    const handleDeactivateAccount = async () => {
        try {
            await axios.post(`${API_BASE_URL}/users/me/deactivate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showNotification('info', 'Account deactivated. Logging out...');
            setTimeout(() => window.location.href = '/', 2000);
        } catch (err) {
            showNotification('error', err?.message || 'Deactivation failed');
        }
    };

    const handleDeleteAccount = async () => {
        if (confirmDeleteText !== 'DELETE') return;
        try {
            await axios.delete(`${API_BASE_URL}/users/me/delete`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showNotification('info', 'Account deleted forever. Goodbye.');
            setTimeout(() => window.location.href = '/', 2000);
        } catch (err) {
            showNotification('error', err?.message || 'Deletion failed');
        }
    };

    const handleCopyKey = () => {
        if (!qrCodeData?.secret) return;
        navigator.clipboard.writeText(qrCodeData.secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showNotification('success', 'Secret key copied to clipboard');
    };

    const handleGoogleLink = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setGoogleLinking(true);
            try {
                const linkRes = await linkGoogleAccount(tokenResponse.access_token, token);
                if (linkRes.google_id) {
                    setUser(linkRes);
                    showNotification('success', 'Google Account linked successfully');
                }
            } catch (err) {
                const detail = err?.response?.data?.detail;
                if (detail && detail.includes('already linked')) {
                    showNotification('error', 'This Google account is already linked to another Monteeq profile. Please use a different Google account.');
                } else {
                    showNotification('error', detail || 'Failed to link Google account');
                }
            } finally {
                setGoogleLinking(false);
            }
        },
        scope: 'email profile',
    });

    const SidebarItem = ({ id, icon: Icon, label }) => (
        <div
            className={`settings-sidebar-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => {
                setActiveTab(id);
                setIsMobileDetail(true);
                const newUrl = `${window.location.pathname}?tab=${id}`;
                window.history.replaceState({ ...window.history.state, path: newUrl }, '', newUrl);
            }}
        >
            <Icon size={20} />
            <span>{label}</span>
            <ChevronRight size={16} className="mobile-chevron" />
        </div>
    );

    const ToggleSwitch = ({ name, label, checked, onChange }) => (
        <div className="toggle-wrapper">
            <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
            <label className="toggle-switch">
                <input
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={onChange}
                />
                <span className="toggle-slider"></span>
            </label>
        </div>
    );

    return (
        <div className={`settings-wrapper ${isMobileDetail ? 'detail-mode' : 'menu-mode'}`}>
            <aside className="settings-sidebar">
                <h2 style={{ padding: '0 1.6rem 1.5rem', fontSize: '1.8rem', fontWeight: 900 }}>Settings</h2>
                <SidebarItem id="profile" icon={User} label="Profile" />
                <SidebarItem id="account" icon={AccountIcon} label="Account" />
                <SidebarItem id="notifications" icon={Bell} label="Notifications" />
                <SidebarItem id="security" icon={Shield} label="Security" />
            </aside>

            <main className="settings-content">
                <button className="mobile-back-btn" onClick={() => setIsMobileDetail(false)}>
                    <ChevronLeft size={20} /> <span style={{ marginLeft: '0.4rem', fontWeight: '800' }}>Back to Settings</span>
                </button>

                {activeTab === 'profile' && (
                    <section className="settings-card">
                        <div className="settings-card-title">
                            <User size={24} color="var(--accent-primary)" />
                            Profile Details
                        </div>

                        <div style={{ display: 'flex', gap: '3rem', alignItems: 'center', marginBottom: '3rem' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: '120px', height: '120px', borderRadius: '50%',
                                    border: '3px solid var(--accent-primary)', padding: '4px',
                                    background: 'var(--bg-deep)'
                                }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#222' }}>
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 800 }}>
                                                {formData.username?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <label htmlFor="avatar-sub" style={{
                                    position: 'absolute', bottom: '0', right: '0',
                                    background: 'var(--accent-primary)', padding: '8px', borderRadius: '50%',
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Camera size={16} color="white" />
                                    <input type="file" id="avatar-sub" hidden onChange={handleAvatarChange} />
                                </label>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.4rem' }}>{formData.full_name || 'Your Name'}</h3>
                                <p style={{ color: 'var(--text-muted)' }}>Update your profile picture and public bio</p>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Full Name</label>
                            <input className="settings-input" name="full_name" value={formData.full_name} onChange={handleFormChange} placeholder="Display name" />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Username</label>
                            <input className="settings-input" name="username" value={formData.username} onChange={handleFormChange} placeholder="Unique handle" />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Public Bio</label>
                            <textarea className="settings-input" style={{resize: 'none'}} name="bio" value={formData.bio} onChange={handleFormChange} rows="3" placeholder="Briefly describe your style..." />
                        </div>
                    </section>
                )}

                {activeTab === 'account' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <section className="settings-group-box premium">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                <div>
                                    <h3 className="settings-card-title" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                        <Award size={20} color="var(--accent-primary)" style={{ marginRight: '0.8rem' }} />
                                        Platform Usage {user?.is_premium && <span className="user-badge-mini" style={{ marginLeft: '1rem' }}>PREMIUM</span>}
                                    </h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monitor your upload quotas and creative impact</p>
                                </div>
                            </div>
                            <div className="setting-tile">
                                <div className="setting-tile-label">
                                    <div className="setting-tile-title">Upload Quotas & Usage</div>
                                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                        <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>{user?.home_uploads || 0}</span> / {user?.home_quota_limit} Home Videos</div>
                                        <div style={{ fontSize: '0.85rem' }}><span style={{ color: '#f59e0b', fontWeight: 800 }}>{user?.flash_uploads || 0}</span> / {user?.flash_quota_limit} Flash Clips</div>
                                    </div>
                                </div>
                                <div className="setting-tile-action">
                                    <button className="tile-btn-minimal" onClick={() => navigate('/manage')}>View All</button>
                                </div>
                            </div>
                        </section>

                        <section className="settings-group-box">
                            <h3 className="settings-card-title" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                                <Globe size={20} color="var(--accent-primary)" style={{ marginRight: '0.8rem' }} />
                                Connected Identity
                            </h3>
                            <div className="setting-tile">
                                <div className="setting-tile-label">
                                    <div className="setting-tile-title">Google Account</div>
                                    <div className="setting-tile-desc">
                                        {user?.google_id ? 'Linked for automatic Chat Sync' : 'Link to enable secure cloud backups'}
                                    </div>
                                </div>
                                <div className="setting-tile-action">
                                    {user?.google_id ? (
                                        <span className="status-badge-hero">CONNECTED</span>
                                    ) : (
                                        <button
                                            className="save-btn"
                                            onClick={() => handleGoogleLink()}
                                            disabled={googleLinking}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.4rem' }}
                                        >
                                            {googleLinking ? (
                                                <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                                            ) : 'Connect'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <section className="settings-group-box">
                            <h3 className="settings-card-title" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                                <Shield size={20} color="var(--accent-primary)" style={{ marginRight: '0.8rem' }} />
                                Login & Access
                            </h3>
                            <div className="setting-tile-expanded" style={{ padding: '1rem 0' }}>
                                <div className="setting-tile" style={{ border: 'none', padding: 0 }}>
                                    <div className="setting-tile-label">
                                        <div className="setting-tile-title">Password</div>
                                        <div className="setting-tile-desc">Maintain your account security</div>
                                    </div>
                                    <div className="setting-tile-action">
                                        <button className="tile-btn-minimal" onClick={() => setIsPasswordExpanded(!isPasswordExpanded)}>
                                            {isPasswordExpanded ? 'Hide' : 'Update'}
                                        </button>
                                    </div>
                                </div>

                                {isPasswordExpanded && (
                                    <div className="settings-card" style={{ marginTop: '1.5rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                            <div className="form-group">
                                                <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Current Password</label>
                                                <input type="password" className="settings-input" value={passwordData.current_password} onChange={e => setPasswordData({ ...passwordData, current_password: e.target.value })} required />
                                            </div>
                                            <div style={{ visibility: 'hidden' }}></div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>New Password</label>
                                                <input type="password" className="settings-input" value={passwordData.new_password} onChange={e => setPasswordData({ ...passwordData, new_password: e.target.value })} required />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Confirm New Password</label>
                                                <input type="password" className="settings-input" value={passwordData.confirm_password} onChange={e => setPasswordData({ ...passwordData, confirm_password: e.target.value })} required />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={handlePasswordSave}
                                                className="save-btn"
                                                style={{ padding: '0.8rem 2rem' }}
                                                disabled={passwordLoading}
                                            >
                                                {passwordLoading ? 'Updating...' : 'Save Password'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="settings-group-box">
                            <h3 className="settings-card-title" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                                <Shield size={20} color="var(--accent-primary)" style={{ marginRight: '0.8rem' }} />
                                Two-Factor Authentication
                            </h3>
                            <div className="setting-tile">
                                <div className="setting-tile-label">
                                    <div className="setting-tile-title">Authenticator App (TOTP)</div>
                                    <div className="setting-tile-desc">{user?.two_factor_enabled ? 'Shield Active' : 'Extra layer of security'}</div>
                                </div>
                                <div className="setting-tile-action">
                                    {user?.two_factor_enabled ? (
                                        <button className="tile-btn-minimal" onClick={handleDisable2FA} style={{ color: '#ff4444' }}>Disable</button>
                                    ) : (
                                        <button className="save-btn" onClick={handleSetup2FA} style={{ padding: '0.6rem 1.4rem' }}>Setup</button>
                                    )}
                                </div>
                            </div>

                            {user?.two_factor_enabled && (
                                <div className="setting-tile" style={{ borderTop: '1px solid #1a1a20', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                    <div className="setting-tile-label">
                                        <div className="setting-tile-title">Backup Recovery Codes</div>
                                        <div className="setting-tile-desc">{recoveryCodeCount > 0 ? `${recoveryCodeCount} codes remaining` : 'No backup codes generated'}</div>
                                    </div>
                                    <div className="setting-tile-action">
                                        <button className="tile-btn-minimal" onClick={handleGenerateRecoveryCodes} disabled={generatingRecovery}>
                                            {generatingRecovery ? '...' : (recoveryCodeCount > 0 ? 'Regenerate' : 'Generate')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="settings-group-box danger-box" >
                            <h3 className="settings-card-title" style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#ff4444' }}>
                                <AlertCircle size={20} color="#ff4444" style={{ marginRight: '0.8rem' }} />
                                Danger Zone
                            </h3>
                            <div className="setting-tile">
                                <div className="setting-tile-label">
                                    <div className="setting-tile-title">Deactivate Account</div>
                                    <div className="setting-tile-desc">Temporarily hide your profile</div>
                                </div>
                                <div className="setting-tile-action">
                                    <button className="tile-btn-minimal" style={{ color: '#ff8888' }} onClick={() => setShowDeactivateModal(true)}>Deactivate</button>
                                </div>
                            </div>
                            <div className="setting-tile" style={{ border: 'none' }}>
                                <div className="setting-tile-label">
                                    <div className="setting-tile-title">Delete Account</div>
                                    <div className="setting-tile-desc">Action is irreversible</div>
                                </div>
                                <div className="setting-tile-action">
                                    <button className="tile-btn-minimal" style={{ color: '#ff4444' }} onClick={() => setShowDeleteModal(true)}>Delete</button>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <section className="settings-card">
                            <div className="settings-card-title">
                                <Bell size={24} color="#eb0000" />
                                Push Notifications
                            </div>
                            <div className="settings-group-box">
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                    Control what alerts you receive directly on the platform and mobile apps.
                                </p>
                                <ToggleSwitch name="notif_new_follower" label="New Followers" checked={!!formData.notif_new_follower} onChange={handleFormChange} />
                                <ToggleSwitch name="notif_likes" label="Video Likes" checked={!!formData.notif_likes} onChange={handleFormChange} />
                                <ToggleSwitch name="notif_comments" label="Video Comments" checked={!!formData.notif_comments} onChange={handleFormChange} />
                                <ToggleSwitch name="notif_challenge_win" label="Challenge Wins & Trophies" checked={!!formData.notif_challenge_win} onChange={handleFormChange} />
                            </div>
                        </section>

                        <section className="settings-card">
                            <div className="settings-card-title">
                                <Mail size={24} color="#eb0000" />
                                Email Preferences
                            </div>
                            <div className="settings-group-box">
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                    Manage the communications sent to your registered email address.
                                </p>
                                <ToggleSwitch name="email_weekly" label="Weekly Performance Summary" checked={!!formData.email_weekly} onChange={handleFormChange} />
                                <ToggleSwitch name="email_challenges" label="New Trending Challenges" checked={!!formData.email_challenges} onChange={handleFormChange} />
                                <ToggleSwitch name="email_payouts" label="Payout & Earnings Updates" checked={!!formData.email_payouts} onChange={handleFormChange} />
                                <ToggleSwitch name="email_marketing" label="Monteeq News & Offers" checked={!!formData.email_marketing} onChange={handleFormChange} />
                            </div>
                        </section>
                    </div>
                )}

                <div style={{ marginTop: '3rem' }}>
                    <DashboardBannerAd
                        title="Secure Your Channel"
                        subtitle="Enable 2FA and hardware keys for maximum legendary protection."
                        cta="UPGRADE SECURITY"
                        image="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=60"
                    />
                </div>
            </main>

            {/* 2FA Setup Modal */}

            {show2FAModal && (
                <div className="modal-overlay" onClick={() => setShow2FAModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <h3>Setup Authenticator</h3>
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '18px', display: 'inline-block', margin: '2rem 0' }}>
                            <img src={qrCodeData?.qr_code} alt="QR" style={{ width: '180px' }} />
                        </div>
                        <div className="settings-card" style={{ padding: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                            {qrCodeData?.secret}
                            <Copy size={18} cursor="pointer" onClick={handleCopyKey} />
                        </div>
                        <input className="settings-input" style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '4px', marginBottom: '2rem' }} maxLength={6} placeholder="000000" value={totpCode} onChange={e => setTotpCode(e.target.value)} />
                        <button className="save-btn" style={{ width: '100%' }} onClick={handleVerify2FA} disabled={totpCode.length !== 6}>Enable 2FA</button>
                    </div>
                </div>
            )}

            {showDeactivateModal && (
                <div className="modal-overlay" onClick={() => setShowDeactivateModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <AlertCircle size={48} color="#ff8888" style={{ marginBottom: '1.5rem' }} />
                        <h3>Deactivate Account?</h3>
                        <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem' }}>This will temporarily hide your profile and videos.</p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="tile-btn-minimal" onClick={() => setShowDeactivateModal(false)}>Cancel</button>
                            <button className="save-btn" style={{ background: '#ff8888' }} onClick={handleDeactivateAccount}>Deactivate</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <AlertCircle size={48} color="#ff4444" style={{ marginBottom: '1.5rem' }} />
                        <h3>Permanent Deletion</h3>
                        <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem' }}>Type \"DELETE\" to confirm. Action is irreversible.</p>
                        <input className="settings-input" style={{ textAlign: 'center', marginBottom: '2rem' }} placeholder="DELETE" value={confirmDeleteText} onChange={e => setConfirmDeleteText(e.target.value.toUpperCase())} />
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="tile-btn-minimal" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="save-btn" style={{ background: '#ff4444' }} disabled={confirmDeleteText !== 'DELETE'} onClick={handleDeleteAccount}>Delete Permanently</button>
                        </div>
                    </div>
                </div>
            )}

            {showRecoveryModal && (
                <div className="modal-overlay" onClick={() => setShowRecoveryModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '480px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <Key size={40} color="var(--accent-primary)" />
                            <h3 style={{ marginTop: '1rem' }}>Recovery Codes</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Keep these in a safe place. One-time use each.</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                            {recoveryCodes.map((code, idx) => (
                                <div key={idx} style={{ fontFamily: 'monospace', textAlign: 'center', color: 'white' }}>{code}</div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="tile-btn-minimal" style={{ flex: 1 }} onClick={downloadRecoveryCodes}>Download</button>
                            <button className="save-btn" style={{ flex: 1 }} onClick={() => setShowRecoveryModal(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {hasChanges && (
                <div className="floating-save-bar">
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>Unsaved Changes</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You have pending adjustments.</div>
                    </div>
                    <button className="save-btn" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
                </div>
            )}
        </div>
    );
};

export default Settings;
