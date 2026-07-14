import fs from 'fs';
import path from 'path';

function fix(file, fn) {
  const p = path.join('src', file);
  if (!fs.existsSync(p)) {
    console.warn('skip', p);
    return;
  }
  let s = fs.readFileSync(p, 'utf8');
  s = fn(s);
  fs.writeFileSync(p, s);
  console.log('fixed', file);
}

// streamUrl from frontend
fs.mkdirSync('src/utils', { recursive: true });
fs.copyFileSync('../frontend/src/utils/streamUrl.js', 'src/utils/streamUrl.js');
console.log('copied streamUrl');

fix('utils/pushSubscription.js', (s) =>
  s.replace(/from ['"]\.\.\/api['"]/g, "from '@/lib/browserApi'")
);

fix('hooks/useWebSocket.js', (s) =>
  s.replace(/import\.meta\.env\.VITE_WS_HOST/g, 'process.env.NEXT_PUBLIC_WS_HOST')
);

fix('components/pages/SearchPage.jsx', (s) =>
  s
    .replace(/import\.meta\.env\.VITE_ADSENSE_CLIENT_ID/g, 'process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID')
    .replace(/import\.meta\.env\.VITE_ADSENSE_INFEED_SLOT_ID/g, 'process.env.NEXT_PUBLIC_ADSENSE_INFEED_SLOT_ID')
    .replace(
      /import\.meta\.env\.VITE_ADSENSE_INFEED_LAYOUT_KEY/g,
      'process.env.NEXT_PUBLIC_ADSENSE_INFEED_LAYOUT_KEY'
    )
);

fix('components/pages/JoinProPage.jsx', (s) =>
  s.replace(/import\.meta\.env\.VITE_STRIPE_PUBLIC_KEY/g, 'process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY')
);

fix('components/VideoCardMenuRouteListener.jsx', (s) =>
  s.replace(/from ['"]\.\.\/stores\//g, "from '@/stores/")
);

fix('components/VideoCardMenu.jsx', (s) =>
  s.replace(/from ['"]\.\.\/stores\//g, "from '@/stores/")
);

fix('services/reportService.js', (s) =>
  s.replace(/from ['"]\.\.\/types\//g, "from '@/types/")
);

fix('components/ReportVideoModal.jsx', (s) =>
  s
    .replace(/from ['"]\.\.\/services\//g, "from '@/services/")
    .replace(/from ['"]\.\.\/types\//g, "from '@/types/")
);

// Any remaining import.meta.env
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(name)) {
      let s = fs.readFileSync(full, 'utf8');
      if (s.includes('import.meta.env')) {
        s = s.replace(/import\.meta\.env\.VITE_/g, 'process.env.NEXT_PUBLIC_');
        fs.writeFileSync(full, s);
        console.log('env', full);
      }
    }
  }
}
walk('src');
