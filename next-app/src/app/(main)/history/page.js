import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/library/HistoryPage';

export async function generateMetadata() {
  return {
    title: 'History',
    description: 'History',
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
