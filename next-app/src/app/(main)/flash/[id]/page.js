import { notFound } from 'next/navigation';
import FlashFeed from '@/components/flash/FlashFeed';
import {
  getVideoById,
  getVideos,
  getCategories,
  getRecommendedFeed,
  ApiError,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

function videoDescription(video) {
  return (
    video.description ||
    `Watch ${video.title} on Monteeq Flash — short vertical video.`
  );
}

function toIsoDuration(seconds) {
  if (!seconds && seconds !== 0) return 'PT0M15S';
  const total = Math.floor(Number(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m}M${s}S`;
}

async function loadFlashDeepLink(id) {
  let target;
  try {
    target = await getVideoById(id, null);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }

  const [recommended, fallback, categories] = await Promise.all([
    getRecommendedFeed(target.video_type || 'flash', { limit: 15 }).catch(() => null),
    getVideos('flash', { skip: 0, limit: 15 }).catch(() => []),
    getCategories().catch(() => []),
  ]);

  const restRaw =
    Array.isArray(recommended) && recommended.length > 0
      ? recommended
      : Array.isArray(fallback)
        ? fallback
        : [];

  const rest = restRaw.filter((v) => String(v.id) !== String(target.id));
  const clips = [target, ...rest];

  return {
    target,
    clips,
    categories: Array.isArray(categories) ? categories : [],
  };
}

/** Same SEO pattern as Watch — title/description/ogImage + VideoObject JSON-LD. */
export async function generateMetadata({ params }) {
  const { id } = params;
  let video;
  try {
    video = await getVideoById(id, null);
  } catch {
    return { title: 'Flash video not found' };
  }

  const title = video.title;
  const description = videoDescription(video);
  const canonical = `${siteOrigin()}/flash/${video.id}`;
  const images = video.thumbnail_url ? [{ url: video.thumbnail_url }] : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Monteeq Flash`,
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'video.other',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Monteeq Flash`,
      description,
      images: video.thumbnail_url ? [video.thumbnail_url] : [],
    },
    robots: { index: true, follow: true },
  };
}

export default async function FlashVideoPage({ params }) {
  const { id } = params;
  const data = await loadFlashDeepLink(id);

  if (!data) {
    notFound();
  }

  const { target, clips, categories } = data;
  const canonical = `${siteOrigin()}/flash/${target.id}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: target.title,
    description: videoDescription(target),
    thumbnailUrl: [target.thumbnail_url].filter(Boolean),
    uploadDate: target.created_at,
    duration: toIsoDuration(target.duration),
    contentUrl: target.video_url,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'WatchAction' },
      userInteractionCount: target.views || 0,
    },
    url: canonical,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FlashFeed
          initialClips={clips}
          initialCategories={categories}
          startVideoId={target.id}
        />
    </>
  );
}
