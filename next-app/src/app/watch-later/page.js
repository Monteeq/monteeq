import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/library/WatchLaterPage';

export async function generateMetadata() {
  return {
    title: 'Watch Later',
    description: 'Watch Later',
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
