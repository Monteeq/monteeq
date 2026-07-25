import PostsFeed from '@/components/posts/PostsFeed';
import { getPosts } from '@/lib/api';

export const dynamic = 'force-dynamic';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

export async function generateMetadata() {
  const canonical = `${siteOrigin()}/posts`;
  const title = 'Community Feed';
  const description =
    'Join the conversation on Monteeq. Share updates, images, and thoughts with the creator community.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Community Feed | Monteeq',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Community Feed | Monteeq',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PostsPage() {
  // Backend caps limit at 3
  const posts = await getPosts({ skip: 0, limit: 3 }).catch(() => []);

  return <PostsFeed initialPosts={Array.isArray(posts) ? posts : []} />;
}
