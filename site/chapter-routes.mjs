export const chapterRoutes = {
  '/': { title: 'Palace', description: 'Andre Weiss — photography, research, and interactive experiences.' },
  '/constellation': { title: 'Palace: Constellation', description: 'Explore the colors connecting 150 photographs. An interactive palette wheel, photograph map, and color study by Andre Weiss.' },
  '/PET': { title: 'Palace: PET', description: 'A wearable introduction by Andre Weiss. Explore the current PET prototype and the display, NFC, and multi-person interaction questions shaping V2.' },
  '/collaborations': { title: 'Palace: Collaborations', description: 'Photography, creative process, and collaborations with Converse, ICA, and the City of Boston.' },
  '/about': { title: 'Palace: About', description: 'Meet Andre Weiss: photographer, researcher, and designer of interactive experiences.' },
};

export function chapterPath(path) {
  const clean = path.replace(/\/$/, '') || '/';
  if (['/pet', '/PET', '/pet.html', '/PET/index.html'].includes(clean)) return '/PET';
  if (clean === '/constellation/index.html') return '/constellation';
  if (['/work', '/work/index.html', '/collaborations/index.html'].includes(clean)) return '/collaborations';
  if (clean === '/index.html') return '/';
  return Object.hasOwn(chapterRoutes, clean) ? clean : null;
}

export function chapterMetadata(html, path, origin = 'https://mindofaxd.com') {
  const { title, description } = chapterRoutes[path];
  return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/g, `$1${description}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${origin}${path}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${origin}${path}`);
}
