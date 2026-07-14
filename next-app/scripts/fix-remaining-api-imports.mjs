import fs from 'fs';
import path from 'path';

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(js|jsx|mjs)$/.test(name)) continue;
    let s = fs.readFileSync(full, 'utf8');
    const orig = s;
    s = s.replace(/from ['"]\.\.\/api['"]/g, "from '@/lib/browserApi'");
    s = s.replace(/from ['"]\.\.\/\.\.\/api['"]/g, "from '@/lib/browserApi'");
    s = s.replace(/from ['"]\.\/api['"]/g, "from '@/lib/browserApi'");
    if (s !== orig) {
      fs.writeFileSync(full, s);
      console.log('api import', full);
    }
  }
}

walk('src');
