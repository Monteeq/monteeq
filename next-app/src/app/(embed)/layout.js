import { AuthProvider } from '@/context/AuthContext';

export default function EmbedLayout({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
