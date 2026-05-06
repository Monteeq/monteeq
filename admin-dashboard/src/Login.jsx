import React, { useState } from 'react';
import { login, getMe } from './api';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useNotification } from './context/NotificationContext';

const Login = ({ setToken }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const { showNotification } = useNotification();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await login(username, password);
            const user = await getMe(data.access_token);

            if (user.role !== 'admin') {
                setError('Access Denied: Admins only.');
                showNotification('error', 'Access Denied: Admins only.');
                setLoading(false);
                return;
            }

            setToken(data.access_token);
            localStorage.setItem('adminToken', data.access_token);
            showNotification('success', 'Logged in successfully');
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError('Invalid credentials or server error');
            showNotification('error', 'Invalid credentials or server error');
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0f0f0f', color: '#fff', fontFamily: 'Inter, sans-serif'
        }}>
            <form onSubmit={handleSubmit} style={{
                background: '#1a1a1a', padding: '3rem', borderRadius: '1rem',
                width: '100%', maxWidth: '400px', border: '1px solid #333',
                display: 'flex', flexDirection: 'column', gap: '1.5rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Admin Access</h1>
                    <p style={{ color: '#888' }}>Restricted Area</p>
                </div>

                {error && <div style={{ color: '#ef4444', background: '#451a1a', padding: '0.8rem', borderRadius: '0.5rem', textAlign: 'center' }}>{error}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Username</label>
                    <input
                        type="text"
                        value={username} onChange={e => setUsername(e.target.value)}
                        style={{ padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #333', background: '#252525', color: 'white', outline: 'none' }}
                        required
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Password</label>
                    <input
                        type="password"
                        value={password} onChange={e => setPassword(e.target.value)}
                        style={{ padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #333', background: '#252525', color: 'white', outline: 'none' }}
                        required
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    style={{
                        padding: '1rem', borderRadius: '0.5rem', border: 'none',
                        background: loading ? '#666' : '#ef4444', color: 'white', fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer', marginTop: '1rem', fontSize: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {loading ? (
                        <>Authenticating... <Loader2 size={18} className="animate-spin" /></>
                    ) : (
                        'Login to Console'
                    )}
                </button>
            </form>
        </div>
    );
};

export default Login;
