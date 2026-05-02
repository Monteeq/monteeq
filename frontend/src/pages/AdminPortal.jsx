import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ShieldCheck, Lock, AlertCircle, ArrowLeft, ExternalLink, Zap } from 'lucide-react';
import logo from '../assets/images/logo.png';
import { useAuth } from '../context/AuthContext';

const AdminPortal = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    // Verification Logic states
    const isAuthenticated = !!token;
    const isAdmin = user?.role === 'admin';

    const handleLaunchDashboard = () => {
        window.location.href = 'https://admin.monteeq.com';
    };

    return (
        <div className="admin-portal-container page-container" style={{
            minHeight: '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className="portal-card glass" style={{
                maxWidth: '500px',
                width: '100%',
                padding: '3rem 2rem',
                borderRadius: '32px',
                textAlign: 'center',
                border: '1px solid var(--border-glass)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div className="admin-logo-header" style={{ marginBottom: '2.5rem' }}>
                    <img src={logo} alt="Monteeq" style={{ height: '36px', width: 'auto' }} />
                </div>

                <div className="portal-icon-wrapper" style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: !isAuthenticated ? 'rgba(255,255,255,0.05)' : (!isAdmin ? 'rgba(255, 62, 62, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 2rem',
                    color: !isAuthenticated ? 'var(--text-muted)' : (!isAdmin ? '#ff3e3e' : '#10b981'),
                    boxShadow: !isAuthenticated ? 'none' : (!isAdmin ? '0 0 30px rgba(255, 62, 62, 0.2)' : '0 0 30px rgba(16, 185, 129, 0.2)')
                }}>
                    {!isAuthenticated ? <Lock size={40} /> : (!isAdmin ? <AlertCircle size={40} /> : <ShieldCheck size={40} />)}
                </div>

                <div className="portal-content">
                    {!isAuthenticated ? (
                        <>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Admin Access</h1>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
                                Please log in with your administrative credentials to continue to the management console.
                            </p>
                            <button className="hero-btn" onClick={() => navigate('/login?redirect=/admin')} style={{ width: '100%' }}>
                                Log In to Continue
                            </button>
                        </>
                    ) : !isAdmin ? (
                        <>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: '#ff3e3e' }}>Invalid Credentials</h1>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
                                Access Denied. Your account (<strong>@{user.username}</strong>) does not have the required administrative privileges to access this portal.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="glass" onClick={() => navigate('/')} style={{ flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer', color: 'white' }}>
                                    Back to Home
                                </button>
                                <button className="hero-btn" onClick={() => navigate('/login')} style={{ flex: 1 }}>
                                    Switch Account
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                <Shield size={14} /> Verified Admin
                            </div>
                            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '1rem' }}>Management Portal</h1>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
                                Authentication successful. You are authorized to access the Monteeq Administration Console.
                            </p>
                            
                            <button className="hero-btn" onClick={handleLaunchDashboard} style={{ 
                                width: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '12px',
                                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)'
                            }}>
                                Launch Admin Console <ExternalLink size={18} />
                            </button>
                            
                            <button className="auth-link" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', marginTop: '1.5rem', opacity: 0.6 }}>
                                Stay on Main Site
                            </button>
                        </>
                    )}
                </div>

                <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <img src={logo} alt="" style={{ height: '14px', width: 'auto', opacity: 0.5 }} />
                    Managed by Monteeq Security Systems
                </div>
            </div>
        </div>
    );
};

export default AdminPortal;
