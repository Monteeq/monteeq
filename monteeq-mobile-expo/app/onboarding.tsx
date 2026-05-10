import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { useRouter } from 'expo-router';

export default function OnboardingRoute() {
  const router = useRouter();
  return <OnboardingScreen onFinish={() => router.replace('/(tabs)')} />;
}
