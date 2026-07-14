import AboutView from '@/components/about/AboutView';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

/** TITLE_MAP: 'About | Monteeq' (root template appends | Monteeq) */
export async function generateMetadata() {
  const canonical = `${siteOrigin()}/about`;
  const description =
    'We built Monteeq because we were tired of watching talented editors get exploited. Our mission is to give creators the platform they deserve.';

  return {
    title: 'About',
    description,
    alternates: { canonical },
    openGraph: {
      title: 'About | Monteeq',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'About | Monteeq',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default function AboutPage() {
  return <AboutView />;
}
