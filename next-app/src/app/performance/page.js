import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/PerformancePage';

export async function generateMetadata() {
  return {
    title: 'Performance',
    description: 'Performance',
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
