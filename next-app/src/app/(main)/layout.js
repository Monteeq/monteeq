import { Suspense } from 'react';
import Providers from '@/components/Providers';

export default function MainLayout({ children }) {
  return (
    <Providers>
      <Suspense fallback={null}>{children}</Suspense>
    </Providers>
  );
}
