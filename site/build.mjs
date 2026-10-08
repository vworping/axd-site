import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const output = new URL('./dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'pet.html', 'pet-preview', 'experience.css', 'pet-experience.js', 'favicon.ico', 'styles.css', 'layout.css', 'script.js', 'story-shelf.js', 'dialog-motion.js', 'logo-motion.js', 'photo-deck.js', 'name-motion.js', 'section-navigation.js', 'image-downloads.js', 'assets']) {
  await cp(new URL(file, root), new URL(file, output), { recursive: true, filter: path => !path.endsWith('/.DS_Store') });
}
// Source uses relative preview images so local phone sharing stays on the LAN.
// Published cards use an absolute URL, without baking a local IP into the site.
const siteURL = new URL(process.env.SITE_URL || 'https://mindofaxd.com/');
const pages = ['index.html', 'pet.html', 'pet-preview/index.html'];
// A new filename refreshes favicon caches when the logo changes.
const faviconPath = 'assets/images/favicon-axd.png';
const favicon = await readFile(new URL(faviconPath, root));
const faviconHash = createHash('sha256').update(favicon).digest('hex').slice(0, 12);
const publishedFavicon = `assets/images/favicon-axd-${faviconHash}.png`;
await writeFile(new URL(publishedFavicon, output), favicon);
// Keep the old PNG address working for clients with saved icon URLs.
await writeFile(new URL('assets/images/favicon.png', output), favicon);
for (const page of pages) {
  const entry = new URL(page, output);
  let html = (await readFile(entry, 'utf8')).replaceAll(faviconPath, publishedFavicon);
  // Content hashes refresh edited scripts/data/styles without manual version bumps.
  const references = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))(?:\?[^"]*)?"/g)];
  for (const [attribute, file] of references) {
    const bytes = await readFile(new URL(file, new URL(page, root)));
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    html = html.replaceAll(attribute, attribute.replace(/=".*"/, `="${file}?v=${hash}"`));
  }
  html = html.replaceAll('https://mindofaxd.com/', siteURL.href);
  await writeFile(entry, html.replaceAll('content="assets/images/share-logo.png?v=13"',
    `content="${new URL('assets/images/share-logo.png?v=13', siteURL).href}"`));
}
await writeFile(new URL('robots.txt', output), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', siteURL).href}\n`);
await writeFile(new URL('sitemap.xml', output), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(page => `<url><loc>${new URL(page === 'index.html' ? './' : page, siteURL).href}</loc></url>`).join('')}</urlset>\n`);
console.log('Static portfolio built in site/dist.');

// Hash the small inline intro bootstrap; do not allow arbitrary inline scripts.
const publishedHTML = (await Promise.all(pages.map(page => readFile(new URL(page, output), 'utf8')))).join('\n');
const scriptHashes = [...publishedHTML.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(([, source]) => `'sha256-${createHash('sha256').update(source).digest('base64')}'`);
const policy = ["default-src 'self'", `script-src 'self' https://static.cloudflareinsights.com ${scriptHashes.join(' ')}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self' https://cloudflareinsights.com", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'none'", 'upgrade-insecure-requests'].join('; ');
await writeFile(new URL('_headers', output), `/*\n  Content-Security-Policy: ${policy}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Strict-Transport-Security: max-age=2592000\n`);

// Assets fetched through a Worker binding need headers on the returned response.
const securityHeaders = Object.fromEntries((await readFile(new URL('_headers', output), 'utf8'))
  .split('\n').filter(line => line.startsWith('  ')).map(line => {
    const colon = line.indexOf(':');
    return [line.slice(2, colon), line.slice(colon + 1).trim()];
  }));
await mkdir(new URL('.generated/', root), { recursive: true });
await writeFile(new URL('.generated/security-headers.json', root), JSON.stringify(securityHeaders));
// Only the self-contained OS demo can be framed, and only by this origin.
const previewHeaders = { ...securityHeaders,
  'Content-Security-Policy': policy.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
  'X-Frame-Options': 'SAMEORIGIN',
};
await writeFile(new URL('.generated/preview-security-headers.json', root), JSON.stringify(previewHeaders));
await writeFile(new URL('_headers', output), (await readFile(new URL('_headers', output), 'utf8')) +
  ['/pet-preview/', '/pet-preview/index.html'].map(path => `${path}\n  ! Content-Security-Policy\n  ! X-Frame-Options\n  Content-Security-Policy: ${previewHeaders['Content-Security-Policy']}\n  X-Frame-Options: SAMEORIGIN\n`).join(''));
