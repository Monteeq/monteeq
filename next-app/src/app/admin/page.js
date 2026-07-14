import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/AdminPortalPage';

export async function generateMetadata() {
  return {
    title: 'Admin Portal',
    description: 'Admin Portal',
    robots: { index: false, follow: false },
  };
}

export default function RoutePage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Page />
    </ProtectedRoute>
  );
}
