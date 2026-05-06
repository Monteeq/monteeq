import React, { useEffect, useState } from 'react';
import { getPartnerLeads, updatePartnerLeadStatus } from './api';
import { ShieldCheck, ArrowLeft, Mail, Briefcase, Clock, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from './context/NotificationContext';

const PartnerLeads = ({ token }) => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const data = await getPartnerLeads(token);
                setLeads(data);
            } catch (err) {
                console.error("Failed to fetch leads", err);
                showNotification('error', "Failed to load partner leads");
            } finally {
                setLoading(false);
            }
        };
        fetchLeads();
    }, [token]);

    const handleStatusUpdate = async (leadId, newStatus) => {
        try {
            await updatePartnerLeadStatus(leadId, newStatus, token);
            setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
            showNotification('success', `Lead status updated to ${newStatus}`);
        } catch (err) {
            console.error("Failed to update status", err);
            showNotification('error', "Failed to update lead status");
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return '#3b82f6';
            case 'contacted': return '#f59e0b';
            case 'closed': return '#10b981';
            case 'rejected': return '#ef4444';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
            <header style={{ 
                height: '72px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100
            }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ padding: '8px' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Partner Campaigns</h1>
                    </div>
                </div>
            </header>

            <main className="container" style={{ padding: '48px 0' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
                        <ShieldCheck size={48} className="animate-pulse" color="var(--accent)" />
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Inbound Briefs</h2>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Review and manage collaboration requests from brands.</p>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Brand & Contact</th>
                                        <th>Campaign Type</th>
                                        <th>Brief Details</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.length > 0 ? leads.map(lead => (
                                        <tr key={lead.id}>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{lead.brand_name}</span>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Mail size={12} /> {lead.contact_email}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Briefcase size={14} color="var(--accent)" /> {lead.campaign_type}
                                                </span>
                                            </td>
                                            <td>
                                                <p style={{ 
                                                    fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '300px',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }} title={lead.details}>
                                                    {lead.details}
                                                </p>
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    padding: '4px 10px', borderRadius: '6px',
                                                    background: `${getStatusColor(lead.status)}15`,
                                                    color: getStatusColor(lead.status)
                                                }}>
                                                    {lead.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    {lead.status === 'new' && (
                                                        <button 
                                                            onClick={() => handleStatusUpdate(lead.id, 'contacted')}
                                                            className="btn btn-outline" 
                                                            style={{ height: '32px', fontSize: '0.75rem' }}
                                                        >
                                                            Mark Contacted
                                                        </button>
                                                    )}
                                                    {lead.status === 'contacted' && (
                                                        <button 
                                                            onClick={() => handleStatusUpdate(lead.id, 'closed')}
                                                            className="btn btn-primary" 
                                                            style={{ height: '32px', fontSize: '0.75rem' }}
                                                        >
                                                            Close Deal
                                                        </button>
                                                    )}
                                                    <div className="dropdown">
                                                        <button className="btn btn-ghost" style={{ padding: '6px' }}>
                                                            <MoreVertical size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                                No partnership briefs received yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PartnerLeads;
