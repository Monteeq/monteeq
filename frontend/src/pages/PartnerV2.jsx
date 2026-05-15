import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Network, TrendingUp, Users, Target, Megaphone, Loader2 } from 'lucide-react';
import InfrastructureAnimated from '../components/landing/InfrastructureAnimated';
import './Landing.css'; // Reuse landing styles
import './PartnerV2.css';
import { submitPartnerBrief } from '../api';
import { useNotification } from '../context/NotificationContext';

const PartnerV2 = () => {
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    brand_name: '',
    contact_email: '',
    campaign_type: '',
    details: ''
  });

  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await submitPartnerBrief(formData);
      setIsSubmitted(true);
      showNotification('success', 'Brief submitted successfully! Our team will reach out soon.');
      setFormData({ brand_name: '', contact_email: '', campaign_type: '', details: '' });
    } catch (err) {
      console.error("Brief submission failed:", err);
      showNotification('error', err?.message || 'Failed to submit brief. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToContact = () => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="ld-v4-page">
      {/* ═══ HERO ═══ */}
      <section className="ld-v4-hero" style={{ minHeight: 'auto', paddingBottom: '100px' }}>
        <div className="ld-v4-hero-text">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div className="ld-v4-tag" variants={fadeInUp}>For Brands & Agencies</motion.div>
            <motion.h1 className="ld-v4-title" variants={{
              hidden: { y: 100, opacity: 0, skewY: 7 },
              visible: { y: 0, opacity: 1, skewY: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
            }}>
              Partner With <br />
              <span className="ld-v4-outline">Monteeq.</span>
            </motion.h1>
            <motion.p className="ld-v4-subtitle" variants={fadeInUp}>
              Turn your raw assets into engaging, shareable videos that drive real growth 
              across our global network of elite creators.
            </motion.p>
            <motion.div className="ld-v4-cta-wrap" variants={fadeInUp}>
              <button className="ld-v4-main-btn" onClick={scrollToContact}>
                Start a Campaign <ArrowRight size={18} />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ WHAT WE DO ═══ */}
      <section className="ld-v4-performance" style={{ background: '#050505' }}>
        <div className="ld-v4-container">
          <motion.div 
            className="ld-v4-perf-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="ld-v4-tag">Ecosystem</div>
            <h2>Where Brands Meet <span className="ld-v4-outline">Talent.</span></h2>
            <p>Every brand has a story that deserves to go viral.</p>
          </motion.div>

          <motion.div 
            className="ld-v4-perf-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              { icon: <Network />, title: "Content Bridge", text: "The bridge between your brand and a network of world-class video editors." },
              { icon: <Users />, title: "Viral Community", text: "Short-form, high-impact content that thrives on a global scale." },
              { icon: <TrendingUp />, title: "Engagement Growth", text: "Drive real interaction, shares, and measurable follower growth through creative art." }
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

      {/* ═══ PARTNERSHIP MODELS ═══ */}
      <section className="ld-v4-showcase">
        <motion.div 
          className="ld-v4-split"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div className="ld-v4-split-visual" variants={fadeInUp}>
            <InfrastructureAnimated />
          </motion.div>
          <motion.div className="ld-v4-split-text" variants={fadeInUp}>
            <div className="ld-v4-tag">Collaboration</div>
            <h2>Partnership <br />Models.</h2>
            <p>Pick the path that aligns with your brand's unique goals.</p>
            <div className="pt-v4-options">
              <div className="pt-v4-option">
                <Target className="text-red" size={24} />
                <div>
                  <h4>Sponsored Challenges</h4>
                  <p>Encourage editors to create content around your product for a prize. Generates high-quality assets.</p>
                </div>
              </div>
              <div className="pt-v4-option">
                <Megaphone className="text-red" size={24} />
                <div>
                  <h4>Brand Promotion</h4>
                  <p>Partner with our top-tier editors for a direct promotional campaign across the platform.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ CONTACT FORM ═══ */}
      <section className="ld-v4-performance" id="contact" style={{ background: '#000' }}>
        <div className="ld-v4-container">
          <motion.div 
            className="ld-v4-perf-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="ld-v4-tag">Get in Touch</div>
            <h2>Start a <span className="ld-v4-outline">Conversation.</span></h2>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              Or reach out directly at <a href="mailto:hello@monteeq.com" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>hello@monteeq.com</a>
            </p>
          </motion.div>

          <motion.div 
            className="pt-v4-form-card"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            {isSubmitted ? (
              <div className="pt-v4-success">
                <div className="pt-v4-success-icon"><Check size={32} /></div>
                <h3>Brief Received!</h3>
                <p>Our team will review your brand's vision and reach out within 48 hours.</p>
                <button onClick={() => setIsSubmitted(false)} className="ld-v4-btn-outline">
                  Send Another Brief
                </button>
              </div>
            ) : (
              <form className="pt-v4-form" onSubmit={handleContactSubmit}>
                <div className="pt-v4-form-grid">
                  <div className="pt-v4-form-group">
                    <label>Brand Name</label>
                    <input 
                      name="brand_name"
                      type="text" 
                      placeholder="e.g. Global Tech Inc." 
                      required 
                      disabled={isLoading} 
                      value={formData.brand_name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="pt-v4-form-group">
                    <label>Contact Email</label>
                    <input 
                      name="contact_email"
                      type="email" 
                      placeholder="hello@yourbrand.com" 
                      required 
                      disabled={isLoading} 
                      value={formData.contact_email}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="pt-v4-form-group">
                  <label>Campaign Type</label>
                  <select 
                    name="campaign_type"
                    required 
                    disabled={isLoading} 
                    value={formData.campaign_type}
                    onChange={handleInputChange}
                  >
                    <option value="">Select a partnership model…</option>
                    <option>Sponsored Challenges</option>
                    <option>Brand Promotion</option>
                    <option>Not sure yet</option>
                  </select>
                </div>
                <div className="pt-v4-form-group">
                  <label>Brief Details</label>
                  <textarea 
                    name="details"
                    rows={4} 
                    placeholder="Goals? Budget range? Content style?" 
                    required 
                    disabled={isLoading} 
                    value={formData.details}
                    onChange={handleInputChange}
                  />
                </div>
                <button type="submit" disabled={isLoading} className="ld-v4-main-btn">
                  {isLoading ? (
                    <>Analysing Brief... <Loader2 className="animate-spin" size={18} /></>
                  ) : (
                    <>Send Campaign Brief <ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default PartnerV2;
