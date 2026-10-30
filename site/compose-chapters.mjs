import { readFile, writeFile } from 'node:fs/promises';

// Keep the original project snapshots editable, but publish their content in
// one document. IDs, styles, and image-export listeners stay chapter-local.
const site = new URL('./', import.meta.url);
const read = path => readFile(new URL(path, site), 'utf8');
const escapeRE = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function scopeCSS(source, scope) {
  source = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let result = '', position = 0;
  while (position < source.length) {
    const start = source.indexOf('{', position);
    if (start < 0) { result += source.slice(position); break; }
    const selector = source.slice(position, start).trim();
    let end = start + 1, depth = 1, quote = '';
    for (; end < source.length && depth; end++) {
      const char = source[end];
      if (quote) { if (char === quote && source[end - 1] !== '\\') quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '{') depth++;
      else if (char === '}') depth--;
    }
    const body = source.slice(start + 1, end - 1);
    if (/^@(media|supports|container)\b/.test(selector)) result += `${selector}{${scopeCSS(body, scope)}}\n`;
    else if (selector.startsWith('@')) result += `${selector}{${body}}\n`;
    else {
      const selectors = selector.split(/,(?![^()]*\))/).map(value => {
        value = value.trim();
        if (/^(:root|html|body)\b/.test(value) || value.startsWith(':root')) {
          return value.replace(/^(:root|html|body)/, scope);
        }
        return `${scope} ${value}`;
      });
      result += `${selectors.join(',')}{${body}}\n`;
    }
    position = end;
  }
  // Animation names are global even when their selectors are scoped.
  const names = [...result.matchAll(/@keyframes\s+([\w-]+)/g)].map(match => match[1]);
  for (const name of names) result = result.replace(new RegExp(`\\b${escapeRE(name)}\\b`, 'g'), `${scope.slice(1)}-${name}`);
  return result;
}

