import React from 'react';
import Section from './Section';
import { Target, MessageSquare, Megaphone, Check } from 'lucide-react';

const Options = () => {
  const options = [
    {
      icon: <Target />,
      title: "Sponsored Challenges",
      description: "Encourage editors to create content around your product for a prize. This generates high-quality assets and massive buzz.",
      benefits: ["High engagement", "Viral opportunity", "Authentic content"]
    },
    {
      icon: <Megaphone />,
      title: "Brand Promotion",
      description: "Partner with editors for a more direct promotional campaign across our entire platform.",
      benefits: ["Editor access", "Brand awareness", "Consistent styling"]
    },
    {
      icon: <MessageSquare />,
      title: "Content Collaboration",
      description: "Co-create content with our community for unique experiences that resonate with the Monteeq audience.",
      benefits: ["Unique ideas", "Native placement", "Creative synergy"]
    }
  ];

  return (
    <Section>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h2 className="partner-hero-title" style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Partnership Options</h2>
        <p className="partner-hero-desc" style={{ marginBottom: 0 }}>
          Choose the partnership model that best aligns with your brand's unique goals.
        </p>
      </div>

      <div className="partner-card-grid">
        {options.map((option, i) => (
          <div key={i} className="partner-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="partner-card-icon" style={{ color: 'var(--partner-primary)' }}>
              {option.icon}
            </div>
            <h3 className="partner-card-title">{option.title}</h3>
            <p style={{ color: 'var(--partner-text-gray)', lineHeight: 1.6, flexGrow: 1, marginBottom: '2rem' }}>{option.description}</p>
            
            <ul className="partner-list">
              {option.benefits.map((benefit, j) => (
                <li key={j} className="partner-list-item">
                  <div className="partner-list-icon">
                    <Check size={12} />
                  </div>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default Options;
