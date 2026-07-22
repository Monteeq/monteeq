export const dynamic = 'force-dynamic';

function getApiOrigin() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL || ''
  ).replace(/\/+$/, '');
}

export async function GET() {
  const api = getApiOrigin();

  if (!api) {
    return new Response('Sitemap not configured', { status: 503 });
  }

  const sitemaps = [
    `${api}/api/v1/seo/sitemap.xml`,
    `${api}/api/v1/seo/video-sitemap.xml`,
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemaps
      .map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`)
      .join('\n') +
    `\n</sitemapindex>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
