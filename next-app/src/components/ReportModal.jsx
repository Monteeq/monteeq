'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { API_BASE_URL } from '@/lib/browserApi';

const ReportModal = ({ contentType, contentId, onClose }) => {
    const { token } = useAuth();
    const { showNotification } = useNotification();
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const reasons = [
        { value: 'spam', label: 'Spam or Misleading' },
        { value: 'harassment', label: 'Harassment or Abuse' },
        { value: 'hate', label: 'Hate Speech' },
        { value: 'violence', label: 'Violence or Dangerous Organizations' },
        { value: 'copyright', label: 'Copyright / IP Infringement' },
        { value: 'sexual', label: 'Sexual Content' },
        { value: 'scam', label: 'Scam or Fraud' },
        { value: 'other', label: 'Other Reason' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) {
            setErrorMsg('Please select a reason.');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            const response = await fetch(`${API_BASE_URL}/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    content_type: contentType,
                    content_id: contentId,
                    reason,
                    description: description.trim() || null
                })
            });

            if (response.ok) {
                setSubmitted(true);
                showNotification('success', 'Thank you. Report submitted successfully.');
            } else {
                const data = await response.json();
                setErrorMsg(data.detail || 'Failed to submit report. Please try again.');
            }
        } catch (err) {
            console.error('Error submitting report:', err);
            setErrorMsg('A network error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }} onClick={onClose}>
            <div style={{
                background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%)',
                border: '1px solid var(--border-glass)',
                padding: '2.5rem',
                borderRadius: '24px',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                position: 'relative'
            }} onClick={e => e.stopPropagation()}>
                
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <X size={20} />
                </button>

                {submitted ? (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <CheckCircle size={56} color="#10b981" style={{ marginBottom: '1.5rem' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.8rem' }}>Report Submitted</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>
                            Thank you for helping keep Monteeq safe. Our moderation team will review this report as soon as possible.
                        </p>
                        <button 
                            className="hero-btn" 
                            onClick={onClose} 
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '12px' }}
                        >
                            Close Window
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <AlertTriangle size={24} color="var(--accent-primary)" />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Report Content</h2>
                        </div>
                        
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', textTransform: 'capitalize' }}>
                            You are reporting a {contentType}. Please select the most appropriate reason for this report below.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                                Reason *
                            </label>
                            <select
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem 1rem',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid var(--border-glass)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                                required
                            >
                                <option value="" disabled style={{ background: '#0a0a0a' }}>Select a reason...</option>
                                {reasons.map(r => (
                                    <option key={r.value} value={r.value} style={{ background: '#0a0a0a' }}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                                Additional Details (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Describe why this content violates community guidelines..."
                                style={{
                                    width: '100%',
                                    minHeight: '110px',
                                    padding: '0.8rem 1rem',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid var(--border-glass)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    resize: 'none',
                                    lineHeight: '1.4'
                                }}
                            />
                        </div>

                        {errorMsg && (
                            <div style={{
                                background: 'rgba(255, 59, 48, 0.1)',
                                border: '1px solid rgba(255, 59, 48, 0.2)',
                                color: '#ff3b30',
                                padding: '0.8rem 1rem',
                                borderRadius: '12px',
                                fontSize: '0.9rem',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <AlertTriangle size={16} />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: '0.8rem',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-glass)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !reason}
                                style={{
                                    flex: 1,
                                    padding: '0.8rem',
                                    borderRadius: '12px',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    color: 'white',
                                    fontWeight: 700,
                                    cursor: (loading || !reason) ? 'not-allowed' : 'pointer',
                                    opacity: (loading || !reason) ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                Submit Report
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ReportModal;
