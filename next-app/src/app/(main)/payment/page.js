import { Suspense } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '@/components/pages/PaymentCallbackPage';

export async function generateMetadata() {
  return {
    title: 'Payment',
    description: 'Payment',
    robots: { index: false, follow: false },
  };
}

export default function RoutePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </ProtectedRoute>
  );
}
