import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/SettingsPage';

export async function generateMetadata() {
  return {
    title: 'Settings',
    description: 'Manage your Monteeq account settings.',
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
