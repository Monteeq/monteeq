import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/InsightsPage';

export async function generateMetadata() {
  return {
    title: 'Insights',
    description: 'Insights',
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
