import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/ManageContentPage';

export async function generateMetadata() {
  return {
    title: 'Manage Videos',
    description: 'Manage Videos',
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
