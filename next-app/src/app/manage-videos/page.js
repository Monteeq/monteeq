import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/ManageContentPage';

export async function generateMetadata() {
  return {
    title: { absolute: 'Manage Videos | Studio' },
    description: 'Manage your Monteeq videos in Creator Studio.',
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
