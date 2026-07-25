import HomeFeed from '@/components/home/HomeFeed';
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

/** Matches Vite Home SEO component fields. */
export async function generateMetadata() {
  const canonical = `${siteOrigin()}/home`;
  const title = 'Home';
  const description =
    'Experience the best creative video content on Monteeq. Watch, share, and discover amazing videos from creators worldwide.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Home | Monteeq',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Home | Monteeq',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function HomePage() {
  const feed = await loadInitialFeed();

  return (
    <HomeFeed
      initialVideos={feed.videos}
      initialFlash={feed.flash}
      initialCategories={feed.categories}
    />
  );
}
