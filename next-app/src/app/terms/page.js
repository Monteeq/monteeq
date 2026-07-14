import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import '@/styles/pages/Legal.css';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

/** TITLE_MAP: 'Terms of Service | Monteeq' (root template appends | Monteeq) */
export async function generateMetadata() {
  const canonical = `${siteOrigin()}/terms`;
  const description =
    'Welcome to Monteeq. By accessing or using our platform, you agree to comply with and be bound by the following terms and conditions.';

  return {
    title: 'Terms of Service',
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Terms of Service | Monteeq',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'Terms of Service | Monteeq',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default function TermsPage() {
  return (
    <div className="legal-container">
      <Link href="/signup" className="legal-back">
        <ArrowLeft size={18} />
        Back to Sign Up
      </Link>

      <div className="legal-card">
        <div className="legal-header">
          <FileText size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 20px' }} />
          <h1>Terms of Service</h1>
          <p>Last updated: April 25, 2026</p>
        </div>

        <div className="legal-content">
          <p>
            Welcome to Monteeq. By accessing or using our platform, you agree to comply with and be
            bound by the following terms and conditions.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account or using Monteeq, you agree to these Terms of Service and our
            Privacy Policy. If you do not agree to these terms, you may not use the platform.
          </p>

          <h2>2. User Conduct</h2>
          <p>You are responsible for your use of the platform and for any content you post. You agree not to:</p>
          <ul>
            <li>Post content that is illegal, harmful, or violates community guidelines</li>
            <li>Infringe upon the intellectual property rights of others</li>
            <li>Attempt to gain unauthorized access to the platform or other user accounts</li>
            <li>Use the platform for any fraudulent or malicious activity</li>
          </ul>

          <h2>3. Content Ownership</h2>
          <p>
            You retain ownership of the content you upload to Monteeq. However, by posting content,
            you grant us a worldwide, non-exclusive, royalty-free license to use, display, and
            distribute your content on the platform.
          </p>

          <h2>4. Account Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account if you violate these terms or
            engage in behavior that harms the platform or other users.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            Monteeq is provided &quot;as is&quot; without any warranties. We are not liable for any
            damages arising from your use of the platform or any content posted by users.
          </p>

          <h2>6. Subscription and Payments</h2>
          <p>
            Certain features (like Monteeq Pro) require a subscription. All payments are
            non-refundable unless otherwise required by law.
          </p>

          <h2>7. Governing Law</h2>
          <p>
            These terms are governed by and construed in accordance with the laws of the jurisdiction
            in which Monteeq operates, without regard to its conflict of law principles.
          </p>
        </div>
      </div>
    </div>
  );
}
