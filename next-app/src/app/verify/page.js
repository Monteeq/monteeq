import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/VerifyPage';

export async function generateMetadata() {
  return {
    title: 'Verify Account',
    description: 'Verify Account',
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
