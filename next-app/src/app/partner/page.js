import PartnerPageContent from '@/components/partner/PartnerPageContent';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

/** TITLE_MAP: 'Partner with Us | Monteeq' (root template appends | Monteeq) */
export async function generateMetadata() {
  const canonical = `${siteOrigin()}/partner`;
  const description =
    'Turn your raw assets into engaging, shareable videos that drive real growth across our global network of elite creators.';

  return {
    title: 'Partner with Us',
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Partner with Us | Monteeq',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Partner with Us | Monteeq',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default function PartnerPage() {
  return <PartnerPageContent />;
}
