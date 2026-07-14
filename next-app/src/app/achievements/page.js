import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/AchievementsPage';

export async function generateMetadata() {
  return {
    title: 'Achievements',
    description: 'Achievements',
    robots: { index: false, follow: false },
  };
}

export default function RoutePage() {
  return (
    <ProtectedRoute>
      <Page />
    </ProtectedRoute>
  );
}
