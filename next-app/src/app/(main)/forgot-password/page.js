import GuestOnly from '@/components/auth/GuestOnly';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

/** TITLE_MAP: 'Reset Password | Monteeq' — auth pages are noindex */
export async function generateMetadata() {
  return {
    title: 'Reset Password',
    description: 'Request a password reset link for your Monteeq account.',
    robots: { index: false, follow: false },
  };
}

export default function ForgotPasswordPage() {
  return (
    <GuestOnly>
      <ForgotPasswordForm />
    </GuestOnly>
  );
}
