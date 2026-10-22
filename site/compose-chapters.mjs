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
  let cHTML = constellation.match(/<main>([\s\S]*?)<\/main>/)[1] + '\n' +
    constellation.slice(constellation.indexOf('<dialog'), constellation.indexOf('<script>const DATA'));
  cHTML = cHTML.replace('<h1 id="constellation-title">Palette<br>constellation.</h1>', '<h2 id="constellation-title">Palette<br>constellation.</h2>')
    .replace('<p class="lead">Start with a color on the wheel to discover photographs with similar hues.</p>', '<p class="lead">Select a color. See where it takes you.</p>')
    .replace('<div class="palette-sculpture">', '<button class="back-link spotlight-exit" id="spotlight-exit" type="button" aria-label="Continue exploring"><span>Continue</span><span aria-hidden="true">↘</span></button><div class="palette-sculpture">');
  let cCSS = [...constellation.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
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
  await writeFile(new URL('constellation-chapter.js', output), `(() => { const chapter = document.getElementById('constellation');\n${localEvents(c.js)}\n})();\n`);

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
  let p = namespace(pHTML, await read('experience.css'), pJS + '\n' + await read('image-downloads.js'), 'p-');
  p.js = p.js.replace("document.getElementById('p-motion-toggle').click()", "document.getElementById('motion-toggle').click()")
    .replaceAll('document.querySelector(', 'chapter.querySelector(').replaceAll('document.querySelectorAll(', 'chapter.querySelectorAll(');
  p.css = p.css.replace(/\bh1\b/g, '#p-pet-title').replaceAll("url('assets/", "url('/assets/");
  await writeFile(new URL('pet-chapter.css', output), scopeCSS(p.css, '.pet-chapter'));
  await writeFile(new URL('pet-chapter.js', output), `(() => { const chapter = document.getElementById('PET');\n${localEvents(p.js)}\n})();\n`);
  return shell.replace('<!-- CONSTELLATION_CHAPTER -->', c.html).replace('<!-- PET_CHAPTER -->', p.html);
}
