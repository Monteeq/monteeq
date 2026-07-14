'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp, Heart, Users, DollarSign,
    ChevronRight, Sparkles, Brain, Target, 
    ArrowUpRight, ArrowDownRight, Zap, Info, Play
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar,
    Cell, PieChart, Pie
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { 
    useUserPerformance, 
    useUserInsights, 
    useContentAnalytics, 
    useAudienceSplit, 
    useGrowthIntelligence 
} from '@/hooks/usePerformance';
import '@/styles/pages/PerformanceV2.css';

const StatCard = ({ label, value, growth, icon: Icon, color, sparkData }) => (
    <motion.div 
        className="kpi-card glass"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ translateY: -5 }}
    >
        <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">{label}</span>
            <div style={{ 
                padding: '8px', 
                borderRadius: '10px', 
                background: `${color}15`,
                color: color
            }}>
                <Icon size={18} />
            </div>
        </div>
        <div className="kpi-value-row">
            <span className="kpi-value">{value}</span>
            <div className={`kpi-growth ${growth >= 0 ? 'growth-up' : 'growth-down'}`}>
                {growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(growth).toFixed(1)}%
            </div>
        </div>
        <div className="kpi-sparkline">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                    <defs>
                        <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        strokeWidth={2} 
                        fill={`url(#grad-${label})`} 
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </motion.div>
);

const ScoreRing = ({ score }) => {
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (score / 100) * circumference;
    return (
        <svg width="180" height="180" viewBox="0 0 180 180">
            {/* Track */}
            <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            {/* Glow */}
            <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,59,48,0.15)" strokeWidth="16"
                strokeDasharray={circumference} strokeDashoffset={progress}
                strokeLinecap="round" transform="rotate(-90 90 90)" />
            {/* Fill */}
            <circle cx="90" cy="90" r={radius} fill="none" stroke="url(#scoreGrad)" strokeWidth="10"
                strokeDasharray={circumference} strokeDashoffset={progress}
                strokeLinecap="round" transform="rotate(-90 90 90)" />
            <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FF3B30" />
                    <stop offset="100%" stopColor="#FFD60A" />
                </linearGradient>
            </defs>
            {/* Centre text */}
            <text x="90" y="82" textAnchor="middle" fill="white" fontSize="36" fontWeight="900" fontFamily="Outfit, sans-serif">{score}</text>
            <text x="90" y="105" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="700" letterSpacing="2">SCORE</text>
        </svg>
    );
};

