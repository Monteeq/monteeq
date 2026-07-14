import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/OnboardingPage';

export async function generateMetadata() {
  return {
    title: { absolute: 'Welcome to Monteeq' },
    description: 'Welcome to Monteeq',
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
