import ProtectedRoute from '@/components/auth/ProtectedRoute';

/**
 * Shared helper for Batch 3 protected route pages.
 * Usage in page.js:
 *   export { generateProtectedMetadata as generateMetadata } from '@/lib/protectedPage';
 *   export default function XPage() { return protectedPage(<X />); }
 */
export function protectedPage(children, { allowedRoles } = {}) {
  return <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>;
}

export function generateProtectedMetadata({ title, description }) {
  return {
    title,
    description: description || title,
    robots: { index: false, follow: false },
  };
}
