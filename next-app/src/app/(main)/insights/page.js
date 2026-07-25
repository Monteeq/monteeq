import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/InsightsPage';

export async function generateMetadata() {
  return {
    title: { absolute: 'Insights | Creator Studio' },
    description: 'Creator insights and studio analytics on Monteeq.',
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
