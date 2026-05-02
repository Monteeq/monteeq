import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Zap, Loader2, Eye, EyeOff, ArrowRight, Chrome } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/images/logo.png';

const Login = () => {
    const [activeTab, setActiveTab] = useState('google'); // 'google' or 'email'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setError('');
        setIsLoading(true);
        try {
            await login({ username, password });
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid username or password');
        } finally {
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.6, staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="auth-v4-page">
            <div className="auth-v4-bg" />
            
            <div className="auth-v4-container">
                <motion.div 
                    className="auth-v4-card"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={itemVariants} className="auth-v4-header">
                        <img src={logo} alt="Monteeq" className="auth-v4-logo-img" />
                        <h1 className="auth-v4-title">Welcome <br /><span className="auth-v4-outline">Back.</span></h1>
                        <p>Sign in to your Monteeq account.</p>
                    </motion.div>

                    {/* --- TAB SWITCHER --- */}
                    <motion.div variants={itemVariants} className="auth-v4-tabs">
                        <button 
                            className={`auth-v4-tab ${activeTab === 'google' ? 'active' : ''}`}
                            onClick={() => setActiveTab('google')}
                        >
                            <Chrome size={16} /> Google
                        </button>
                        <button 
                            className={`auth-v4-tab ${activeTab === 'email' ? 'active' : ''}`}
                            onClick={() => setActiveTab('email')}
                        >
                            <Mail size={16} /> Email
                        </button>
                        <motion.div 
                            className="auth-v4-tab-indicator"
                            animate={{ x: activeTab === 'google' ? '0%' : '100%' }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    </motion.div>

                    {error && <motion.div variants={itemVariants} className="auth-v4-error">{error}</motion.div>}

                    <div className="auth-v4-content-area">
                        <AnimatePresence mode="wait">
                            {activeTab === 'email' ? (
                                <motion.form 
                                    key="email-form"
                                    className="auth-v4-form" 
                                    onSubmit={handleSubmit}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="auth-v4-group">
                                        <label>Username or Email</label>
                                        <input 
                                            type="text" 
                                            placeholder="your_username" 
                                            value={username} 
                                            onChange={(e) => setUsername(e.target.value)} 
                                            required 
                                        />
                                    </div>

                                    <div className="auth-v4-group">
                                        <div className="auth-v4-label-row">
                                            <label>Password</label>
                                            <Link to="/forgot-password">Forgot?</Link>
                                        </div>
                                        <div className="auth-v4-input-wrap">
                                            <input 
                                                type={showPassword ? "text" : "password"} 
                                                placeholder="••••••••" 
                                                value={password} 
                                                onChange={(e) => setPassword(e.target.value)} 
                                                required 
                                            />
                                            <button type="button" className="auth-v4-toggle" onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button type="submit" className="auth-v4-btn" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="spin" /> : <>Log In <ArrowRight size={18} /></>}
                                    </button>
                                </motion.form>
                            ) : (
                                <motion.div 
                                    key="google-area"
                                    className="auth-v4-social-tab"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                >
                                    <div className="auth-v4-social-info">
                                        <Chrome size={48} color="#eb0000" strokeWidth={1} />
                                        <h3>Express Login</h3>
                                        <p>Securely sign in using your Google account in one click.</p>
                                    </div>
                                    
                                    <div className="auth-v4-social-btn-wrap">
                                        {isLoading ? (
                                            <div className="auth-v4-social-loading">
                                                <Loader2 className="spin" />
                                                <span>Restoring Session...</span>
                                            </div>
                                        ) : (
                                            <GoogleLogin
                                                onSuccess={res => {
                                                    setIsLoading(true);
                                                    googleLogin(res.credential)
                                                        .then(() => navigate('/'))
                                                        .catch(err => {
                                                            setError(err.response?.data?.detail || 'Google Login Failed');
                                                            setIsLoading(false);
                                                        });
                                                }}
                                                onError={() => setError('Google Auth Failed')}
                                                theme="filled_black"
                                                shape="pill"
                                                width="100%"
                                                text="signin_with"
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <motion.div variants={itemVariants} className="auth-v4-footer">
                        New here? <Link to="/signup">Create Account</Link>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
