import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/library/LikedPage';

export async function generateMetadata() {
  return {
    title: 'Liked',
    description: 'Liked',
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
