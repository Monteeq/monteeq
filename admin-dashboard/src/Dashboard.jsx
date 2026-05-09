import React, { useEffect, useState } from 'react';
import { getStats, getUsers, promoteUser, getStorageMode, updateStorageMode, getAdminConfig } from './api';
import { Users, Video, ShieldCheck, LogOut, Search, Cloud, Database, ExternalLink, Sun, Moon, MoreHorizontal, ArrowUpRight, Cpu, Trophy, CreditCard, TrendingUp, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from './context/NotificationContext';

const Dashboard = ({ token, setToken, theme, toggleTheme }) => {
    const [stats, setStats] = useState({ 
        users: 0, 
        videos: 0, 
        premium_users: 0, 
        total_views: 0,
        total_revenue: 0,
        top_signup_countries: []
    });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [storageMode, setStorageMode] = useState('s3');
    const [switching, setSwitching] = useState(false);
    const [adminConfig, setAdminConfig] = useState({ rust_service_url: '' });
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsData, usersData, storageData, configData] = await Promise.all([
                    getStats(token),
                    getUsers(token),
                    getStorageMode(token),
                    getAdminConfig(token)
                ]);
                setStats(statsData);
                setUsers(usersData);
                setStorageMode(storageData.mode);
                setAdminConfig(configData);
            } catch (err) {
                console.error("Failed to fetch data", err);
                if (err.response && err.response.status === 401) {
                    handleLogout();
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem('adminToken');
        navigate('/');
    };

    const handleStorageToggle = async (newMode) => {
        if (newMode === storageMode) return;
        setSwitching(true);
        try {
            await updateStorageMode(newMode, token);
            setStorageMode(newMode);
            showNotification('success', `Storage provider switched to ${newMode === 's3' ? 'AWS S3' : 'Supabase'}`);
        } catch (err) {
            console.error("Failed to update storage mode", err);
            showNotification('error', "Failed to update storage provider");
        } finally {
            setSwitching(false);
        }
    };

    const handlePromote = async (userId, currentStatus) => {
        try {
            await promoteUser(userId, !currentStatus, token);
            setUsers(users.map(u => u.id === userId ? { ...u, is_premium: !currentStatus } : u));
            setStats(prev => ({
                ...prev,
                premium_users: !currentStatus ? prev.premium_users + 1 : prev.premium_users - 1
            }));
            showNotification('success', `User ${!currentStatus ? 'promoted' : 'demoted'} successfully`);
        } catch (err) {
            console.error("Failed to update user", err);
            showNotification('error', "Failed to update user status");
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );



    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', transition: 'background-color 0.3s ease' }}>
            {/* Header */}
            <header style={{ 
                height: '72px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100
            }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'var(--accent-soft)', padding: '8px', borderRadius: '12px' }}>
                            <ShieldCheck size={24} color="var(--accent)" />
                        </div>
                        <div>
                            <span className="jakarta" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', display: 'block', lineHeight: 1.2 }}>
                                Monteeq Admin
                            </span>
                            {adminConfig.rust_service_url && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        VIDEO SERVICE: {adminConfig.rust_service_url}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>


                        {/* Theme Toggle */}
                        <button onClick={toggleTheme} className="btn btn-ghost" style={{ padding: '8px' }}>
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }}></div>

                        <nav style={{ display: 'flex', gap: '8px' }}>
                             <button onClick={() => navigate('/partners')} className="btn btn-ghost">
                                <Briefcase size={18} /> Partners
                            </button>
                             <button onClick={() => navigate('/challenges')} className="btn btn-ghost">
                                <Trophy size={18} /> Challenges
                            </button>

                            <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '8px' }}>
                                <LogOut size={18} />
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="container" style={{ padding: '48px 0' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
                        <ShieldCheck size={48} className="animate-pulse" color="var(--accent)" />
                    </div>
                ) : (
                    <>
                        {/* Stats Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '48px' }}>
                            <StatCard 
                                icon={<Users color="var(--accent)" />} 
                                label="Total Members" 
                                value={stats.users.toLocaleString()} 
                                onClick={() => navigate('/stats/users')}
                            />
                            <StatCard 
                                icon={<Video color="#a855f7" />} 
                                label="Videos" 
                                value={stats.videos.toLocaleString()} 
                                onClick={() => navigate('/stats/videos')}
                            />
                            <StatCard 
                                icon={<ShieldCheck color="#f59e0b" />} 
                                label="Premium Members" 
                                value={stats.premium_users.toLocaleString()} 
                                onClick={() => navigate('/stats/premium')}
                            />
                            <StatCard 
                                icon={<TrendingUp size={20} color="#10b981" />} 
                                label="Platform Revenue" 
                                value={`₦${stats.total_revenue.toLocaleString()}`} 
                                onClick={() => navigate('/stats/revenue')}
                            />
                            <StatCard 
                                icon={<Video color="var(--accent)" />} 
                                label="Platform Views" 
                                value={stats.total_views.toLocaleString()} 
                                onClick={() => navigate('/stats/views')}
                            />
                        </div>

                        {/* Signup Geography Section */}
                        <div className="card" style={{ padding: '24px', marginBottom: '48px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '10px' }}>
                                    <Cloud size={20} color="#3b82f6" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Signup Geography</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top regions where your members are joining from.</p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
                                {stats.top_signup_countries?.length > 0 ? (
                                    stats.top_signup_countries.map((c, i) => (
                                        <div key={i}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 600 }}>{c.country}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>{c.count} members</span>
                                            </div>
                                            <div style={{ height: '8px', background: 'var(--bg-raised)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ 
                                                    height: '100%', 
                                                    width: `${(c.count / stats.users) * 100}%`, 
                                                    background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                                                    borderRadius: '4px'
                                                }}></div>
                                            </div>
                                            <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>
                                                {((c.count / stats.users) * 100).toFixed(1)}% of total
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        No geographic data available yet.
                                    </div>
                                )}
                            </div>
                        </div>

                {/* Operations Section */}
                <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Member Directory</h2>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Manage total platform members and their assigned roles.</p>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Filter by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-field"
                                style={{ paddingLeft: '40px', width: '320px' }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                         <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Identity</th>
                                    <th>Role</th>
                                    <th>Plan</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr key={user.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ 
                                                    width: '40px', height: '40px', borderRadius: '10px', 
                                                    background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)',
                                                    overflow: 'hidden'
                                                }}>
                                                    {user.profile_pic ? (
                                                        <img src={user.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        user.username.substring(0, 2).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: 600 }}>{user.username}</p>
                                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email || 'No email provided'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                             <span style={{ 
                                                fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                padding: '4px 10px', borderRadius: '6px',
                                                background: user.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                                color: user.role === 'admin' ? '#ef4444' : 'var(--accent)'
                                            }}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            {user.is_premium ? (
                                                <span style={{ color: '#f59e0b', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></div> PREMIUM
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Free</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                {user.role !== 'admin' && (
                                                    <button
                                                        onClick={() => handlePromote(user.id, user.is_premium)}
                                                        className="btn btn-outline"
                                                        style={{ height: '32px', fontSize: '0.75rem' }}
                                                    >
                                                        {user.is_premium ? 'Demote Access' : 'Promote to Premium'}
                                                    </button>
                                                )}
                                                <button className="btn btn-ghost" style={{ padding: '6px' }}>
                                                    <MoreHorizontal size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                    </>
                )}
            </main>
        </div>
    );
};

const StatCard = ({ icon, label, value, onClick }) => (
    <div 
      className="card" 
      onClick={onClick}
      style={{ 
        padding: '24px', 
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
            <div style={{ background: 'var(--bg-raised)', padding: '6px', borderRadius: '8px' }}>
                {icon}
            </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h3 className="jakarta" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', margin: 0 }}>
                {value}
            </h3>
            {onClick && <ArrowUpRight size={16} color="var(--text-muted)" />}
        </div>
    </div>
);

export default Dashboard;
