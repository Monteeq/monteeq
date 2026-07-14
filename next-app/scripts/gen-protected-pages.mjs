import fs from 'fs';
import path from 'path';

const routes = [
  { route: 'search', title: 'Search', comp: 'SearchPage' },
  { route: 'settings', title: 'Settings', comp: 'SettingsPage' },
  { route: 'following', title: 'Following', comp: 'FollowingPage' },
  { route: 'create-post', title: 'Create Post', comp: 'CreatePostPage' },
  { route: 'upload', title: 'Upload', comp: 'UploadPage' },
  { route: 'chat', title: 'Messages', comp: 'ChatPage' },
  { route: 'manage', title: 'Manage Content', comp: 'ManageContentPage' },
  { route: 'manage-videos', title: 'Manage Videos', comp: 'ManageContentPage' },
  { route: 'achievements', title: 'Achievements', comp: 'AchievementsPage' },
  { route: 'notifications', title: 'Notifications', comp: 'NotificationsPage' },
  { route: 'insights', title: 'Insights', comp: 'InsightsPage' },
  { route: 'performance', title: 'Performance', comp: 'PerformancePage' },
  {
    route: 'onboarding',
    title: 'Welcome to Monteeq',
    comp: 'OnboardingPage',
    absolute: true,
  },
  { route: 'verify', title: 'Verify Account', comp: 'VerifyPage' },
  { route: 'pro', title: 'Join Pro', comp: 'JoinProPage' },
  {
    route: 'admin',
    title: 'Admin Portal',
    comp: 'AdminPortalPage',
    roles: ['admin'],
  },
  { route: 'payment', title: 'Payment', comp: 'PaymentCallbackPage' },
  { route: 'history', title: 'History', comp: 'library/HistoryPage' },
  { route: 'watch-later', title: 'Watch Later', comp: 'library/WatchLaterPage' },
  { route: 'liked', title: 'Liked', comp: 'library/LikedPage' },
];

for (const r of routes) {
  const importPath = `@/components/pages/${r.comp}`;
  const titleLine = r.absolute
    ? `title: { absolute: '${r.title}' },`
    : `title: '${r.title}',`;
  const rolesProp = r.roles
    ? ` allowedRoles={[${r.roles.map((x) => `'${x}'`).join(', ')}]}`
    : '';

  const body = `import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Page from '${importPath}';

export async function generateMetadata() {
  return {
    ${titleLine}
    description: '${r.title}',
    robots: { index: false, follow: false },
  };
}

export default function RoutePage() {
  return (
    <ProtectedRoute${rolesProp}>
      <Page />
    </ProtectedRoute>
  );
}
`;

  const dir = path.join('src/app', r.route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.js'), body);
  console.log('page', r.route);
}

fs.writeFileSync(
  'src/app/not-found.js',
  `import NotFoundPage from '@/components/pages/NotFoundPage';

export default function NotFound() {
  return <NotFoundPage />;
}
`
);
console.log('not-found');
