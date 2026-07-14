'use client';

import { useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { submitPartnerBrief } from '@/lib/clientApi';
import { useNotification } from '@/context/NotificationContext';

/**
 * Partner campaign brief form — port of PartnerV2 contact section interactivity.
 */
export default function PartnerContactForm() {
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({
    brand_name: '',
    contact_email: '',
    campaign_type: '',
    details: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);
    try {
      await submitPartnerBrief(formData);
      setIsSubmitted(true);
      showNotification('success', 'Brief submitted successfully! Our team will reach out soon.');
      setFormData({ brand_name: '', contact_email: '', campaign_type: '', details: '' });
    } catch (err) {
      console.error('Brief submission failed:', err);
      const msg = err?.message || 'Failed to submit brief. Please try again.';
      setFormError(msg);
      showNotification('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="pt-v4-success">
        <div className="pt-v4-success-icon">
          <Check size={32} />
        </div>
        <h3>Brief Received!</h3>
        <p>Our team will review your brand&apos;s vision and reach out within 48 hours.</p>
        <button
          type="button"
          onClick={() => setIsSubmitted(false)}
          className="ld-v4-btn-outline"
        >
          Send Another Brief
        </button>
      </div>
    );
  }

  return (
    <form className="pt-v4-form" onSubmit={handleContactSubmit}>
      <div className="pt-v4-form-grid">
        <div className="pt-v4-form-group">
          <label htmlFor="brand_name">Brand Name</label>
          <input
            id="brand_name"
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
          <label htmlFor="contact_email">Contact Email</label>
          <input
            id="contact_email"
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
        <label htmlFor="campaign_type">Campaign Type</label>
        <select
          id="campaign_type"
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
        <label htmlFor="details">Brief Details</label>
        <textarea
          id="details"
          name="details"
          rows={4}
          placeholder="Goals? Budget range? Content style?"
          required
          disabled={isLoading}
          value={formData.details}
          onChange={handleInputChange}
        />
      </div>
      {formError && (
        <p style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', margin: 0 }}>{formError}</p>
      )}
      <button type="submit" disabled={isLoading} className="ld-v4-main-btn">
        {isLoading ? (
          <>
            Analysing Brief... <Loader2 className="animate-spin" size={18} />
          </>
        ) : (
          <>
            Send Campaign Brief <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );
}
