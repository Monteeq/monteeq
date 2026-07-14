import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/ChatPage';

export async function generateMetadata() {
  return {
    title: 'Messages',
    description: 'Messages',
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
