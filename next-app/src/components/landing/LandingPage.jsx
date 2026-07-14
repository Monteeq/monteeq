import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Activity,
  Zap,
  ShieldCheck,
  Target,
  BarChart3,
} from 'lucide-react';
import HeroAnimated from '@/components/landing/HeroAnimated';
import PerformanceAnimated from '@/components/landing/PerformanceAnimated';
import AnalyticsAnimated from '@/components/landing/AnalyticsAnimated';
import ChallengesAnimated from '@/components/landing/ChallengesAnimated';
import InfrastructureAnimated from '@/components/landing/InfrastructureAnimated';
import '@/styles/pages/Landing.css';

/**
 * Marketing landing — Server Component shell.
 * Animated visuals are client islands; all copy is in the server HTML for crawlers.
 */
export default function LandingPage() {
  return (
    <div className="ld-v4-page">
      <nav className="ld-v4-nav">
        <div className="ld-v4-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Monteeq" className="ld-v4-logo-img" />
          <span>MONTEEQ</span>
        </div>
        <div className="ld-v4-nav-links">
          <Link href="/login">Login</Link>
          <Link href="/signup" className="ld-v4-nav-btn">
            Get Started
          </Link>
        </div>
      </nav>

      <section className="ld-v4-hero">
        <HeroAnimated />
        <div className="ld-v4-hero-text">
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h1 className="ld-v4-title">
              The Home <br />
              for the World&apos;s <br />
              <span className="ld-v4-outline">Top Editors.</span>
            </h1>
            <p className="ld-v4-subtitle">
              Monteeq is built to give your edits the reach they deserve using algorithms
              focused on quality, not just volume.
            </p>
            <div className="ld-v4-cta-wrap">
              <Link href="/signup" className="ld-v4-main-btn">
                Showcase Your Craft <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ld-v4-performance">
        <div className="ld-v4-container">
          <div className="ld-v4-perf-header">
            <div className="ld-v4-tag">Growth Reimagined</div>
            <h2>
              The Science of <span className="ld-v4-outline">Performance.</span>
            </h2>
            <p>
              On Monteeq, your reach is directly tied to the impact of your work. Our algorithm
              prioritizes quality over mindless volume.
            </p>
          </div>

          <div className="ld-v4-perf-grid-wrap">
            <div className="ld-v4-perf-visual-side">
              <PerformanceAnimated />
            </div>
            <div className="ld-v4-perf-grid">
              {[
                {
                  icon: <Activity />,
                  title: 'High-Yield Multipliers',
                  text: 'We apply a 30x weight to shares and 10x to saves. One high-impact edit can outperform thousands of low-engagement views.',
                },
                {
                  icon: <Target />,
                  title: 'Targeted Discovery',
                  text: 'Our Gravity-based discovery system matches your content with niche-specific audiences who care about the craft.',
                },
                {
                  icon: <Zap />,
                  title: 'Premium Tools',
                  text: 'Access advanced editing suites and workspace management tools designed for professionals.',
                },
              ].map((item, i) => (
                <div key={i} className="ld-v4-perf-card">
                  <div className="ld-v4-perf-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ld-v4-analytics">
        <div className="ld-v4-split reversed">
          <div className="ld-v4-split-text">
            <div className="ld-v4-tag">Data-Driven Growth</div>
            <h2>
              Master Your <br />
              Metrics.
            </h2>
            <p>
              We provide deep growth insights to help you understand exactly what makes your
              audience tick.
            </p>
            <ul className="ld-v4-list">
              <li>
                <BarChart3 size={18} /> <strong>Engagement Mapping</strong> — Trace the journey
                from first frame to conversion
              </li>
              <li>
                <BarChart3 size={18} /> <strong>Audience Insights</strong> — Analyze performance
                data to refine your next edit
              </li>
              <li>
                <BarChart3 size={18} /> <strong>Growth Score</strong> — Real-time feedback on your
                content&apos;s viral potential
              </li>
            </ul>
          </div>
          <div className="ld-v4-split-visual">
            <AnalyticsAnimated />
          </div>
        </div>
      </section>

      <section className="ld-v4-challenges">
        <div className="ld-v4-container">
          <div className="ld-v4-challenges-wrap">
            <div className="ld-v4-challenges-text">
              <div className="ld-v4-tag">Join the Elite</div>
              <h2>
                Global Challenges. <br />
                Competitive Recognition.
              </h2>
              <p>
                Compete with the world&apos;s best editors in weekly themed challenges. Win
                exclusive digital trophies and permanent spotlight features on the Monteeq
                discovery feed.
              </p>
              <div className="ld-v4-stat-row">
                <div className="ld-v4-stat">
                  <span className="ld-v4-stat-num">Global</span>
                  <span className="ld-v4-stat-label">Active Competitions</span>
                </div>
                <div className="ld-v4-stat">
                  <span className="ld-v4-stat-num">Elite</span>
                  <span className="ld-v4-stat-label">Tier Recognition</span>
                </div>
              </div>
              <Link href="/signup" className="ld-v4-btn-outline">
                Browse Challenges <Sparkles size={18} />
              </Link>
            </div>
            <div className="ld-v4-challenges-visual">
              <ChallengesAnimated />
            </div>
          </div>
        </div>
      </section>

      <section className="ld-v4-showcase">
        <div className="ld-v4-split">
          <div className="ld-v4-split-visual">
            <InfrastructureAnimated />
          </div>
          <div className="ld-v4-split-text">
            <div className="ld-v4-tag">Creator First</div>
            <h2>
              Built for the <br />
              High-End Creator.
            </h2>
            <p>
              We provide the infrastructure necessary for professional-grade distribution. Your
              edits deserve more than standard compression.
            </p>
            <ul className="ld-v4-list">
              <li>
                <ShieldCheck size={18} /> <strong>4K Ultra-HD Playback</strong> — Your quality,
                uncompromised
              </li>
              <li>
                <ShieldCheck size={18} /> <strong>Lightning Fast Uploads</strong> — Global CDN
                distribution
              </li>
              <li>
                <ShieldCheck size={18} /> <strong>Verified Status</strong> — Build your
                professional identity
              </li>
            </ul>
            <Link href="/pro" className="ld-v4-link">
              View Pro Benefits <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="ld-v4-final">
        <div className="ld-v4-final-content">
          <h2>
            Ready to turn your skills into <br />
            <span className="ld-v4-outline">Global Reach?</span>
          </h2>
          <Link href="/signup" className="ld-v4-main-btn large">
            Create Your Account
          </Link>
        </div>
      </section>
    </div>
  );
}
