import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Zap, Loader2, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../api';
import logo from '../assets/images/logo.png';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const passwordRequirements = [
        { label: '8+ characters', met: newPassword.length >= 8 },
        { label: 'Uppercase', met: /[A-Z]/.test(newPassword) },
        { label: 'Lowercase', met: /[a-z]/.test(newPassword) },
        { label: 'Digit', met: /[0-9]/.test(newPassword) },
        { label: 'Special symbol', met: /[!@#$%^&*()\-_=+[\]{}|;:'",.<>/?`~]/.test(newPassword) },
    ];

    const isPasswordValid = passwordRequirements.every(req => req.met);

    useEffect(() => {
        if (!token || !email) {
            setError('Invalid or broken reset link. Please request a new one.');
        }
    }, [token, email]);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (isLoading || !isPasswordValid) return;
        setError('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: token, new_password: newPassword })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Reset failed');

            setMessage(data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { 
            opacity: 1, 
            scale: 1, 
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.1 } 
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5 } }
    };

    return (
        <div className="auth-v4-page">
            <div className="auth-v4-bg" />
            
            {/* --- SECURITY SHIELD ANIMATION --- */}
            <div className="auth-v4-shield-bg">
                <div className="auth-v4-shield-pulse" />
            </div>

            <div className="auth-v4-container">
                <motion.div 
                    className="auth-v4-card"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={itemVariants} className="auth-v4-header">
                        <img src={logo} alt="Monteeq" className="auth-v4-logo-img" />
                        <h1 className="auth-v4-title">Secured <br /><span className="auth-v4-outline">Access.</span></h1>
                        <p>{message ? "Your identity is restored." : "Update your account with a high-performance password."}</p>
                    </motion.div>

                    {error && <motion.div variants={itemVariants} className="auth-v4-error">{error}</motion.div>}
                    
                    <AnimatePresence mode="wait">
                        {message ? (
                            <motion.div 
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="auth-v4-success-state"
                            >
                                <motion.div 
                                    className="auth-v4-success-pulse"
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <ShieldCheck size={64} color="#34c759" />
                                </motion.div>
                                <h2 className="auth-v4-outline" style={{ marginTop: '2rem' }}>Restored.</h2>
                                <p style={{ color: '#888', margin: '1rem 0 2rem' }}>Password updated. Redirecting to your dashboard...</p>
                                <Link to="/login" className="auth-v4-btn">Instant Login</Link>
                            </motion.div>
                        ) : (
                            <motion.form 
                                key="form"
                                className="auth-v4-form" 
                                onSubmit={handleResetPassword}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <motion.div variants={itemVariants} className="auth-v4-group">
                                    <label>New Secret Key</label>
                                    <div className="auth-v4-input-wrap">
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="••••••••" 
                                            value={newPassword} 
                                            onChange={(e) => setNewPassword(e.target.value)} 
                                            required 
                                            disabled={!!error || isLoading}
                                        />
                                        <button type="button" className="auth-v4-toggle" onClick={() => setShowPassword(!showPassword)}>
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <div className="auth-v4-pass-check-v2">
                                        {passwordRequirements.map((req, i) => (
                                            <motion.div 
                                                key={i} 
                                                className={`auth-v4-req-item ${req.met ? 'met' : ''}`}
                                                animate={{ x: req.met ? [0, 5, 0] : 0 }}
                                            >
                                                {req.met ? <ShieldCheck size={12} /> : <div className="dot" />}
                                                <span>{req.label}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>

                                <motion.button 
                                    variants={itemVariants} 
                                    type="submit" 
                                    className="auth-v4-btn" 
                                    disabled={isLoading || !isPasswordValid || !!error}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {isLoading ? <Loader2 className="spin" /> : <>Restore Access <ArrowRight size={18} /></>}
                                </motion.button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <motion.div variants={itemVariants} className="auth-v4-footer">
                        Need a new link? <Link to="/forgot-password">Request Reset</Link>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default ResetPassword;
