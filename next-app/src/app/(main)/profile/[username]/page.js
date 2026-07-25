import { notFound } from 'next/navigation';
import { getUserProfile, ApiError } from '@/lib/api';
import ProfileView from '@/components/profile/ProfileView';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

function profileTitle(profile) {
  const name = profile.full_name?.trim();
  return name ? `${name} (@${profile.username})` : `@${profile.username}`;
}

function profileDescription(profile) {
  if (profile.bio?.trim()) return profile.bio.trim();
  const name = profile.full_name || `@${profile.username}`;
  return `Watch videos from ${name} on Monteeq. ${(profile.followers_count || 0).toLocaleString()} followers.`;
}

function buildProfileJsonLd(profile, canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: profile.full_name || profile.username,
      alternateName: `@${profile.username}`,
      description: profile.bio || undefined,
      image: profile.profile_pic || undefined,
      url: canonicalUrl,
      interactionStatistic: [
        {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/FollowAction',
          userInteractionCount: profile.followers_count || 0,
        },
      ],
    },
  };
}

async function loadProfile(username) {
  try {
    return await getUserProfile(username, null);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }
}

/**
 * NEW SEO for Profile — Vite only had DynamicTitle (`@username | Monteeq`), no OG tags.
 * This adds title, description, og:image (avatar), Twitter card, and ProfilePage JSON-LD.
 */
export async function generateMetadata({ params }) {
  const { username } = params;
  const profile = await loadProfile(username);

  if (!profile) {
    return {
      title: 'Profile not found',
      robots: { index: false, follow: false },
    };
  }

  const title = profileTitle(profile);
  const description = profileDescription(profile);
  const canonical = `${siteOrigin()}/profile/${profile.username}`;
  const images = profile.profile_pic
    ? [{ url: profile.profile_pic, alt: `@${profile.username}` }]
    : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Monteeq`,
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'profile',
      images,
    },
    twitter: {
      card: 'summary',
      title: `${title} | Monteeq`,
      description,
      images: profile.profile_pic ? [profile.profile_pic] : [],
    },
    robots: { index: true, follow: true },
  };
}

export default async function ProfilePage({ params }) {
  const { username } = params;
  const profile = await loadProfile(username);

  if (!profile) {
    notFound();
  }

  const canonical = `${siteOrigin()}/profile/${profile.username}`;
  const jsonLd = buildProfileJsonLd(profile, canonical);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileView profile={profile} />
    </>
  );
}
