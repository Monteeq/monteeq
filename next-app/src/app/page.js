import LandingPage from '@/components/landing/LandingPage';
import RootAuthGate from '@/components/home/RootAuthGate';
import { getVideos, getCategories, getPublicStats } from '@/lib/api';

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

function formatMetaStat(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(num);
}

/** Marketing SEO for logged-out `/`. Logged-in users hydrate to Home client-side. */
export async function generateMetadata() {
  const canonical = `${siteOrigin()}/`;
  const title = 'Home for Top Editors';
  const stats = await getPublicStats().catch(() => null);
  const liveBits = [];
  if (stats?.creators) liveBits.push(`${formatMetaStat(stats.creators)} editors`);
  if (stats?.videos) liveBits.push(`${formatMetaStat(stats.videos)} videos`);
  if (stats?.views) liveBits.push(`${formatMetaStat(stats.views)} views`);
  const description = liveBits.length
    ? `Monteeq — home to ${liveBits.join(', ')}. Discovery that rewards real engagement over empty views. Challenges, Insights, and tools built for video editors.`
    : 'Monteeq is the platform for video editors. Quality-weighted discovery, competitive challenges, and creator insights — so your craft owns the audience.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Monteeq | Home for Top Editors',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
      images: [{ url: `${siteOrigin()}/images/logo.png` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Monteeq | Home for Top Editors',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootPage() {
  const [feed, stats] = await Promise.all([
    loadInitialFeed(),
    getPublicStats().catch(() => null),
  ]);

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
          <LandingPage stats={stats} />
        </RootAuthGate>
    </>
  );
}
