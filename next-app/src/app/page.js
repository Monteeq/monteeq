import LandingPage from '@/components/landing/LandingPage';
import RootAuthGate from '@/components/home/RootAuthGate';
import { getVideos, getCategories } from '@/lib/api';

/** Always SSR with a live first page of feed (not build-time snapshot). */
export const dynamic = 'force-dynamic';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

async function loadInitialFeed() {
  const [homeResult, flashResult, categoriesResult] = await Promise.all([
    getVideos('home', { skip: 0, limit: 20 }).catch(() => []),
    getVideos('flash', { skip: 0, limit: 18 }).catch(() => []),
    getCategories().catch(() => []),
  ]);

  const categories = Array.isArray(categoriesResult)
    ? ['All', ...categoriesResult.map((c) => c.name || c)]
    : ['All'];

  return {
    videos: Array.isArray(homeResult) ? homeResult : [],
    flash: Array.isArray(flashResult) ? flashResult : [],
    categories,
  };
}

/** Marketing SEO for logged-out `/`. Logged-in users hydrate to Home client-side. */
export async function generateMetadata() {
  const canonical = `${siteOrigin()}/`;
  const title = 'Create and Share';
  const description =
    'Monteeq is the home for the world’s top editors. Showcase your craft, compete in challenges, and grow with quality-first discovery.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Monteeq | Create and Share',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
      images: [{ url: `${siteOrigin()}/images/logo.png` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Monteeq | Create and Share',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootPage() {
  // Prefetch feed so logged-in users can hydrate Home without a blank first paint.
  // Crawlers / logged-out users still get Landing as the primary SSR content.
  const feed = await loadInitialFeed();

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Monteeq',
    url: siteOrigin(),
    logo: `${siteOrigin()}/images/logo.png`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <RootAuthGate
          initialVideos={feed.videos}
          initialFlash={feed.flash}
          initialCategories={feed.categories}
        >
          <LandingPage />
        </RootAuthGate>
    </>
  );
}
