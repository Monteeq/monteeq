import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/JoinProPage';

export async function generateMetadata() {
  return {
    title: 'Join Pro',
    description: 'Join Pro',
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
