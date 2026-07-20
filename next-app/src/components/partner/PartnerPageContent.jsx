import { ArrowRight, Network, TrendingUp, Users, Target, Megaphone } from 'lucide-react';
import InfrastructureAnimated from '@/components/landing/InfrastructureAnimated';
import PartnerHeroCta from '@/components/partner/PartnerHeroCta';
import PartnerContactForm from '@/components/partner/PartnerContactForm';
import '@/styles/pages/Landing.css';
import '@/styles/pages/PartnerV2.css';

/**
 * Partner marketing page — static SSR copy (Vite PartnerV2).
 * Client islands: hero CTA scroll, InfrastructureAnimated, contact form.
 */
export default function PartnerPageContent() {
  return (
    <div className="ld-v4-page">
      <section className="ld-v4-hero" style={{ minHeight: 'auto', paddingBottom: '100px' }}>
        <div className="ld-v4-hero-text">
          <div className="ld-v4-tag">For Brands & Agencies</div>
          <h1 className="ld-v4-title">
            Partner With <br />
            <span className="ld-v4-outline">Monteeq.</span>
          </h1>
          <p className="ld-v4-subtitle">
            Turn your raw assets into engaging, shareable videos that drive real growth across our
            global network of editors.
          </p>
          <div className="ld-v4-cta-wrap">
            <PartnerHeroCta className="ld-v4-main-btn">
              Start a Campaign <ArrowRight size={18} />
            </PartnerHeroCta>
          </div>
        </div>
      </section>

      <section className="ld-v4-performance" style={{ background: '#050505' }}>
        <div className="ld-v4-container">
          <div className="ld-v4-perf-header">
            <div className="ld-v4-tag">Ecosystem</div>
            <h2>
              Where Brands Meet <span className="ld-v4-outline">Talent.</span>
            </h2>
            <p>Every brand has a story that deserves to go viral.</p>
          </div>

          <div className="ld-v4-perf-grid">
            {[
              {
                icon: <Network />,
                title: 'Content Bridge',
                text: 'The bridge between your brand and a network of world-class video editors.',
              },
              {
                icon: <Users />,
                title: 'Viral Community',
                text: 'Short-form, high-impact content that thrives on a global scale.',
              },
              {
                icon: <TrendingUp />,
                title: 'Engagement Growth',
                text: 'Drive real interaction, shares, and measurable follower growth through creative art.',
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
      </section>

      <section className="ld-v4-showcase">
        <div className="ld-v4-split">
          <div className="ld-v4-split-visual">
            <InfrastructureAnimated />
          </div>
          <div className="ld-v4-split-text">
            <div className="ld-v4-tag">Collaboration</div>
            <h2>
              Partnership <br />
              Models.
            </h2>
            <p>Pick the path that aligns with your brand&apos;s unique goals.</p>
            <div className="pt-v4-options">
              <div className="pt-v4-option">
                <Target className="text-red" size={24} />
                <div>
                  <h4>Sponsored Challenges</h4>
                  <p>
                    Encourage editors to create content around your product for a prize. Generates
                    high-quality assets.
                  </p>
                </div>
              </div>
              <div className="pt-v4-option">
                <Megaphone className="text-red" size={24} />
                <div>
                  <h4>Brand Promotion</h4>
                  <p>
                    Partner with editors for a direct promotional campaign across the platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ld-v4-performance" id="contact" style={{ background: '#000' }}>
        <div className="ld-v4-container">
          <div className="ld-v4-perf-header">
            <div className="ld-v4-tag">Get in Touch</div>
            <h2>
              Start a <span className="ld-v4-outline">Conversation.</span>
            </h2>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              Or reach out directly at{' '}
              <a
                href="mailto:hello@monteeq.com"
                style={{
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                hello@monteeq.com
              </a>
            </p>
          </div>

          <div className="pt-v4-form-card">
            <PartnerContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
