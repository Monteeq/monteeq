import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/ManageContentPage';

export async function generateMetadata() {
  return {
    title: { absolute: 'Manage Content | Studio' },
    description: 'Manage your Monteeq content in Creator Studio.',
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
