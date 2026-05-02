import React from 'react';
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
import logo from '../assets/images/logo.png';
import './Landing.css';

const Landing = () => {
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
            {/* ═══ MINIMAL NAV ═══ */}
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

            {/* ═══ HERO ═══ */}
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
                            The Premier <br />
                            Network for <br />
                            <span className="ld-v4-outline">Top Editors.</span>
                        </motion.h1>
                        <motion.p
                            className="ld-v4-subtitle"
                            variants={fadeInUp}
                        >
                            Monteeq is a professional distribution platform that monetizes
                            your short-form video skills using high-performance engagement algorithms.
                        </motion.p>
                        <motion.div
                            className="ld-v4-cta-wrap"
                            variants={{
                                hidden: { opacity: 0, scale: 0.8 },
                                visible: { opacity: 1, scale: 1, transition: { type: "spring", damping: 12 } }
                            }}
                        >
                            <Link to="/signup" className="ld-v4-main-btn">
                                Monetize Your Craft <ArrowRight size={18} />
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* ═══ PERFORMANCE ECOSYSTEM ═══ */}
            <section className="ld-v4-performance">
                <div className="ld-v4-container">
                    <motion.div
                        className="ld-v4-perf-header"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={fadeInUp}
                    >
                        <div className="ld-v4-tag">Revenue Reimagined</div>
                        <h2>The Science of <span className="ld-v4-outline">Performance.</span></h2>
                        <p>On Monteeq, your revenue is directly tied to the impact of your work. Our algorithm prioritizes quality over mindless volume.</p>
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
                                { icon: <Activity />, title: "High-Yield Multipliers", text: "We apply a 30x weight to shares and 10x to saves. One high-impact edit can outperform thousands of low-engagement views." },
                                { icon: <Target />, title: "Targeted Discovery", text: "Our Gravity-based discovery system matches your content with niche-specific audiences who care about the craft." },
                                { icon: <Zap />, title: "Real-Time Monetization", text: "Track your earnings in your performance dashboard. Every engagement is calculated and accounted for instantly." }
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

            {/* ═══ ANALYTICS SHOWCASE ═══ */}
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
                        <p>We provide enterprise-grade analytics to help you understand exactly what makes your audience tick.</p>
                        <ul className="ld-v4-list">
                            <li><BarChart3 size={18} /> <strong>Engagement Mapping</strong> — Trace the journey from first frame to conversion</li>
                            <li><BarChart3 size={18} /> <strong>Audience Insights</strong> — Analyze performance data to refine your next edit</li>
                            <li><BarChart3 size={18} /> <strong>Growth Score</strong> — Real-time feedback on your content's viral potential</li>
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

            {/* ═══ CHALLENGES & COMMUNITY ═══ */}
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
                            <div className="ld-v4-tag">Join the Elite</div>
                            <h2>Global Challenges. <br />Competitive Rewards.</h2>
                            <p>Compete with the world's best editors in weekly themed challenges. Win cash prizes and permanent spotlight features on the Monteeq discovery feed.</p>
                            <div className="ld-v4-stat-row">
                                <div className="ld-v4-stat">
                                    <span className="ld-v4-stat-num">₦100k+</span>
                                    <span className="ld-v4-stat-label">Active Prize Pools</span>
                                </div>
                                <div className="ld-v4-stat">
                                    <span className="ld-v4-stat-num">Elite</span>
                                    <span className="ld-v4-stat-label">Tier Recognition</span>
                                </div>
                            </div>
                            <Link to="/signup" className="ld-v4-btn-outline">Browse Challenges <Sparkles size={18} /></Link>
                        </motion.div>
                        <div className="ld-v4-challenges-visual">
                            <ChallengesAnimated />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ═══ INFRASTRUCTURE ═══ */}
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
                        <h2>Built for the <br />High-End Creator.</h2>
                        <p>We provide the infrastructure necessary for professional-grade distribution. Your edits deserve more than standard compression.</p>
                        <ul className="ld-v4-list">
                            <li><ShieldCheck size={18} /> <strong>4K Ultra-HD Playback</strong> — Your quality, uncompromised</li>
                            <li><ShieldCheck size={18} /> <strong>Lightning Fast Uploads</strong> — Global CDN distribution</li>
                            <li><ShieldCheck size={18} /> <strong>Secure Payouts</strong> — Direct to your bank account</li>
                        </ul>
                        <Link to="/pro" className="ld-v4-link">View Pro Benefits <ArrowRight size={16} /></Link>
                    </motion.div>
                </motion.div>
            </section>

            {/* ═══ FINAL CTA ═══ */}
            <section className="ld-v4-final">
                <div className="ld-v4-final-content">
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    >
                        <h2>Ready to turn your skills into <br />
                            <span className="ld-v4-outline">Real Income?</span></h2>
                        <Link to="/signup" className="ld-v4-main-btn large">Create Your Account</Link>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default Landing;
