import { notFound } from 'next/navigation';
import { getVideoById, ApiError } from '@/lib/api';
import VideoPlayerV2 from '@/components/player/VideoPlayerV2';
import Link from 'next/link';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

async function loadVideo(id) {
  try {
    return await getVideoById(id, null);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }
}

export async function generateMetadata({ params, searchParams }) {
  const { id } = params;
  const video = await loadVideo(id);
  if (!video) return { title: 'Video not found' };

  return {
    title: `${video.title} | Monteeq`,
    robots: { index: false, follow: false },
  };
}

export default async function EmbedPage({ params, searchParams }) {
  const { id } = params;
  const autoplay = searchParams?.autoplay === '1';
  const video = await loadVideo(id);

  if (!video) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#000',
        color: '#666',
        fontFamily: 'Inter, system-ui, sans-serif',
        gap: '0.75rem',
      }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Video unavailable</p>
        <p style={{ fontSize: '0.85rem', margin: 0, opacity: 0.5 }}>This video does not exist or has been removed.</p>
      </div>
    );
  }

  const watchUrl = `${siteOrigin()}/watch/${video.id}`;

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden',
    }}>
      <VideoPlayerV2
        src={video.video_url}
        videoId={video.id}
        title={video.title}
        creator={video.owner?.username || ''}
        poster={video.thumbnail_url}
        autoPlay={autoplay}
        url_480p={video.url_480p}
        url_720p={video.url_720p}
        url_1080p={video.url_1080p}
        url_2k={video.url_2k}
        url_4k={video.url_4k}
      />

      <Link
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          color: 'rgba(255,255,255,0.7)',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Inter, system-ui, sans-serif',
          textDecoration: 'none',
          transition: 'opacity 0.2s',
          zIndex: 50,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Monteeq
      </Link>
    </div>
  );
}
