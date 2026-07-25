import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/FollowingPage';

export async function generateMetadata() {
  return {
    title: 'Following',
    description: 'Videos from creators you follow on Monteeq.',
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
