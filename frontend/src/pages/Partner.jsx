import React, { useEffect } from 'react';
import Hero from '../components/partner/Hero';
import WhatWeDo from '../components/partner/WhatWeDo';
import HowItWorks from '../components/partner/HowItWorks';
import Benefits from '../components/partner/Benefits';
import Options from '../components/partner/Options';
import CampaignExample from '../components/partner/CampaignExample';
import ContactForm from '../components/partner/ContactForm';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

import './Partner.css';

const Partner = () => {
  const [showScrollTop, setShowScrollTop] = React.useState(false);

  // Scroll to top on mount
  useEffect(() => {
    const mainStage = document.querySelector('.main-stage');
    if (mainStage) {
      mainStage.scrollTo(0, 0);

      const handleScroll = () => {
        if (mainStage.scrollTop > 300) {
          setShowScrollTop(true);
        } else {
          setShowScrollTop(false);
        }
      };

      mainStage.addEventListener('scroll', handleScroll);
      return () => mainStage.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleBackToTop = () => {
    const mainStage = document.querySelector('.main-stage');
    if (mainStage) {
      mainStage.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="partner-page-wrapper">
      {/* Main content wrapper with staggered animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Hero onCtaClick={scrollToContact} onWatchClick={scrollToHowItWorks} />
        
        <div style={{ background: 'var(--partner-bg)' }}>
          <WhatWeDo />
          <HowItWorks />
          <Benefits />
          <Options />
          <CampaignExample />
          
          {/* Final Call to Action before form */}
          <section className="partner-section" style={{ textAlign: 'center', position: 'relative' }}>
             <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '300px', backgroundColor: 'rgba(255, 62, 62, 0.1)', borderRadius: '50%', filter: 'blur(120px)', zIndex: -10 }} />
             <h2 className="partner-hero-title">Ready to scale <br /> your brand's <span className="partner-gradient-text">reach?</span></h2>
             <p className="partner-hero-desc">
                Join dozens of brands who are already scaling their reach through the power of Monteeq editors.
             </p>
             <button 
               onClick={scrollToContact}
               className="partner-btn partner-btn-primary"
               style={{ padding: '1.5rem 4rem', fontSize: '1.25rem' }}
             >
               Partner Now
             </button>
          </section>

          <ContactForm />
        </div>

        {/* Footer info for Partner page */}
        <footer className="partner-footer">
           <div className="partner-footer-inner">
              <div className="partner-footer-logo">
                 <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: 'var(--partner-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontStyle: 'italic', fontSize: '1.25rem' }}>M</div>
                 <span style={{ fontWeight: 800, letterSpacing: '0.15em', fontSize: '1.25rem', textTransform: 'uppercase' }}>Monteeq</span>
              </div>
              <p className="partner-footer-copy">© 2026 Monteeq Platform. All rights reserved for viral growth.</p>
              <div className="partner-footer-links">
                 <a href="#" className="partner-footer-link">Twitter</a>
                 <a href="#" className="partner-footer-link">Instagram</a>
                 <a href="#" className="partner-footer-link">Discord</a>
              </div>
           </div>
        </footer>
      </motion.div>

      {/* Floating Scroll to Top */}
      <button 
        onClick={handleBackToTop}
        className={`partner-scroll-top desktop-only ${showScrollTop ? 'visible' : ''}`}
      >
        <ArrowUp size={20} />
      </button>
    </div>
  );
};

export default Partner;
