import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight, Sparkles, Activity, Zap, ShieldCheck,
    Target, BarChart3
} from 'lucide-react';
import HeroAnimated from '../components/landing/HeroAnimated';
import PerformanceAnimated from '../components/landing/PerformanceAnimated';
import AnalyticsAnimated from '../components/landing/AnalyticsAnimated';
import ChallengesAnimated from '../components/landing/ChallengesAnimated';
import InfrastructureAnimated from '../components/landing/InfrastructureAnimated';
import { getPublicStats } from '../api';
import logo from '../assets/images/logo.png';
import './Landing.css';

function formatStat(n) {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return num.toLocaleString();
}

const Landing = () => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        getPublicStats()
            .then(setStats)
            .catch(() => setStats(null));
    }, []);

    const creators = stats?.creators ?? 0;
    const videos = stats?.videos ?? 0;
    const views = stats?.views ?? 0;
    const openChallenges = stats?.open_challenges ?? 0;
    const countries = stats?.countries ?? 0;
    const algo = stats?.algorithm || { likes: 10, comments: 20, shares: 30, views: 1 };
    const featured = stats?.featured_challenge;
    const prizeLabel = featured?.prize || 'Trophy + Spotlight';

    const fadeInUp = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
    };

    return (
        <div className="ld-v4-page">
            <nav className="ld-v4-nav">
                <div className="ld-v4-logo">
                    <img src={logo} alt="Monteeq" className="ld-v4-logo-img" />
                    <span>MONTEEQ</span>
                </div>
                <div className="ld-v4-nav-links">
                    <Link to="/login">Login</Link>
                    <Link to="/signup" className="ld-v4-nav-btn">Get Started</Link>
                </div>
            </nav>

            <section className="ld-v4-hero">
                <HeroAnimated />

                <div className="ld-v4-hero-text">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={staggerContainer}
                        style={{ position: 'relative', zIndex: 10 }}
                    >
                        <motion.h1
                            className="ld-v4-title"
                            variants={{
                                hidden: { y: 100, opacity: 0, skewY: 7 },
                                visible: { y: 0, opacity: 1, skewY: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
                            }}
                        >
                            The Home <br />
                            for the World&apos;s <br />
                            <span className="ld-v4-outline">Top Editors.</span>
                        </motion.h1>
                        <motion.p className="ld-v4-subtitle" variants={fadeInUp}>
                            Monteeq is built so editors own their audience. Quality-weighted discovery
                            (shares ×{algo.shares}, comments ×{algo.comments}, likes ×{algo.likes})
                            puts craft ahead of raw upload volume.
                        </motion.p>
                        <motion.div
                            className="ld-v4-cta-wrap"
                            variants={{
                                hidden: { opacity: 0, scale: 0.8 },
                                visible: { opacity: 1, scale: 1, transition: { type: "spring", damping: 12 } }
                            }}
                        >
                            <Link to="/signup" className="ld-v4-main-btn">
                                Showcase Your Craft <ArrowRight size={18} />
                            </Link>
                        </motion.div>
                        {(creators > 0 || videos > 0) && (
                            <motion.div
                                className="ld-v4-stat-row"
                                style={{ marginTop: '2rem', justifyContent: 'flex-start' }}
                                variants={fadeInUp}
                            >
                                <div className="ld-v4-stat">
                                    <span className="ld-v4-stat-num">{formatStat(creators)}</span>
                                    <span className="ld-v4-stat-label">Editors</span>
                                </div>
                                <div className="ld-v4-stat">
                                    <span className="ld-v4-stat-num">{formatStat(videos)}</span>
                                    <span className="ld-v4-stat-label">Videos</span>
                                </div>
                                <div className="ld-v4-stat">
                                    <span className="ld-v4-stat-num">{formatStat(views)}</span>
                                    <span className="ld-v4-stat-label">Views</span>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </section>

            <section className="ld-v4-performance">
                <div className="ld-v4-container">
                    <motion.div
                        className="ld-v4-perf-header"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={fadeInUp}
                    >
                        <div className="ld-v4-tag">Growth Reimagined</div>
                        <h2>The Science of <span className="ld-v4-outline">Performance.</span></h2>
                        <p>
                            Reach on Monteeq follows a real discovery score — not vanity view farming.
                            High-signal actions move you further than empty plays.
                        </p>
                    </motion.div>

                    <motion.div
                        className="ld-v4-perf-grid-wrap"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                    >
                        <div className="ld-v4-perf-visual-side">
                            <PerformanceAnimated />
                        </div>
                        <div className="ld-v4-perf-grid">
                            {[
                                {
                                    icon: <Activity />,
                                    title: 'Real Discovery Weights',
                                    text: `We score content as likes ×${algo.likes} + comments ×${algo.comments} + shares ×${algo.shares} + views ×${algo.views}, then apply gravity decay so fresh craft stays visible.`,
                                },
                                {
                                    icon: <Target />,
                                    title: 'Gravity-Based Discovery',
                                    text: 'A gravity curve of 1.8 ages older posts so new edits still earn a fair shot on the feed — without burying quality.',
                                },
                                {
                                    icon: <Zap />,
                                    title: 'Creator Tools That Ship',
                                    text: 'Insights, challenges, Watch Later, and multi-resolution streaming (up to 4K) — built for editors, not generic social noise.',
                                },
                            ].map((item, i) => (
                                <motion.div key={i} className="ld-v4-perf-card" variants={fadeInUp}>
                                    <div className="ld-v4-perf-icon">{item.icon}</div>
                                    <h3>{item.title}</h3>
                                    <p>{item.text}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="ld-v4-analytics">
                <motion.div
                    className="ld-v4-split reversed"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={staggerContainer}
                >
                    <motion.div className="ld-v4-split-text" variants={fadeInUp}>
                        <div className="ld-v4-tag">Data-Driven Growth</div>
                        <h2>Master Your <br />Metrics.</h2>
                        <p>
                            Open Insights on your profile to see engagement, consistency, and content
                            performance from your real Monteeq uploads — not demo dashboards.
                        </p>
                        <ul className="ld-v4-list">
                            <li><BarChart3 size={18} /> <strong>Engagement Mapping</strong> — Likes, comments, and shares against your view count</li>
                            <li><BarChart3 size={18} /> <strong>Audience Insights</strong> — Flash vs Home split and growth signals from your catalog</li>
                            <li><BarChart3 size={18} /> <strong>Growth Score</strong> — Composite score from consistency, engagement, retention, and upload frequency</li>
                        </ul>
                    </motion.div>
                    <motion.div
                        className="ld-v4-split-visual"
                        variants={{
                            hidden: { opacity: 0, scale: 0.8 },
                            visible: { opacity: 1, scale: 1, transition: { duration: 1 } }
                        }}
                    >
                        <AnalyticsAnimated />
                    </motion.div>
                </motion.div>
            </section>

            <section className="ld-v4-challenges">
                <div className="ld-v4-container">
                    <motion.div
                        className="ld-v4-challenges-wrap"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                    >
                        <motion.div className="ld-v4-challenges-text" variants={fadeInUp}>
                            <div className="ld-v4-tag">Join the Arena</div>
                            <h2>
                                {featured?.title ? (
                                    <>
                                        {featured.title}
                                        <br />
                                        <span className="ld-v4-outline">Is Live.</span>
                                    </>
                                ) : (
                                    <>
                                        Competitive Challenges.
                                        <br />
                                        Real Recognition.
                                    </>
                                )}
                            </h2>
                            <p>
                                {featured
                                    ? `Enter with your edit, climb the leaderboard, and compete for ${prizeLabel}. Winners earn permanent spotlight on discovery.`
                                    : 'Compete in themed challenges, earn trophies, and get featured on the Monteeq discovery feed.'}
                            </p>
                            <div className="ld-v4-stat-row">
                                <div className="ld-v4-stat">
                                    <span className="ld-v4-stat-num">{formatStat(openChallenges)}</span>
                                    <span className="ld-v4-stat-label">Open Challenges</span>
                                </div>
                                <div className="ld-v4-stat">
                                    <span className="ld-v4-stat-num">
                                        {featured?.entry_count != null ? formatStat(featured.entry_count) : formatStat(countries)}
                                    </span>
                                    <span className="ld-v4-stat-label">
                                        {featured?.entry_count != null ? 'Entries' : 'Countries'}
                                    </span>
                                </div>
                            </div>
                            <Link to="/challenges" className="ld-v4-btn-outline">Browse Challenges <Sparkles size={18} /></Link>
                        </motion.div>
                        <div className="ld-v4-challenges-visual">
                            <ChallengesAnimated />
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="ld-v4-showcase">
                <motion.div
                    className="ld-v4-split"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={staggerContainer}
                >
                    <div className="ld-v4-split-visual">
                        <InfrastructureAnimated />
                    </div>
                    <motion.div className="ld-v4-split-text" variants={fadeInUp}>
                        <div className="ld-v4-tag">Creator First</div>
                        <h2>Built for the <br />Working Editor.</h2>
                        <p>
                            From client traps to your own channel — Monteeq gives you distribution,
                            proof of craft, and the tools to grow without giving credit away.
                        </p>
                        <ul className="ld-v4-list">
                            <li><ShieldCheck size={18} /> <strong>Up to 4K Playback</strong> — Adaptive HLS so quality holds on every device</li>
                            <li><ShieldCheck size={18} /> <strong>Chunked Uploads</strong> — Reliable delivery for large edit files</li>
                            <li><ShieldCheck size={18} /> <strong>Verified Profiles</strong> — Build a professional identity editors can trust</li>
                        </ul>
                        <Link to="/pro" className="ld-v4-link">View Pro Benefits <ArrowRight size={16} /></Link>
                    </motion.div>
                </motion.div>
            </section>

            <section className="ld-v4-final">
                <div className="ld-v4-final-content">
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    >
                        <h2>Ready to put your edits in front of <br />
                            <span className="ld-v4-outline">an audience that gets craft?</span></h2>
                        <Link to="/signup" className="ld-v4-main-btn large">Create Your Account</Link>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default Landing;
