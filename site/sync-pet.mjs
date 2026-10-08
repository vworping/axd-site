import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run from axd-site: node site/sync-pet.mjs [path/to/PET]
// The checked-in preview is a snapshot; ordinary builds need no PET checkout.
const site = new URL('./', import.meta.url);
const pet = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : new URL('../../PET/', site);
const design = new URL('design/', pet);
const output = new URL('pet-preview/', site);
const files = new Map();
let html = await readFile(new URL('pet-badge-concept.html', design), 'utf8');
const js = await readFile(new URL('pet-os.js', design), 'utf8');
const css = await readFile(new URL('pet-os.css', design), 'utf8');
const index = await readFile(new URL('index.html', site), 'utf8');
const saveDialog = index.match(/<dialog class="image-save-dialog"[\s\S]*?<\/dialog>/)?.[0];
if (!saveDialog || !html.includes('</head>') || !html.includes('</body>') || !js.includes("'pet:motion'")) {
  throw new Error('Preview integration changed. Review the source before syncing; no files were written.');
}
// Portfolio adapters stay separate and are never overwritten by this sync.
await Promise.all(['portfolio.css', 'portfolio.js'].map(file => readFile(new URL(file, output))));
html = html.replace('</head>', '<link rel="stylesheet" href="portfolio.css"></head>')
  .replace('</body>', `${saveDialog}<script src="../dialog-motion.js"></script><script src="../image-downloads.js"></script><script src="portfolio.js"></script></body>`);
files.set('index.html', html);
files.set('pet-os.js', js);
files.set('pet-os.css', css);

async function collectAssets(directory, relative = 'assets/') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = relative + entry.name;
    if (entry.isDirectory()) await collectAssets(new URL(entry.name + '/', directory), name + '/');
    else if (/\.(png|jpe?g|webp|svg|ttf|woff2?|txt)$/i.test(entry.name) && entry.name !== 'atla-logo-source.png') {
      files.set(name, await readFile(new URL(entry.name, directory)));
    }
  }
}
await collectAssets(new URL('assets/', design));
const rawData = await readFile(new URL('assets/constellation-data.js', design), 'utf8');
const data = JSON.parse(rawData.slice(rawData.indexOf('{')).trim().replace(/;$/, ''));
function publicData(value) {
  if (Array.isArray(value)) return value.map(publicData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key, item]) => !(key === 'source' && typeof item === 'string'))
    .map(([key, item]) => [key, publicData(item)]));
  return value;
}
files.set('assets/constellation-data.js', `window.PET_CONSTELLATION = ${JSON.stringify(publicData(data))};\n`);
for (const license of ['Archivo-OFL.txt', 'DMSans-OFL.txt', 'Fraunces-OFL.txt']) {
  files.set('assets/fonts/' + license, await readFile(new URL('firmware/main/fonts/' + license, pet)));
}
const manifest = Object.fromEntries([...files].map(([name, content]) => [name, createHash('sha256').update(content).digest('hex')]));
files.set('source-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
// Gather and validate everything before replacing the public snapshot.
for (const [name, content] of files) {
  const target = new URL(name, output);
  await mkdir(new URL('./', target), { recursive: true });
  await writeFile(target, content);
}
console.log(`Synced ${files.size} PET preview files; portfolio copy and adapters preserved.`);
await import('./build.mjs');
