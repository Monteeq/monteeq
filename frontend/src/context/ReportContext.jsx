import React, { createContext, useContext, useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { API_BASE_URL } from '../api';

const ReportContext = createContext(null);

export const ReportProvider = ({ children }) => {
    const { token } = useAuth();
    const { showNotification } = useNotification();
    
    const [isOpen, setIsOpen] = useState(false);
    const [contentType, setContentType] = useState('');
    const [contentId, setContentId] = useState('');
    const [loading, setLoading] = useState(false);
    
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');

    const openReportModal = (type, id) => {
        setContentType(type);
        setContentId(id);
        setReason('');
        setDetails('');
        setIsOpen(true);
    };

    const closeReportModal = () => {
        setIsOpen(false);
        setContentType('');
        setContentId('');
        setReason('');
        setDetails('');
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) return;

        setLoading(true);
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
                    details: details.trim() || null
                })
            });

            if (response.ok) {
                showNotification('success', 'Thank you. Your report has been submitted.');
                closeReportModal();
            } else {
                const data = await response.json();
                showNotification('error', data.detail || 'Failed to submit report. Please try again.');
            }
        } catch (err) {
            console.error('Error submitting report:', err);
            showNotification('error', 'A network error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ReportContext.Provider value={{ openReportModal, closeReportModal }}>
            {children}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 20000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={closeReportModal}>
                    <div style={{
                        background: '#111',
                        border: '1px solid var(--border-glass)',
                        padding: '2.5rem',
                        borderRadius: '2rem',
                        maxWidth: '450px',
                        width: '100%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        
                        <button 
                            onClick={closeReportModal}
                            style={{
                                position: 'absolute',
                                top: '1.5rem',
                                right: '1.5rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                            <AlertTriangle size={28} color="var(--accent-primary)" />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'white' }}>Report Content</h2>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
                                    Reason for reporting
                                </label>
                                <select
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-glass)',
                                        borderRadius: '1rem',
                                        color: 'white',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="" disabled style={{ background: '#111' }}>Select a reason...</option>
                                    <option value="Spam" style={{ background: '#111' }}>Spam</option>
                                    <option value="Harassment" style={{ background: '#111' }}>Harassment</option>
                                    <option value="Inappropriate Content" style={{ background: '#111' }}>Inappropriate Content</option>
                                    <option value="Misinformation" style={{ background: '#111' }}>Misinformation</option>
                                    <option value="Other" style={{ background: '#111' }}>Other</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
                                    Additional details (Optional)
                                </label>
                                <textarea
                                    value={details}
                                    onChange={e => setDetails(e.target.value)}
                                    placeholder="Please provide more information..."
                                    style={{
                                        width: '100%',
                                        minHeight: '120px',
                                        padding: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-glass)',
                                        borderRadius: '1rem',
                                        color: 'white',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        resize: 'none',
                                        lineHeight: '1.5'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={closeReportModal}
                                    style={{
                                        flex: 1,
                                        padding: '1rem',
                                        borderRadius: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
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
                                        padding: '1rem',
                                        borderRadius: '1rem',
                                        background: 'var(--accent-primary)',
                                        border: 'none',
                                        color: 'white',
                                        fontWeight: 700,
                                        cursor: (loading || !reason) ? 'not-allowed' : 'pointer',
                                        opacity: (loading || !reason) ? 0.7 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {loading && <Loader2 size={18} className="animate-spin" />}
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ReportContext.Provider>
    );
};

export const useReport = () => {
    const context = useContext(ReportContext);
    if (!context) {
        throw new Error('useReport must be used within a ReportProvider');
    }
    return context;
};
