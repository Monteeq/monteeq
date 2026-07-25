import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/CreatePostPage';

export async function generateMetadata() {
  return {
    title: 'Create Post',
    description: 'Create Post',
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
