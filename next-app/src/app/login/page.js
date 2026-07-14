import { Suspense } from 'react';
import GuestOnly from '@/components/auth/GuestOnly';
import LoginForm from '@/components/auth/LoginForm';

/** TITLE_MAP: 'Login | Monteeq' — auth pages are noindex */
export async function generateMetadata() {
  return {
    title: 'Login',
    description: 'Sign in to your Monteeq account.',
    robots: { index: false, follow: false },
  };
}

export default function LoginPage() {
  return (
    <GuestOnly>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </GuestOnly>
  );
}
