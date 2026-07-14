import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/NotificationsPage';

export async function generateMetadata() {
  return {
    title: 'Notifications',
    description: 'Notifications',
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
