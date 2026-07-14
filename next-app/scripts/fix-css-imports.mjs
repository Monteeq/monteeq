import fs from 'fs';

fs.copyFileSync(
  '../frontend/src/components/ReportVideoModal.module.css',
  'src/components/ReportVideoModal.module.css'
);
fs.copyFileSync(
  '../frontend/src/components/VideoCardMenu.module.css',
  'src/components/VideoCardMenu.module.css'
);
fs.copyFileSync(
  'src/styles/components/chat/ChatVideoPlayer.css',
  'src/components/chat/ChatVideoPlayer.css'
);

const swaps = [
  ['src/components/pages/JoinProPage.jsx', './JoinProV2.css', '@/styles/pages/JoinProV2.css'],
  [
    'src/components/pages/PerformancePage.jsx',
    './PerformanceV2.css',
    '@/styles/pages/PerformanceV2.css',
  ],
  ['src/components/pages/ChatPage.jsx', './Chat.css', '@/styles/pages/Chat.css'],
];

for (const [file, from, to] of swaps) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes(from)) {
    console.log('already ok or missing', file, from);
    continue;
  }
  fs.writeFileSync(file, s.split(from).join(to));
  console.log('fixed', file);
}
