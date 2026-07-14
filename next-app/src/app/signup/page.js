import GuestOnly from '@/components/auth/GuestOnly';
import SignupForm from '@/components/auth/SignupForm';

/** TITLE_MAP: 'Join Monteeq' — auth pages are noindex */
export async function generateMetadata() {
  return {
    title: {
      absolute: 'Join Monteeq',
    },
    description: 'Create your Monteeq account and join the creator network.',
    robots: { index: false, follow: false },
  };
}

export default function SignupPage() {
  return (
    <GuestOnly>
      <SignupForm />
    </GuestOnly>
  );
}
