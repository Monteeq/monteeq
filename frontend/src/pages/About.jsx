import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Fingerprint, TrendingUp, Sparkles, Target, ShieldCheck } from 'lucide-react';
import HeroAnimated from '../components/landing/HeroAnimated';
import './Landing.css'; // Reuse landing styles
import './About.css';

const About = () => {
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
      {/* ═══ HERO ═══ */}
      <section className="ld-v4-hero" style={{ minHeight: 'auto', paddingBottom: '100px' }}>
        <HeroAnimated />
        <div className="ld-v4-hero-text">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.h1 className="ld-v4-title" variants={{
              hidden: { y: 100, opacity: 0, skewY: 7 },
              visible: { y: 0, opacity: 1, skewY: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
            }}>
              The Story <br />
              Behind <span className="ld-v4-outline">Monteeq.</span>
            </motion.h1>
            <motion.p className="ld-v4-subtitle" variants={fadeInUp}>
              We built Monteeq because we were tired of watching talented editors get exploited. 
              Our mission is to give creators the platform they deserve.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ═══ THE PROBLEM ═══ */}
      <section className="ld-v4-performance" style={{ background: '#000' }}>
        <div className="ld-v4-container">
          <motion.div 
            className="ld-v4-perf-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="ld-v4-tag">The Catalyst</div>
            <h2>Breaking the <span className="ld-v4-outline">Trap.</span></h2>
            <p style={{ maxWidth: '800px', margin: '0 auto' }}>
              For years, editors spent hours mastering their craft, only for clients to take all the credit and profit. 
              Monteeq was built to hand that power back to you.
            </p>
          </motion.div>

          <motion.div 
            className="ld-v4-perf-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              { icon: <TrendingUp />, title: "Deep Insights", text: "Track your growth with advanced analytics and engagement metrics. No more guessing." },
              { icon: <Zap />, title: "Insane Speed", text: "Global CDN distribution ensures your highest-quality edits render and stream instantly." },
              { icon: <Fingerprint />, title: "Pure Independence", text: "Build your personal brand and audience without relying on traditional clients or middlemen." }
            ].map((item, i) => (
              <motion.div key={i} className="ld-v4-perf-card" variants={fadeInUp}>
                <div className="ld-v4-perf-icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ MISSION & VALUES ═══ */}
      <section className="ld-v4-showcase">
        <motion.div 
          className="ld-v4-split"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div className="ld-v4-split-text" variants={fadeInUp}>
            <div className="ld-v4-tag">Our Philosophy</div>
            <h2>Built on <br />Transparency.</h2>
            <p>Talk is cheap. We back it up with data that you can see, touch, and verify.</p>
            <ul className="ld-v4-list">
              <li><Target size={18} /> <strong>No Gatekeepers</strong> — Your reach is earned, not bought.</li>
              <li><ShieldCheck size={18} /> <strong>Data Ownership</strong> — You own your audience and your metrics.</li>
              <li><Sparkles size={18} /> <strong>Art-First</strong> — Technology that amplifies art, never replaces it.</li>
            </ul>
          </motion.div>
          <motion.div 
            className="ld-v4-split-visual"
            variants={{
              hidden: { opacity: 0, scale: 0.8 },
              visible: { opacity: 1, scale: 1, transition: { duration: 1 } }
            }}
          >
            <div className="ab-visual-placeholder">
              {/* Optional: Add a custom animation here */}
              <div className="ld-v4-perf-icon" style={{ transform: 'scale(3)' }}><Target size={48} /></div>
            </div>
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
            transition={{ duration: 1 }}
          >
            <h2>Ready to start your <br /><span className="ld-v4-outline">Legacy?</span></h2>
            <Link to="/signup" className="ld-v4-main-btn large">Join Monteeq Today</Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default About;
