import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/FollowingPage';

export async function generateMetadata() {
  return {
    title: 'Following',
    description: 'Following',
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
