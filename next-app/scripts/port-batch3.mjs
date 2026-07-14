/**
 * Bulk-port Vite Batch 3 source files into next-app with import path rewrites.
 * Run: node scripts/port-batch3.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FE = path.resolve(ROOT, '../frontend/src');
const NEXT = path.resolve(ROOT, 'src');

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function rewrite(content, fromFile) {
  let out = content;

  // API
  out = out.replace(/from ['"]\.\.\/\.\.\/api['"]/g, "from '@/lib/browserApi'");
  out = out.replace(/from ['"]\.\.\/api['"]/g, "from '@/lib/browserApi'");
  out = out.replace(/from ['"]\.\/api['"]/g, "from '@/lib/browserApi'");
  out = out.replace(/import\(['"]\.\.\/api['"]\)/g, "import('@/lib/browserApi')");
  out = out.replace(/import\(['"]\.\.\/\.\.\/api['"]\)/g, "import('@/lib/browserApi')");

  // Contexts / hooks / constants / lib / utils
  out = out.replace(/from ['"]\.\.\/\.\.\/context\//g, "from '@/context/");
  out = out.replace(/from ['"]\.\.\/context\//g, "from '@/context/");
  out = out.replace(/from ['"]\.\/AuthContext['"]/g, "from '@/context/AuthContext'");
  out = out.replace(/from ['"]\.\/NotificationContext['"]/g, "from '@/context/NotificationContext'");

  out = out.replace(/from ['"]\.\.\/\.\.\/hooks\//g, "from '@/hooks/");
  out = out.replace(/from ['"]\.\.\/hooks\//g, "from '@/hooks/");

  out = out.replace(/from ['"]\.\.\/\.\.\/constants\//g, "from '@/constants/");
  out = out.replace(/from ['"]\.\.\/constants\//g, "from '@/constants/");

  out = out.replace(/from ['"]\.\.\/\.\.\/lib\/format['"]/g, "from '@/lib/format'");
  out = out.replace(/from ['"]\.\.\/lib\/format['"]/g, "from '@/lib/format'");

  out = out.replace(/from ['"]\.\.\/utils\//g, "from '@/utils/");
  out = out.replace(/from ['"]\.\.\/\.\.\/utils\//g, "from '@/utils/");

  // Components (relative)
  out = out.replace(/from ['"]\.\.\/\.\.\/components\//g, "from '@/components/");
  out = out.replace(/from ['"]\.\.\/components\//g, "from '@/components/");

  // Logo asset → public
  out = out.replace(
    /import\s+logo\s+from\s+['"]\.\.\/assets\/images\/logo\.png['"];?/g,
    "const logo = '/images/logo.png';"
  );
  out = out.replace(
    /import\s+logo\s+from\s+['"]\.\.\/\.\.\/assets\/images\/logo\.png['"];?/g,
    "const logo = '/images/logo.png';"
  );

  // CSS colocated in pages → styles/pages
  out = out.replace(
    /from ['"]\.\/Following\.module\.css['"]/g,
    "from '@/styles/pages/Following.module.css'"
  );
  out = out.replace(
    /from ['"]\.\/UploadV2\.module\.css['"]/g,
    "from '@/styles/pages/UploadV2.module.css'"
  );
  out = out.replace(
    /from ['"]\.\/PerformanceV2\.css['"]/g,
    "from '@/styles/pages/PerformanceV2.css'"
  );
  out = out.replace(
    /from ['"]\.\/JoinProV2\.css['"]/g,
    "from '@/styles/pages/JoinProV2.css'"
  );
  out = out.replace(/from ['"]\.\/Chat\.css['"]/g, "from '@/styles/pages/Chat.css'");
  out = out.replace(
    /from ['"]\.\/Library\.module\.css['"]/g,
    "from '@/styles/pages/library/Library.module.css'"
  );
  out = out.replace(
    /from ['"]\.\/ChatVideoPlayer\.css['"]/g,
    "from '@/styles/components/chat/ChatVideoPlayer.css'"
  );

  // Chat local imports stay relative among chat components
  // './MessageBubble' etc. fine if all in same folder

  // Ensure client directive for page-level components
  if (
    fromFile.includes(`${path.sep}pages${path.sep}`) ||
    fromFile.includes(`${path.sep}hooks${path.sep}`) ||
    fromFile.includes(`${path.sep}components${path.sep}`) ||
    fromFile.includes(`${path.sep}context${path.sep}`)
  ) {
    if (!out.startsWith("'use client'") && !out.startsWith('"use client"')) {
      out = `'use client';\n\n${out}`;
    }
  }

  return out;
}

function copyOne(relFrom, relTo) {
  const src = path.join(FE, relFrom);
  const dest = path.join(NEXT, relTo);
  if (!fs.existsSync(src)) {
    console.warn('MISSING', relFrom);
    return;
  }
  let content = fs.readFileSync(src, 'utf8');
  content = rewrite(content, src);
  ensureDir(dest);
  fs.writeFileSync(dest, content);
  console.log('OK', relTo);
}

const MAP = [
  // hooks
  ['hooks/useLibrary.js', 'hooks/useLibrary.js'],
  ['hooks/useFeed.js', 'hooks/useFeed.js'],
  ['hooks/usePerformance.js', 'hooks/usePerformance.js'],
  ['hooks/useWatchLaterToggle.js', 'hooks/useWatchLaterToggle.js'],
  ['hooks/useComments.js', 'hooks/useComments.js'],
  ['hooks/useCrypto.js', 'hooks/useCrypto.js'],
  ['hooks/useChatDB.js', 'hooks/useChatDB.js'],
  ['hooks/useWebSocket.js', 'hooks/useWebSocket.js'],
  ['hooks/useGoogleDrive.js', 'hooks/useGoogleDrive.js'],
  ['hooks/useWindowWidth.js', 'hooks/useWindowWidth.js'],

  // shared components
  ['components/Skeleton.jsx', 'components/Skeleton.jsx'],
  ['components/VideoPreviewCard.jsx', 'components/VideoPreviewCard.jsx'],
  ['components/VideoCardMenu.jsx', 'components/VideoCardMenu.jsx'],
  ['components/VideoCardMenuRouteListener.jsx', 'components/VideoCardMenuRouteListener.jsx'],
  ['components/SEO.jsx', 'components/SEO.jsx'],
  ['components/ErrorBoundary.jsx', 'components/ErrorBoundary.jsx'],
  ['components/ReportModal.jsx', 'components/ReportModal.jsx'],
  ['components/ReportVideoModal.jsx', 'components/ReportVideoModal.jsx'],
  ['components/AchievementCelebrationModal.jsx', 'components/AchievementCelebrationModal.jsx'],
  ['components/NotificationManager.jsx', 'components/NotificationManager.jsx'],
  ['components/VirtualizedFeed.jsx', 'components/VirtualizedFeed.jsx'],

  // ads
  ['components/ads/AdSenseAd.jsx', 'components/ads/AdSenseAd.jsx'],
  ['components/ads/NativeFeedAd.jsx', 'components/ads/NativeFeedAd.jsx'],
  ['components/ads/DashboardBannerAd.jsx', 'components/ads/DashboardBannerAd.jsx'],

  // chat
  ['components/chat/ChatList.jsx', 'components/chat/ChatList.jsx'],
  ['components/chat/ChatWindow.jsx', 'components/chat/ChatWindow.jsx'],
  ['components/chat/MessageBubble.jsx', 'components/chat/MessageBubble.jsx'],
  ['components/chat/VoiceRecorder.jsx', 'components/chat/VoiceRecorder.jsx'],
  ['components/chat/ChatVideoPlayer.jsx', 'components/chat/ChatVideoPlayer.jsx'],

  // contexts extras
  ['context/ErrorContext.jsx', 'context/ErrorContext.jsx'],
  ['context/ReportContext.jsx', 'context/ReportContext.jsx'],

  // services / stores / types
  ['services/reportService.js', 'services/reportService.js'],
  ['services/feedManager.js', 'services/feedManager.js'],
  ['stores/videoCardMenuStore.js', 'stores/videoCardMenuStore.js'],
  ['types/videoCardMenu.js', 'types/videoCardMenu.js'],

  // pages → components/pages/*
  ['pages/Search.jsx', 'components/pages/SearchPage.jsx'],
  ['pages/Settings.jsx', 'components/pages/SettingsPage.jsx'],
  ['pages/Following.jsx', 'components/pages/FollowingPage.jsx'],
  ['pages/CreatePost.jsx', 'components/pages/CreatePostPage.jsx'],
  ['pages/Upload.jsx', 'components/pages/UploadPage.jsx'],
  ['pages/Chat.jsx', 'components/pages/ChatPage.jsx'],
  ['pages/ManageContent.jsx', 'components/pages/ManageContentPage.jsx'],
  ['pages/Achievements.jsx', 'components/pages/AchievementsPage.jsx'],
  ['pages/Notifications.jsx', 'components/pages/NotificationsPage.jsx'],
  ['pages/Insights.jsx', 'components/pages/InsightsPage.jsx'],
  ['pages/Performance.jsx', 'components/pages/PerformancePage.jsx'],
  ['pages/Onboarding.jsx', 'components/pages/OnboardingPage.jsx'],
  ['pages/Verify.jsx', 'components/pages/VerifyPage.jsx'],
  ['pages/JoinProV2.jsx', 'components/pages/JoinProPage.jsx'],
  ['pages/AdminPortal.jsx', 'components/pages/AdminPortalPage.jsx'],
  ['pages/PaymentCallback.jsx', 'components/pages/PaymentCallbackPage.jsx'],
  ['pages/NotFound.jsx', 'components/pages/NotFoundPage.jsx'],
  ['pages/library/History.jsx', 'components/pages/library/HistoryPage.jsx'],
  ['pages/library/WatchLater.jsx', 'components/pages/library/WatchLaterPage.jsx'],
  ['pages/library/Liked.jsx', 'components/pages/library/LikedPage.jsx'],
];

for (const [from, to] of MAP) copyOne(from, to);

// Full NotificationContext (overwrite stub)
copyOne('context/NotificationContext.jsx', 'context/NotificationContext.jsx');

console.log('Done', MAP.length + 1, 'files');
