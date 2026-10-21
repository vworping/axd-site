import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The generator owns the explorer; only the shared portfolio background is
// added here. Normal site builds use the saved snapshot without the source repo.
const site = new URL('./', import.meta.url);
const project = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]) + '/')
  : new URL('../../perceptual-palette-drift/', site);
const source = new URL('docs/constellation/', project);
const output = new URL('constellation/', site);
let html = await readFile(new URL('index.html', source), 'utf8');
for (const marker of ['</head>', '<body>', 'id="palette-selection"', 'id="about-project"', 'const sequence = shuffled(nodes);']) {
  if (!html.includes(marker)) throw new Error(`Missing source marker ${marker}; review the generator before syncing.`);
}
html = html.replace('</head>', '  <link rel="stylesheet" href="../ambient-gradient.css">\n  <script src="../ambient-gradient.js" defer></script>\n</head>')
  .replace('<body>', '<body class="ambient-gradient">');
const files = new Map([['index.html', Buffer.from(html)]]);
async function collectAssets(directory, relative = 'assets/') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const name = relative + entry.name;
    if (entry.isDirectory()) await collectAssets(new URL(entry.name + '/', directory), name + '/');
    else if (/\.(jpe?g|png|webp|svg|ttf|woff2?|txt)$/i.test(entry.name)) {
      files.set(name, await readFile(new URL(entry.name, directory)));
    }
  }
}
await collectAssets(new URL('assets/', source));
let changed = 0;
// Gather the public HTML and assets before writing. Research files stay local.
for (const [name, content] of files) {
  const target = new URL(name, output);
  const previous = await readFile(target).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (previous?.equals(content)) continue;
  await mkdir(new URL('./', target), { recursive: true });
  await writeFile(target, content);
  changed++;
}
console.log(`Synced Constellation: ${changed} changed files; ${files.size} public files checked.`);
