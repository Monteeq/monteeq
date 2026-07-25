import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/UploadPage';

export async function generateMetadata() {
  return {
    title: 'Upload',
    description: 'Upload videos and posts to Monteeq.',
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
