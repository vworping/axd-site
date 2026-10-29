import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('about-portraits.js', import.meta.url), 'utf8');
const data = await readFile(new URL('assets/data/about-portraits.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function gallery({ reduced = false, paused = false } = {}) {
  const effects = [], loads = new Map();
  function node() {
    const events = new Map(), attributes = new Map();
    return {
      style: {}, children: [], hidden: false,
      addEventListener(type, fn) { events.set(type, fn); },
      emit(type, event = {}) { return events.get(type)?.(event); },
      setAttribute(k, v) { attributes.set(k, v); },
      getAttribute(k) { return attributes.get(k); },
      removeAttribute(k) { attributes.delete(k); },
      append(child) { this.children.push(child); child.parentElement = this; },
      replaceChildren(...children) { this.children = children; },
      remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); },
      cloneNode() { return Object.assign(node(), { src: this.src }); },
      animate(keyframes, timing) {
        let resolve;
        const effect = { keyframes, timing, cancelled: false, finished: new Promise(done => { resolve = done; }),
          finish() { resolve(); }, cancel() { this.cancelled = true; resolve(); } };
        effects.push(effect);
        return effect;
      },
    };
  }
  const ids = Object.fromEntries(['about-portrait','about','portrait-palette','portrait-status','motion-toggle','portrait-prev','portrait-next'].map(id => [id, node()]));
  const stage = node(), card = node(), controls = node();
  card.querySelector = () => controls;
  const image = ids['about-portrait'];
  image.closest = () => card;
  image.sizes = '35vw';
  stage.append(image);
  ids['motion-toggle'].setAttribute('aria-pressed', String(paused));
  ids.about.inert = false;
  const document = Object.assign(node(), { getElementById: id => ids[id], createElement: node });
  const window = node(), media = Object.assign(node(), { matches: reduced });
  runInNewContext(data, { window });
  Object.assign(image, window.ABOUT_PORTRAITS[0]);
  class Image {
    decode() {
      return new Promise((resolve, reject) => { loads.set(this.src, { resolve, reject }); });
    }
  }
  runInNewContext(source, { window, document, Image, matchMedia: () => media });
  return { ids, card, stage, image, effects, document, media, photos: window.ABOUT_PORTRAITS,
    next: () => ids['portrait-next'].emit('click'), prev: () => ids['portrait-prev'].emit('click'),
    load: async (i, fail = false) => { const pending = loads.get(window.ABOUT_PORTRAITS[i].src); assert.ok(pending); pending[fail ? 'reject' : 'resolve'](); await flush(); },
    finish: async () => { effects.forEach(effect => effect.finish()); await flush(); },
  };
}

test('decodes before replacing the portrait, then synchronizes image, palette, and announcement', async () => {
  const g = gallery();
  g.next();
  assert.equal(g.image.src, g.photos[0].src);
  await g.load(1);
  assert.equal(g.image.src, g.photos[1].src);
  assert.equal(g.image.alt, g.photos[1].alt);
  assert.equal(g.ids['portrait-palette'].children[0].style.backgroundColor, g.photos[1].palette[0].hex);
  assert.match(g.ids['portrait-status'].textContent, /Rain.*2 of 3/);
  assert.equal(g.stage.children.length, 2);
  assert.equal(g.stage.children[1].getAttribute('aria-hidden'), 'true');
  await g.finish();
  assert.equal(g.stage.children.length, 1);
});

test('rapid requests cannot replace the latest choice with an older decoded image', async () => {
  const g = gallery();
  g.next(); g.next();
  await g.load(2);
  await g.load(1);
  assert.equal(g.image.src, g.photos[2].src);
  await g.finish();
  assert.equal(g.stage.children.length, 1);
});

test('a failed next image preserves the current photo and finishes outgoing cleanup', async () => {
  const g = gallery();
  g.next(); await g.load(1);
  g.next(); await g.load(2, true);
  await g.finish();
  assert.equal(g.image.src, g.photos[1].src);
  assert.equal(g.stage.children.length, 1);
  assert.match(g.ids['portrait-status'].textContent, /could not load/);
  g.next(); await g.load(2);
  assert.equal(g.image.src, g.photos[2].src);
});

test('reduced motion and paused motion update photographs without animated effects', async () => {
  for (const option of [{ reduced: true }, { paused: true }]) {
    const g = gallery(option);
    g.next(); await g.load(1);
    assert.equal(g.image.src, g.photos[1].src);
    assert.equal(g.effects.length, 0);
    assert.equal(g.stage.children.length, 1);
  }
});

test('pausing or changing motion preference settles a transition on the chosen photograph', async () => {
  for (const preference of ['pause','reduce']) {
    const g = gallery();
    g.next(); await g.load(1);
    if (preference === 'pause') g.document.emit('axd:motion', { detail: { paused: true } });
    else { g.media.matches = true; g.media.emit('change'); }
    assert.equal(g.stage.children.length, 1);
    assert.equal(g.image.src, g.photos[1].src);
    assert.ok(g.effects.every(effect => effect.cancelled));
  }
});

test('leaving About or hiding the page cancels pending choices and leaves navigation usable', async () => {
  for (const reason of ['chapter','hidden']) {
    const g = gallery();
    g.next();
    if (reason === 'chapter') g.document.emit('axd:chapter', { detail: { id: 'pet' } });
    else { g.document.hidden = true; g.document.emit('visibilitychange'); }
    await g.load(1);
    assert.equal(g.image.src, g.photos[0].src);
    g.document.hidden = false;
    g.next(); await flush();
    assert.equal(g.image.src, g.photos[1].src);
  }
});

test('arrow keys cycle both ways without navigating to another chapter', async () => {
  const g = gallery();
  let prevented = false, stopped = false;
  g.card.emit('keydown', { key: 'ArrowLeft', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  await g.load(2);
  assert.equal(g.image.src, g.photos[2].src);
  assert.ok(prevented && stopped);
  g.card.emit('keydown', { key: 'ArrowRight', preventDefault() {}, stopPropagation() {} });
  await g.load(0);
  assert.equal(g.image.src, g.photos[0].src);
});

test('published palettes match the recorded extraction and sum to one', async () => {
  const g = gallery();
  const provenance = JSON.parse(await readFile(new URL('../docs/palette-provenance.json', import.meta.url)));
  for (const photo of g.photos) {
    assert.equal(photo.palette.length, 5);
    assert.ok(Math.abs(photo.palette.reduce((sum, color) => sum + color.weight, 0) - 1) < 1e-6);
    assert.deepEqual(JSON.parse(JSON.stringify(photo.palette)), provenance[photo.src.slice(1)].palette);
    for (const path of [photo.src, photo.src.replace('.webp', '-small.webp')]) {
      assert.ok((await readFile(new URL('.' + path, import.meta.url))).length > 0);
    }
  }
});
