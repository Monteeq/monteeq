import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/SearchPage';

export async function generateMetadata() {
  return {
    title: 'Search',
    description: 'Search',
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
