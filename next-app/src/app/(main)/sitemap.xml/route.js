export const dynamic = 'force-dynamic';

function getApiOrigin() {
  return (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
}

function getFrontendOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/:\d+$/, '').replace('api.', '') ||
    'https://monteeq.com'
  ).replace(/\/+$/, '');
}

const FALLBACK_SITEMAP = (origin) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ['', '/home', '/flash', '/challenges', '/about', '/partner', '/privacy', '/terms']
    .map((p) => `  <url><loc>${origin}${p}</loc><changefreq>daily</changefreq></url>`)
    .join('\n') +
  `\n</urlset>\n`;

export async function GET() {
  const api = getApiOrigin();
  const origin = getFrontendOrigin();

  if (!api) {
    return new Response(FALLBACK_SITEMAP(origin), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  const endpoints = [
    `${api}/api/v1/seo/sitemap.xml`,
    `${api}/api/v1/seo/video-sitemap.xml`,
  ];

  try {
    const parts = await Promise.all(
      endpoints.map(async (url) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        try {
          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`${url} returned ${res.status}`);
          return await res.text();
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    const merged = mergeSitemaps(parts, origin);
    return new Response(merged, {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch {
    return new Response(FALLBACK_SITEMAP(origin), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}

function mergeSitemaps(parts, origin) {
  const urls = [];
  for (const xml of parts) {
    const matches = xml.matchAll(/<url>([\s\S]*?)<\/url>/g);
    for (const m of matches) {
      urls.push(m[0]);
    }
  }

  if (urls.length === 0) return FALLBACK_SITEMAP(origin);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    urls.join('\n') +
    `\n</urlset>\n`
  );
}
