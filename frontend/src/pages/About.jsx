import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, DollarSign, Zap, Fingerprint } from 'lucide-react';
import './About.css';

/* ── Content ─────────────────────────────────────────────── */
const VALUES = [
  { icon: <TrendingUp size={24} />, title: 'Advanced Insights', desc: 'Track your growth with detailed analytics and engagement metrics. Optimize your reach.' },
  { icon: <Zap size={24} />, title: 'Insane Speed', desc: 'Fast video processing that instantly renders your highest-quality uploads.' },
  { icon: <Fingerprint size={24} />, title: 'Pure Independence', desc: 'Build your own personal brand and audience without relying on traditional clients.' },
];

/* ── Lightweight Intersection Observer ───────────────────── */
function useReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      document.querySelectorAll('.ab-r').forEach(el => el.classList.add('ab-in'));
      return;
    }

    const els = document.querySelectorAll('.ab-r');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { 
          e.target.classList.add('ab-in'); 
          io.unobserve(e.target); 
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const About = () => {
  useReveal();

  return (
    <div className="ab-page">
      <div className="ab-bg" aria-hidden="true" />

      {/* ═══ HERO & THE STORY ═══ */}
      <section className="ab-hero">
        <h1 className="ab-hero-title ab-r">
          The Story Behind <span className="text-red">Monteeq.</span>
        </h1>

        <p className="ab-hero-sub ab-r" style={{ maxWidth: '650px' }}>
          We built Monteeq for one simple reason: we were tired of watching talented editors get exploited.
        </p>

        <div className="ab-mission-content ab-r" style={{ textAlign: 'left', margin: 0 }}>
          <p>
            For years, the story was the same: you spend countless hours mastering CapCut, Premiere, or After Effects. You hunt for clients, deal with endless revisions, and finally hand over a masterpiece for a flat, low rate.
          </p>
          <p>
            Then, you watch that client rack up millions of views and gain all the recognition for your hard work. It felt like a trap. We built Monteeq to break it.
          </p>
        </div>
      </section>

      {/* ═══ MISSION & WHAT WE DO ═══ */}
      <section className="ab-section ab-bg-alt">
        <div className="ab-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem' }}>
          
          <div className="ab-r">
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', marginBottom: '1rem' }}>Our Mission</h2>
            <p style={{ color: 'var(--ab-text-muted)', lineHeight: 1.7 }}>
              To give video editors a platform where their art directly translates to their global influence. No middlemen. No gatekeepers.
            </p>
          </div>

          <div className="ab-r">
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', marginBottom: '1rem' }}>What We Actually Do</h2>
            <p style={{ color: 'var(--ab-text-muted)', lineHeight: 1.7 }}>
              Monteeq is incredibly simple. It’s a platform built exclusively for short-form video editors. You upload your edits, and we distribute them to a global audience. You focus on making great content; we focus on making sure your work gets the exposure it deserves.
            </p>
          </div>

        </div>
      </section>

      {/* ═══ WHY WE STAND OUT ═══ */}
      <section className="ab-section">
        <div className="ab-header ab-r">
          <h2>Why We Stand Out</h2>
          <p>Most platforms treat creators as an afterthought. We don't.</p>
        </div>
        <div className="ab-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {VALUES.map((v, i) => (
            <div key={i} className="ab-card ab-r">
              <div className="ab-icon">{v.icon}</div>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TRUST ═══ */}
      <section className="ab-section ab-bg-alt">
        <div className="ab-header ab-r" style={{ textAlign: 'center', margin: '0 auto 3rem auto', maxWidth: '800px' }}>
          <h2>Built on Transparency</h2>
          <p style={{ marginTop: '1.5rem', lineHeight: '1.8' }}>
            We know talk is cheap in the creator economy. That’s why we built a transparent dashboard where you watch your view count and your engagement metrics grow in real-time. We don't hide your data. You get full access to the analytics that power your growth, safely and securely.
          </p>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="ab-cta ab-r">
        <h2 style={{ fontSize: '2.5rem' }}>Ready to change the way you work?</h2>
        <p style={{ maxWidth: '600px', margin: '0 auto 2.5rem auto' }}>
          Your talent shouldn't be hidden in someone else's shadow. Stop waiting for permission and start building your own creative legacy.
        </p>
        <Link to="/signup" className="ab-btn">
          Join Monteeq Today <ArrowRight size={18} />
        </Link>
      </section>

      {/* ═══ APP FOOTER ═══ */}
    </div>
  );
};

export default About;
