import FlashFeed from '@/components/flash/FlashFeed';
import { getVideos, getCategories, getRecommendedFeed } from '@/lib/api';

export const dynamic = 'force-dynamic';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

async function loadFlashIndex() {
  const [recommended, fallback, categories] = await Promise.all([
    getRecommendedFeed('flash', { limit: 15 }).catch(() => null),
    getVideos('flash', { skip: 0, limit: 15 }).catch(() => []),
    getCategories().catch(() => []),
  ]);

  const clips =
    Array.isArray(recommended) && recommended.length > 0
      ? recommended
      : Array.isArray(fallback)
        ? fallback
        : [];

  return {
    clips,
    categories: Array.isArray(categories) ? categories : [],
  };
}

export async function generateMetadata() {
  const canonical = `${siteOrigin()}/flash`;
  const title = 'Flash';
  const description =
    'Watch short, engaging vertical videos on Monteeq Flash. Discover the latest trends, creative edits, and amazing clips.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Flash | Monteeq',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Flash | Monteeq',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function FlashIndexPage() {
  const { clips, categories } = await loadFlashIndex();

  return <FlashFeed initialClips={clips} initialCategories={categories} />;
}
