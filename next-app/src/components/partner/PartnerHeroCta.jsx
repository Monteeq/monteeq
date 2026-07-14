'use client';

/**
 * Hero CTA — scrolls to #contact (Vite PartnerV2 scrollToContact).
 */
export default function PartnerHeroCta({ children, className }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
    >
      {children}
    </button>
  );
}
