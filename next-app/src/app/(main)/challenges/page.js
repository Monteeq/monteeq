import ChallengesView from '@/components/challenges/ChallengesView';
import { getChallenges, getChallengeLeaderboard } from '@/lib/api';

export const dynamic = 'force-dynamic';

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/$/, '');
}

/**
 * Vite Challenges is a single listing page (no /challenges/:id route).
 * On load it fetches GET /challenges/ + leaderboards for each challenge.
 * Entry status (auth) and entry upload stay client-side.
 */
async function loadChallengesPage() {
  const challenges = await getChallenges().catch(() => []);
  const list = Array.isArray(challenges) ? challenges : [];

  const leaderboardEntries = await Promise.all(
    list.map(async (c) => {
      try {
        const lb = await getChallengeLeaderboard(c.id);
        return [c.id, Array.isArray(lb) ? lb : []];
      } catch {
        return [c.id, []];
      }
    })
  );

  const initialLeaderboard = Object.fromEntries(leaderboardEntries);
  return { challenges: list, initialLeaderboard };
}

export async function generateMetadata() {
  const canonical = `${siteOrigin()}/challenges`;
  const title = 'Challenges';
  const description =
    'Compete in Monteeq video challenges. Enter themed competitions, climb the leaderboard, and win prizes and spotlights.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: 'Challenges | Monteeq',
      description,
      url: canonical,
      siteName: 'Monteeq',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Challenges | Monteeq',
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function ChallengesPage() {
  const { challenges, initialLeaderboard } = await loadChallengesPage();

  return (
    <ChallengesView
      initialChallenges={challenges}
      initialLeaderboard={initialLeaderboard}
    />
  );
}