function namespace(html, css, js, prefix) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  for (const id of ids) {
    html = html.replaceAll(`id="${id}"`, `id="${prefix}${id}"`)
      .replaceAll(`href="#${id}"`, `href="#${prefix}${id}"`)
      .replaceAll(`for="${id}"`, `for="${prefix}${id}"`)
      .replaceAll(`data-save-image="${id}"`, `data-save-image="${prefix}${id}"`);
    css = css.replace(new RegExp(`#${escapeRE(id)}(?![\\w-])`, 'g'), `#${prefix}${id}`);
    js = js.replace(new RegExp(`#${escapeRE(id)}(?![\\w-])`, 'g'), `#${prefix}${id}`);
  }
  html = html.replace(/(aria-labelledby|aria-describedby)="([^"]+)"/g,
    (_, attr, value) => `${attr}="${value.split(' ').map(id => ids.includes(id) ? prefix + id : id).join(' ')}"`);
  js = js.replace(/document\.getElementById\((['"])([^'"]+)\1\)/g,
    (_, quote, id) => `document.getElementById('${prefix}${id}')`);
  return { html, css, js };
}

function localEvents(js) {
  return js.replace(/document\.addEventListener\((['"])(?!axd:|visibilitychange)([^'"]+)\1/g, "chapter.addEventListener('$2'");
}

export async function composeChapters(shell, output) {
  const constellation = await read('constellation/index.html');
  const studyCSS = await read('case-studies.css');
  const studyJS = await read('case-studies.js');
  // Keep editorial content outside the generated explorer snapshot so syncing
  // the visualization cannot replace the portfolio's case study.
  const studyMarker = /<section class="project-story"[\s\S]*?<\/section>/;
  if (!studyMarker.test(constellation)) throw new Error('Constellation story marker changed; review composition.');
  const data = JSON.parse(constellation.match(/<script>const DATA = ([^\n]+);/)[1]);
  // Build-only research records: emit the illustrated findings, not a data download.
  const analysis = JSON.parse(await read('study-data/palette-analysis.json'));
  const classified = analysis.categories.flatMap(category => category.images);
  if (classified.length !== data.nodes.length || new Set(classified).size !== data.nodes.length ||
      data.nodes.some(photo => !classified.includes(photo.image))) throw new Error('Palette classifications do not match the explorer collection.');
  const paletteHTML = photo => {
    const description = photo.palette.map(color => `${color.hex}: ${(color.weight * 100).toFixed(1)}%`).join(', ');
    return `<div class="case-palette" role="img" aria-label="Extracted palette for ${photo.id}, ${photo.year}. ${description}">${photo.palette.map(color => `<span aria-hidden="true" style="flex:${color.weight};background:${color.hex}"></span>`).join('')}</div>`;
  };
  const examplePanels = analysis.categories.map((category, index) => {
    return `<div class="analysis-example" data-analysis-panel="${index}"${index ? ' hidden' : ''}>
      <div class="analysis-photos">${category.examples.map((example, number) => {
    const photo = data.nodes.find(photo => photo.image === example.image);
    if (!photo || !category.images.includes(example.image)) throw new Error(`Invalid example for ${category.label}`);
    return `<div class="analysis-photo" data-analysis-photo="${number}"${number ? ' hidden' : ''}>
      <figure class="study-polaroid" style="--photo-ratio:${photo.width / photo.height}">
        <button type="button" class="study-photo-open study-photo-window" data-analysis-open="${photo.year}/${photo.id}" aria-label="Explore photograph ${photo.id} from ${photo.year}"><img src="/constellation/${photo.src}" width="${photo.width}" height="${photo.height}" loading="lazy" alt="${example.alt}"></button>
        ${paletteHTML(photo)}<figcaption><div class="analysis-example-controls" role="group" aria-label="Examples of ${category.label}"><button type="button" data-analysis-step="-1" aria-label="Previous example"><span aria-hidden="true">←</span></button><span data-analysis-caption>${photo.id} / ${photo.year}</span><button type="button" data-analysis-step="1" aria-label="Next example"><span aria-hidden="true">→</span></button></div></figcaption>
      </figure><div class="analysis-example-note"><p>${example.caption}</p></div></div>`;
    }).join('')}</div></div>`;
  }).join('');
  const distribution = `<div class="analysis-categories"><div class="analysis-intro"><p class="analysis-heading">Read the pattern. See the photograph.</p><p class="study-print-label">Select a category to see an example / 150 photographs</p></div>
    <div class="analysis-options" role="group" aria-label="Palette analysis examples">${analysis.categories.map((category, index) => {
      const count = category.images.length, percent = count / data.nodes.length * 100;
      return `<button type="button" class="analysis-option" data-analysis-choice="${index}" aria-pressed="${!index}"><span>${category.label}<span class="distribution-track" aria-hidden="true"><span style="width:${percent}%"></span></span></span><span class="analysis-count">${count}<span>${percent.toFixed(1).replace(/\.0$/, '')}%</span></span><span class="analysis-pointer" aria-hidden="true">↗</span></button>`;
    }).join('')}</div></div><div class="analysis-print-stage">${examplePanels}<p class="sr-only" data-analysis-status role="status"></p></div>`;
  const study = (await read('constellation-story.html')).replace('<!-- STUDY_DISTRIBUTION -->', distribution).replace(/<!-- STUDY_PALETTE:(\d+)\/([\w-]+) -->/g, (_, year, id) => {
    const photo = data.nodes.find(node => String(node.year) === year && node.id === id);
    if (!photo) throw new Error(`Missing case-study photograph: ${year}/${id}`);
    return paletteHTML(photo);
  });
  let cHTML = constellation.match(/<main>([\s\S]*?)<\/main>/)[1] + '\n' +
    constellation.slice(constellation.indexOf('<dialog'), constellation.indexOf('<script>const DATA')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  cHTML = cHTML.replace(studyMarker, () => study);
  // Keep the existing motion wiring, without the redundant control beside the map.
  // Reduced-motion preferences and the portfolio's shared control still apply.
  cHTML = cHTML.replace('id="motion-toggle" aria-pressed="false"', 'id="motion-toggle" aria-pressed="false" hidden');
  cHTML = cHTML.replace(/<h1 id="constellation-title">Palette\s*<br>constellation\.<\/h1>/, '<h2 id="constellation-title">Palette<br>constellation.</h2>')
    .replace(/(<p class="eyebrow" id="collection-count">[\s\S]*?<div class="intro-links">[\s\S]*?<\/div>)/, '<div class="spotlight-context" id="spotlight-context" inert><div class="spotlight-context-inner">$1</div></div>')
    .replace('<div class="intro-links">', '<div class="intro-links project-intro-actions">')
    .replace('<p class="lead">Start with a color on the wheel to discover photographs with similar hues.</p>', '<p class="lead">Select a color. See where it takes you.</p>')
    .replace('<div class="palette-sculpture">', '<button class="back-link spotlight-exit" id="spotlight-exit" type="button" aria-label="Continue exploring"><span>Continue</span><span aria-hidden="true">↘</span></button><div class="palette-sculpture">');
  let cCSS = [...constellation.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n') + '\n' + studyCSS;
  let cJS = constellation.match(/<script>const DATA([\s\S]*?)<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
  // The shell owns modal animation and the motion preference for every chapter.
  const helperStart = cJS.indexOf('(() => {');
  const helperEnd = cJS.indexOf('// Place the four active labels');
  if (helperStart < 0 || helperEnd < helperStart) throw new Error('Constellation dialog helper changed; review composition.');
  cJS = cJS.slice(0, helperStart) + cJS.slice(helperEnd);
  cJS = cJS.replace('const $ = id => document.getElementById(id);', "const $ = id => document.getElementById('c-' + id);")
    .replaceAll('document.body.classList', 'chapter.classList')
    .replace("document.dispatchEvent(new CustomEvent('axd:motion', { detail: { paused: motionPaused } }));", '')
    .replace("$('motion-toggle').addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); });",
      "$('motion-toggle').addEventListener('click', () => document.getElementById('motion-toggle').click());\ndocument.addEventListener('axd:motion', event => { motionPaused = event.detail.paused; updateMotion(); });");
  // All original image addresses are relative to the explorer snapshot.
  cJS = cJS.replaceAll('"src":"assets/', '"src":"/constellation/assets/');
  let c = namespace(cHTML, cCSS, cJS, 'c-');
  // namespace intentionally leaves the dynamic $ helper alone.
  c.js = c.js.replace("document.getElementById('c-motion-toggle').click()", "document.getElementById('motion-toggle').click()");
  c.css = c.css.replace(/\bh1\b/g, '#c-constellation-title').replaceAll("url('assets/", "url('/constellation/assets/").replaceAll('url("assets/', 'url("/constellation/assets/');
  await writeFile(new URL('constellation-chapter.css', output), scopeCSS(c.css, '.constellation-chapter'));
  await writeFile(new URL('constellation-chapter.js', output), `(() => { const chapter = document.getElementById('constellation');\n${localEvents(c.js)}\n${studyJS}\ninitCaseStudy(nodes, openFocus);\n})();\n`);

  const pet = await read('pet.html');
  let pHTML = pet.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1] + '\n' + pet.slice(pet.indexOf('<dialog'), pet.indexOf('</body>'));
  pHTML = pHTML.replace('<h1 id="pet-title">[pet.]</h1>', '<h2 id="pet-title">[pet.]</h2>')
    .replaceAll('src="assets/', 'src="/assets/').replace('src="pet-preview/index.html"', 'src="/pet-preview/index.html"');
  let pJS = await read('pet-experience.js');
  pJS = pJS.replaceAll('document.body.classList', 'chapter.classList')
    .replace('paused: paused || document.hidden', 'paused: paused || document.hidden || chapter.inert')
    .replace("document.dispatchEvent(new CustomEvent('axd:motion', { detail: { paused } }));", '')
    .replace("motion.addEventListener('click', () => { paused = !paused; updateMotion(); });",
      "motion.addEventListener('click', () => document.getElementById('motion-toggle').click());\ndocument.addEventListener('axd:motion', event => { paused = event.detail.paused; updateMotion(); });\ndocument.addEventListener('axd:chapter', updateMotion);");
  let p = namespace(pHTML, await read('experience.css') + '\n' + studyCSS, pJS + '\n' + await read('image-downloads.js'), 'p-');
  p.js = p.js.replace("document.getElementById('p-motion-toggle').click()", "document.getElementById('motion-toggle').click()")
    .replaceAll('document.querySelector(', 'chapter.querySelector(').replaceAll('document.querySelectorAll(', 'chapter.querySelectorAll(');
  p.css = p.css.replace(/\bh1\b/g, '#p-pet-title').replaceAll("url('assets/", "url('/assets/");
  await writeFile(new URL('pet-chapter.css', output), scopeCSS(p.css, '.pet-chapter'));
  await writeFile(new URL('pet-chapter.js', output), `(() => { const chapter = document.getElementById('PET');\n${localEvents(p.js)}\n${studyJS}\ninitCaseStudy();\n})();\n`);
  return shell.replace('<!-- CONSTELLATION_CHAPTER -->', c.html).replace('<!-- PET_CHAPTER -->', p.html);
}
