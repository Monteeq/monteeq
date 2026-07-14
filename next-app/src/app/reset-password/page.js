import { Suspense } from 'react';
import GuestOnly from '@/components/auth/GuestOnly';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

/** TITLE_MAP: 'Reset Password | Monteeq' — auth pages are noindex */
export async function generateMetadata() {
  return {
    title: 'Reset Password',
    description: 'Set a new password for your Monteeq account.',
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordPage() {
  return (
    <GuestOnly>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </GuestOnly>
  );
}
