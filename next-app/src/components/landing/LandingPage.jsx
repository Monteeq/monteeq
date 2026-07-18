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

function formatStat(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return num.toLocaleString();
}

/**
 * Marketing landing — Server Component shell.
 * Animated visuals are client islands; copy + live stats stay in the server HTML.
 */
export default function LandingPage({ stats = null }) {
  const creators = stats?.creators ?? 0;
  const videos = stats?.videos ?? 0;
  const views = stats?.views ?? 0;
  const openChallenges = stats?.open_challenges ?? 0;
  const countries = stats?.countries ?? 0;
  const featured = stats?.featured_challenge;
  const prizeLabel = featured?.prize || 'Trophy + Spotlight';

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
              Monteeq is built so editors own their audience. Discovery rewards real
              engagement — shares, comments, and likes — so craft beats raw upload volume.
            </p>
            <div className="ld-v4-cta-wrap">
              <Link href="/signup" className="ld-v4-main-btn">
                Showcase Your Craft <ArrowRight size={18} />
              </Link>
            </div>
            {(creators > 0 || videos > 0) && (
              <div className="ld-v4-stat-row" style={{ marginTop: '2rem', justifyContent: 'flex-start' }}>
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
              </div>
            )}
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
              Reach on Monteeq follows a real discovery score — not vanity view farming.
              High-signal actions move you further than empty plays.
            </p>
          </div>

          <div className="ld-v4-perf-grid-wrap">
            <div className="ld-v4-perf-visual-side">
              <PerformanceAnimated views={views} />
            </div>
            <div className="ld-v4-perf-grid">
              {[
                {
                  icon: <Activity />,
                  title: 'Engagement Over Empty Plays',
                  text: 'Shares, comments, and likes carry more discovery weight than passive views — so meaningful edits surface ahead of filler.',
                },
                {
                  icon: <Target />,
                  title: 'Fresh Craft Stays Visible',
                  text: 'Older posts ease down the feed over time so new edits still get a fair shot — without burying lasting quality.',
                },
                {
                  icon: <Zap />,
                  title: 'Creator Tools That Ship',
                  text: 'Insights, challenges, Watch Later, and multi-resolution streaming (up to 4K) — built for editors, not generic social noise.',
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
              Open Insights on your profile to see engagement, consistency, and content
              performance from your real Monteeq uploads — not demo dashboards.
            </p>
            <ul className="ld-v4-list">
              <li>
                <BarChart3 size={18} /> <strong>Engagement Mapping</strong> — Likes, comments,
                and shares against your view count
              </li>
              <li>
                <BarChart3 size={18} /> <strong>Audience Insights</strong> — Flash vs Home
                split and growth signals from your catalog
              </li>
              <li>
                <BarChart3 size={18} /> <strong>Growth Score</strong> — Composite score from
                consistency, engagement, retention, and upload frequency
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
              <Link href="/challenges" className="ld-v4-btn-outline">
                Browse Challenges <Sparkles size={18} />
              </Link>
            </div>
            <div className="ld-v4-challenges-visual">
              <ChallengesAnimated prize={prizeLabel} />
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
              Working Editor.
            </h2>
            <p>
              From client traps to your own channel — Monteeq gives you distribution,
              proof of craft, and the tools to grow without giving credit away.
            </p>
            <ul className="ld-v4-list">
              <li>
                <ShieldCheck size={18} /> <strong>Up to 4K Playback</strong> — Adaptive HLS so
                quality holds on every device
              </li>
              <li>
                <ShieldCheck size={18} /> <strong>Chunked Uploads</strong> — Reliable delivery
                for large edit files
              </li>
              <li>
                <ShieldCheck size={18} /> <strong>Verified Profiles</strong> — Build a
                professional identity editors can trust
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
            Ready to put your edits in front of <br />
            <span className="ld-v4-outline">an audience that gets craft?</span>
          </h2>
          <Link href="/signup" className="ld-v4-main-btn large">
            Create Your Account
          </Link>
        </div>
      </section>
    </div>
  );
}