const GrowthScore = ({ intelligenceData }) => {
    const score = intelligenceData?.score ?? 0;
    const bd = intelligenceData?.breakdown ?? { consistency: 0, engagement: 0, retention: 0, frequency: 0 };
    const status = score > 80 ? 'Elite' : score > 60 ? 'Strong' : 'Growing';
    const pills = [
        { label: 'Consistency', val: `${bd.consistency}%`, color: '#34C759' },
        { label: 'Engagement', val: `${bd.engagement}%`, color: '#FFD60A' },
        { label: 'Retention', val: `${bd.retention}%`, color: '#00E5FF' },
        { label: 'Frequency', val: `${bd.frequency}%`, color: '#FF3B30' },
    ];
    return (
        <div className="growth-score-card glass">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="score-label">Monteeq Growth Score</div>
                <div style={{
                    padding: '4px 10px',
                    borderRadius: '50px',
                    background: 'rgba(255,59,48,0.15)',
                    color: 'var(--accent-primary)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>{status}</div>
            </div>
            <div className="score-ring-container">
                <ScoreRing score={score} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                {pills.map(p => (
                    <div key={p.label} style={{
                        padding: '0.6rem',
                        borderRadius: '10px',
                        background: `${p.color}10`,
                        border: `1px solid ${p.color}20`
                    }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{p.label}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: p.color, marginTop: '2px' }}>{p.val}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const IntelligencePanel = ({ insights }) => (
    <div className="ai-insights glass">
        <h3 className="card-title">
            <Brain size={18} color="var(--chart-secondary)" />
            AI Growth Insights
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {insights.map((insight, i) => (
                <motion.div 
                    key={i} 
                    className="insight-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                >
                    <div className="insight-icon">
                        <Zap size={16} />
                    </div>
                    <div className="insight-text" dangerouslySetInnerHTML={{ __html: insight }} />
                </motion.div>
            ))}
        </div>
    </div>
);

const Performance = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [activeMetric, setActiveMetric] = useState('views');
    const [activeRange, setActiveRange] = useState(30);

    const { data: perfData, isLoading: perfLoading } = useUserPerformance(token, activeMetric, activeRange);
    const { data: insightsData, isLoading: insightsLoading } = useUserInsights(token);
    const { data: contentDataRaw, isLoading: contentLoading } = useContentAnalytics(token, 8);
    const { data: audienceData, isLoading: audienceLoading } = useAudienceSplit(token, activeRange);
    const { data: intelligenceData, isLoading: intelLoading } = useGrowthIntelligence(token);

    const performanceData = useMemo(() => {
        if (!perfData?.data) return [];
        return perfData.data.map(d => ({
            ...d,
            displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: d[activeMetric] || 0
        }));
    }, [perfData, activeMetric]);

    const contentData = Array.isArray(contentDataRaw) ? contentDataRaw : [];
    const loading = perfLoading || insightsLoading || contentLoading || audienceLoading || intelLoading;

    const metricsMap = {
        views: { label: 'Total Views', icon: TrendingUp, color: '#FF3B30' },
        likes: { label: 'Engagement', icon: Heart, color: '#FFD60A' },
        followers: { label: 'Followers', icon: Users, color: '#00E5FF' },
        uploads: { label: 'Total Uploads', icon: Play, color: '#34C759' }
    };

    // Vs last period: compare second half vs first half of the selected range
    const computeGrowth = (metric) => {
        if (performanceData.length < 2) return 0;
        const mid = Math.floor(performanceData.length / 2);
        const prev = performanceData.slice(0, mid).reduce((s, d) => s + (d[metric] || 0), 0);
        const curr = performanceData.slice(mid).reduce((s, d) => s + (d[metric] || 0), 0);
        if (prev === 0) return curr > 0 ? 100 : 0;
        return parseFloat(((curr - prev) / prev * 100).toFixed(1));
    };

    const contentBreakdownData = contentData.length > 0
        ? contentData.map(v => ({
            name: v.title.length > 22 ? v.title.slice(0, 22) + '…' : v.title,
            views: v.views,
            engage: v.engagement_rate,
          }))
        : [];

    const audienceSplitData = audienceData
        ? [
            { name: 'Returning', value: audienceData.returning_viewers },
            { name: 'New', value: audienceData.new_viewers },
          ]
        : [
            { name: 'Returning', value: 0 },
            { name: 'New', value: 0 },
          ];
    const loyaltyPct = audienceData && audienceData.total_views > 0
        ? Math.round((audienceData.returning_viewers / (audienceData.returning_viewers + audienceData.new_viewers || 1)) * 100)
        : 0;

    if (loading && !insightsData) return <div className="performance-container" style={{ textAlign: 'center', paddingTop: '10rem' }}>
        <Zap className="vc-spin" size={32} color="var(--accent-primary)" />
        <p style={{ marginTop: '1rem', fontWeight: 600 }}>Analyzing Growth Signals...</p>
    </div>;

    return (
        <div className="performance-container page-container">
            {/* Page Hero Header */}
            <motion.div 
                className="perf-page-hero"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={14} /> GROWTH INTELLIGENCE
                    </div>
                    <h1 className="perf-page-title">Analytics</h1>
                    <p className="perf-page-subtitle">Track your growth, stay ahead.</p>
                </div>
                <div className="range-tabs">
                    {[7, 14, 30].map(d => (
                        <button
                            key={d}
                            className={`range-tab ${activeRange === d ? 'active' : ''}`}
                            onClick={() => setActiveRange(d)}
                        >{d}D</button>
                    ))}
                </div>
            </motion.div>

            {/* KPI Header Section */}
            <div className="perf-header">
                <StatCard 
                    label="Views" 
                    value={(insightsData?.total_views ?? 0).toLocaleString()} 
                    growth={computeGrowth('views')}
                    icon={TrendingUp}
                    color="#FF3B30"
                    sparkData={performanceData.slice(-7).map(d => ({ value: d.views }))}
                />
                <StatCard 
                    label="Followers" 
                    value={(insightsData?.followers ?? 0).toLocaleString()} 
                    growth={computeGrowth('followers')}
                    icon={Users}
                    color="#00E5FF"
                    sparkData={performanceData.slice(-7).map(d => ({ value: d.followers }))}
                />
                <StatCard 
                    label="Engagement" 
                    value={(insightsData?.total_likes ?? 0).toLocaleString()} 
                    growth={computeGrowth('likes')}
                    icon={Heart}
                    color="#FFD60A"
                    sparkData={performanceData.slice(-7).map(d => ({ value: d.likes }))}
                />
                <StatCard 
                    label="Total Uploads" 
                    value={((insightsData?.home_videos || 0) + (insightsData?.flash_videos || 0)).toLocaleString()} 
                    growth={computeGrowth('total_videos')}
                    icon={Play}
                    color="#34C759"
                    sparkData={performanceData.slice(-7).map(d => ({ value: d.total_videos || 0 }))}
                />
            </div>

            <div className="perf-main-grid">
                <div className="perf-canvas">
                    {/* Main Timeline Section */}
                    <div className="timeline-section glass">
                        <div className="timeline-header">
                            <div>
                                <h2 className="card-title">Performance Timeline</h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Analyze trends over the last {activeRange} days</p>
                            </div>
                            <div className="timeline-controls">
                                {Object.keys(metricsMap).map(m => (
                                    <button 
                                        key={m}
                                        onClick={() => setActiveMetric(m)}
                                        className={`metric-toggle ${activeMetric === m ? 'active' : ''}`}
                                    >
                                        {metricsMap[m].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer>
                                <AreaChart data={performanceData}>
                                    <defs>
                                        <linearGradient id="mainGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={metricsMap[activeMetric].color} stopOpacity={0.5} />
                                            <stop offset="100%" stopColor={metricsMap[activeMetric].color} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis 
                                        dataKey="displayDate" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                        tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                                    />
                                    <Tooltip 
                                        contentStyle={{ 
                                            background: 'rgba(0,0,0,0.8)', 
                                            border: '1px solid var(--card-border)',
                                            borderRadius: '12px',
                                            backdropFilter: 'blur(10px)'
                                        }}
                                        itemStyle={{ color: metricsMap[activeMetric].color }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke={metricsMap[activeMetric].color} 
                                        strokeWidth={4} 
                                        fill="url(#mainGradient)" 
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Content Breakdown Section */}
                    <div className="breakdown-grid">
                        <div className="breakdown-card glass">
                            <h3 className="card-title">
                                <Play size={18} color="var(--accent-primary)" />
                                Top Performing Content
                            </h3>
                            {contentBreakdownData.length === 0 ? (
                                <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.5rem' }}>
                                    <Play size={32} strokeWidth={1} />
                                    <p style={{ fontSize: '0.9rem' }}>No videos yet</p>
                                </div>
                            ) : (
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={contentBreakdownData} layout="vertical" margin={{ left: 0, right: 16 }}>
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 11 }}
                                                width={130}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                                contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', backdropFilter: 'blur(10px)' }}
                                                formatter={(v, n) => [n === 'views' ? v.toLocaleString() : `${v}%`, n === 'views' ? 'Views' : 'Engagement']}
                                            />
                                            <Bar dataKey="views" name="views" fill="#FF3B30" radius={[0, 6, 6, 0]} barSize={18} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        <div className="breakdown-card glass">
                            <h3 className="card-title">
                                <Target size={18} color="var(--chart-success)" />
                                Engagement Distribution
                            </h3>
                            {/* Donut with centred overlay */}
                            <div style={{ height: '280px', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={audienceSplitData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={64}
                                            outerRadius={84}
                                            paddingAngle={audienceData && (audienceData.returning_viewers + audienceData.new_viewers) > 0 ? 8 : 0}
                                            dataKey="value"
                                        >
                                            <Cell fill="#FF3B30" />
                                            <Cell fill="#00E5FF" />
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: 'rgba(0,0,0,0.9)', border: 'none', borderRadius: '8px', backdropFilter: 'blur(10px)' }}
                                            formatter={(v, n) => [v.toLocaleString(), n]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Absolute centre overlay */}
                                <div className="donut-overlay">
                                    <p style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1 }}>{loyaltyPct}%</p>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1.5px' }}>LOYALTY</p>
                                </div>
                                {/* Legend */}
                                <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF3B30', display: 'inline-block' }} />
                                        Returning
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00E5FF', display: 'inline-block' }} />
                                        New
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* New: Geographic Performance Section */}
                        <div className="breakdown-card glass" style={{ gridColumn: 'span 2' }}>
                            <h3 className="card-title">
                                <Sparkles size={18} color="#FFD60A" />
                                Geographic Performance
                            </h3>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                                gap: '2rem',
                                padding: '1rem 0'
                            }}>
                                {insightsData?.top_countries?.length > 0 ? (
                                    insightsData.top_countries.map((c, i) => (
                                        <div key={i} className="geo-stat">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.country}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.count.toLocaleString()} views</span>
                                            </div>
                                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(c.count / (insightsData?.total_views || 1)) * 100}%` }}
                                                    style={{ 
                                                        height: '100%', 
                                                        background: i === 0 ? '#FF3B30' : i === 1 ? '#00E5FF' : '#FFD60A',
                                                        boxShadow: `0 0 10px ${i === 0 ? 'rgba(255,59,48,0.4)' : i === 1 ? 'rgba(0,229,255,0.4)' : 'rgba(255,214,10,0.4)'}`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        Regional audience data is still being analyzed...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Intelligence Sidebar */}
                <aside className="intelligence-sidebar">
                    <GrowthScore intelligenceData={intelligenceData} />
                    
                    <IntelligencePanel insights={intelligenceData?.insights || []} />

                    <div className="action-panel">
                        <h4 className="card-title" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Next Actions</h4>
                        <button className="action-btn primary" onClick={() => navigate('/upload')}>
                            Schedule Next Flash upload
                            <ChevronRight size={18} />
                        </button>
                        <button className="action-btn" onClick={() => navigate('/challenges')}>
                            Join Gold Challenge
                            <Target size={18} />
                        </button>
                        <button className="action-btn">
                            Improve Low-performing clips
                            <Zap size={18} />
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Performance;
