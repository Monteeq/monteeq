import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getVideoById, getComments, getRecommendedFeed, getVideos, getUserProfile, ApiError } from '@/lib/api';
import WatchView from '@/components/watch/WatchView';
import '@/styles/pages/WatchV2.css';

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
    `Watch ${video.title} on Monteeq. The best video edits and creative content.`
  );
}

function toIsoDuration(seconds) {
  if (!seconds && seconds !== 0) return 'PT1M30S';
  const total = Math.floor(Number(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m}M${s}S`;
}

function buildVideoJsonLd(video, canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: videoDescription(video),
    thumbnailUrl: [video.thumbnail_url].filter(Boolean),
    uploadDate: video.created_at,
    duration: toIsoDuration(video.duration),
    contentUrl: video.video_url,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'WatchAction' },
      userInteractionCount: video.views || 0,
    },
    url: canonicalUrl,
  };
}

async function loadWatchData(id) {
  let video;
  try {
    video = await getVideoById(id, null);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }

  const [commentsResult, profileResult] = await Promise.all([
    getComments({ videoId: id, token: null }).catch(() => []),
    video.owner?.username
      ? getUserProfile(video.owner.username, null).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    video,
    comments: Array.isArray(commentsResult) ? commentsResult : [],
    followersCount: profileResult?.followers_count ?? video.owner?.followers_count ?? 0,
    isFollowing: profileResult?.is_following ?? false,
  };
}

function WatchViewSkeleton({ video, comments, followersCount, isFollowing }) {
  return (
    <WatchView
      video={video}
      comments={comments}
      relatedVideos={[]}
      initialFollowersCount={followersCount}
      initialIsFollowing={isFollowing}
    />
  );
}

async function RelatedVideosFetcher({ videoType, video, comments, followersCount, isFollowing }) {
  const type = videoType || 'home';
  let relatedVideos = [];
  try {
    const recommended = await getRecommendedFeed(type, { token: null, limit: 16 });
    if (Array.isArray(recommended) && recommended.length > 0) {
      relatedVideos = recommended;
    } else {
      relatedVideos = (await getVideos(type, { token: null, skip: 0, limit: 16 }).catch(() => [])) || [];
    }
  } catch {
    relatedVideos = [];
  }
  return (
    <WatchView
      video={video}
      comments={comments}
      relatedVideos={relatedVideos}
      initialFollowersCount={followersCount}
      initialIsFollowing={isFollowing}
    />
  );
}

export async function generateMetadata({ params }) {
  const { id } = params;
  let video;
  try {
    video = await getVideoById(id, null);
  } catch {
    return { title: 'Video not found' };
  }

  const title = video.title;
  const description = videoDescription(video);
  const canonical = `${siteOrigin()}/watch/${video.id}`;
  const images = video.thumbnail_url ? [{ url: video.thumbnail_url }] : [];
  const oembedUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || siteOrigin()}/oembed?url=${encodeURIComponent(canonical)}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      types: {
        'application/json+oembed': oembedUrl,
      },
    },
    openGraph: {
      title: `${title} | Monteeq`,
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'video.other',
      images,
      ...(video.video_url ? {
        video: video.video_url,
        'video:secure_url': video.video_url,
        'video:type': 'application/x-mpegURL',
        'video:width': 1280,
        'video:height': 720,
      } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Monteeq`,
      description,
      images: video.thumbnail_url ? [video.thumbnail_url] : [],
    },
    robots: { index: true, follow: true },
  };
}

export default async function WatchPage({ params }) {
  const { id } = params;
  const data = await loadWatchData(id);

  if (!data) {
    notFound();
  }

  const { video, comments, followersCount, isFollowing } = data;
  const canonical = `${siteOrigin()}/watch/${video.id}`;
  const jsonLd = buildVideoJsonLd(video, canonical);
  const apiOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

  return (
    <>
      <link rel="dns-prefetch" href={apiOrigin} />
      <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={
        <WatchViewSkeleton
          video={video}
          comments={comments}
          followersCount={followersCount}
          isFollowing={isFollowing}
        />
      }>
        <RelatedVideosFetcher
          videoType={video.video_type}
          video={video}
          comments={comments}
          followersCount={followersCount}
          isFollowing={isFollowing}
        />
      </Suspense>
    </>
  );
}
