import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/PerformancePage';

export async function generateMetadata() {
  return {
    title: { absolute: 'Performance | Analytics' },
    description: 'Performance analytics for your Monteeq content.',
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
