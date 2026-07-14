import { notFound } from 'next/navigation';
import PostDetailView from '@/components/posts/PostDetailView';
import { getPostById, getComments, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

function resolveDisplayPost(post) {
  return post.original_post || post;
}

function postDescription(post) {
  const text = (post.content || '').trim();
  if (text) return text.length > 160 ? `${text.slice(0, 157)}…` : text;
  return `Post by @${post.owner?.username || 'monteeq'} on Monteeq.`;
}

function buildSocialMediaPostingJsonLd(post, canonical) {
  const display = resolveDisplayPost(post);
  return {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: postDescription(display).slice(0, 110),
    articleBody: display.content || undefined,
    datePublished: display.created_at,
    url: canonical,
    image: display.image_url ? [display.image_url] : undefined,
    author: {
      '@type': 'Person',
      name: display.owner?.full_name || display.owner?.username || 'Monteeq user',
      alternateName: display.owner?.username ? `@${display.owner.username}` : undefined,
      url: display.owner?.username
        ? `${siteOrigin()}/profile/${display.owner.username}`
        : undefined,
    },
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: display.likes_count || 0,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: display.comments_count || 0,
      },
    ],
  };
}

async function loadPost(id) {
  try {
    return await getPostById(id, null);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }
}

/**
 * Schema: SocialMediaPosting (text/image posts) — not VideoObject.
 * Fields: content, image_url, owner, created_at, likes/comments counts.
 */
export async function generateMetadata({ params }) {
  const post = await loadPost(params.id);
  if (!post) {
    return { title: 'Post not found', robots: { index: false, follow: false } };
  }

  const display = resolveDisplayPost(post);
  const title = display.content?.trim()
    ? display.content.trim().slice(0, 60)
    : `Post by @${display.owner?.username || 'user'}`;
  const description = postDescription(display);
  const canonical = `${siteOrigin()}/post/${display.id}`;
  const images = display.image_url ? [{ url: display.image_url }] : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Monteeq`,
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'article',
      images,
    },
    twitter: {
      card: display.image_url ? 'summary_large_image' : 'summary',
      title: `${title} | Monteeq`,
      description,
      images: display.image_url ? [display.image_url] : [],
    },
    robots: { index: true, follow: true },
  };
}

export default async function PostDetailPage({ params }) {
  const post = await loadPost(params.id);
  if (!post) {
    notFound();
  }

  const display = resolveDisplayPost(post);
  const canonical = `${siteOrigin()}/post/${display.id}`;
  const comments = await getComments({ postId: display.id, token: null }).catch(() => []);
  const jsonLd = buildSocialMediaPostingJsonLd(post, canonical);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostDetailView
          post={post}
          initialComments={Array.isArray(comments) ? comments : []}
        />
    </>
  );
}
