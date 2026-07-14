import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/SettingsPage';

export async function generateMetadata() {
  return {
    title: 'Settings',
    description: 'Settings',
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
