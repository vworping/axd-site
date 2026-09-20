import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const output = new URL('./dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'layout.css', 'script.js', 'story-shelf.js', 'dialog-motion.js', 'logo-motion.js', 'photo-deck.js', 'name-motion.js', 'section-navigation.js', 'image-downloads.js', 'assets']) {
  await cp(new URL(file, root), new URL(file, output), { recursive: true, filter: path => !path.endsWith('/.DS_Store') });
}
// Source uses relative preview images so local phone sharing stays on the LAN.
// Published cards use an absolute URL, without baking a local IP into the site.
const siteURL = new URL(process.env.SITE_URL || 'https://mindofaxd.com/');
const entry = new URL('./index.html', output);
let html = await readFile(entry, 'utf8');
// Content hashes refresh edited scripts/data/styles without manual version bumps.
const references = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))(?:\?[^"]*)?"/g)];
for (const [attribute, file] of references) {
  const bytes = await readFile(new URL(file, root));
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  html = html.replaceAll(attribute, attribute.replace(/=".*"/, `="${file}?v=${hash}"`));
}
html = html.replaceAll('https://mindofaxd.com/', siteURL.href);
await writeFile(entry, html.replaceAll('content="assets/images/share-logo.png?v=13"',
  `content="${new URL('assets/images/share-logo.png?v=13', siteURL).href}"`));
await writeFile(new URL('robots.txt', output), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', siteURL).href}\n`);
await writeFile(new URL('sitemap.xml', output), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteURL.href}</loc></url></urlset>\n`);
console.log('Static portfolio built in site/dist.');
