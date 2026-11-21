import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./baking.js', import.meta.url), 'utf8');
const textSource = await readFile(new URL('./kitchen-text.js', import.meta.url), 'utf8');
const videoSource = await readFile(new URL('./kitchen-video.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function kitchen({ reduced = false, desktop = false, recipe, observeVideo = false } = {}) {
  const effects = [];
  let visibility;
  function node(tag = 'div') {
    const events = new Map(), attrs = new Map();
    return {
      tag, children: [], dataset: {}, hidden: false, offsetHeight: 420, offsetTop: 300,
      style: { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(type, fn) { events.set(type, fn); },
      removeEventListener(type, fn) { if (events.get(type) === fn) events.delete(type); },
      emit(type, event = {}) { return events.get(type)?.(event); },
      setAttribute(key, value) { attrs.set(key, value); },
      getAttribute(key) { return attrs.get(key); },
      querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || child.tag === selector || child.className?.split(' ').includes(selector.slice(1))); },
      querySelector(selector) { return this.querySelectorAll(selector)[0]; },
      focus() {}, pause() { this.wasPaused = true; }, play() { this.wasPaused = false; return Promise.resolve(); },
      getBoundingClientRect() { return { left: 0, top: 0, right: 400, bottom: 420, width: 400, height: 420 }; },
      closest() { return this; },
      readyState: 2, decode: async () => {}, animate() {},
    };
  }
  const ids = Object.fromEntries(['baking-open', 'baking-dialog', 'kitchen-grid', 'kitchen-status', 'baking-dismiss'].map(id => [id, node()]));
  const pages = node(); pages.className = 'baking-pages';
  ids['baking-dialog'].append(pages, ids['kitchen-grid']);
  const document = Object.assign(node(), { getElementById: id => ids[id], createElement: node });
  const window = Object.assign(node(), {
    AXDDialogs: { open(dialog) { dialog.open = true; }, close(dialog) { dialog.open = false; dialog.emit('close'); } },
    AXDSnapshot(panel, opening) {
      let finish;
      const effect = { panel, opening, finished: new Promise(resolve => { finish = resolve; }), finish: () => finish(), cancel: () => finish() };
      effects.push(effect);
      return effect;
    },
  });
  const entry = { id: 'test', title: 'Test dish', kind: 'cooking', description: '1. Mix\n2. Share', recipe,
    media: [{ type: 'image', src: '/one.png', width: 400, height: 600 }, { type: 'video', src: '/two.mp4', width: 600, height: 400 }, { type: 'image', src: '/three.png', width: 500, height: 500 }] };
  runInNewContext(textSource, { window });
  runInNewContext(videoSource, { window, setTimeout: () => 1, clearTimeout() {} });
  const IntersectionObserver = observeVideo ? class {
    constructor(callback) { visibility = callback; }
    observe() {} unobserve() {} disconnect() {}
  } : undefined;
  runInNewContext(source, { window, document, IntersectionObserver, matchMedia: query => ({ matches: query.includes('min-width') ? desktop : reduced, addEventListener() {} }), URLSearchParams, location: { search: '' }, fetch: async () => ({ ok: true, json: async () => ({ entries: [entry] }) }) });
  ids['baking-open'].emit('click');
  await flush();
  return { grid: ids['kitchen-grid'], document, effects, dialog: ids['baking-dialog'], visibility };
}

test('rapid disclosure toggles cannot let an old closing animation hide reopened text', async () => {
  const { grid, effects } = await kitchen();
  const button = grid.querySelector('.kitchen-toggle'), text = grid.querySelector('.kitchen-text');
  assert.equal(text.hidden, true);
  button.emit('click');
  assert.equal(text.hidden, false);
  button.emit('click');
  button.emit('click');
  effects.forEach(effect => effect.finish());
  await flush();
  assert.deepEqual(effects.map(effect => effect.opening), [true, false, true]);
  assert.equal(text.hidden, false);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  button.emit('click');
  effects.at(-1).finish();
  await flush();
  assert.equal(text.hidden, true);
});

test('reduced or paused motion settles disclosures immediately and recipes remain optional', async () => {
  const k = await kitchen({ reduced: true });
  assert.equal(k.grid.querySelector('.kitchen-recipe'), undefined);
  await k.grid.querySelector('.kitchen-toggle').emit('click');
  assert.equal(k.grid.querySelector('.kitchen-text').hidden, false);
  assert.equal(k.effects.length, 0);
  const p = await kitchen({ recipe: { method: '1. Mix\n2. Bake' } });
  p.document.emit('axd:motion', { detail: { paused: true } });
  await p.grid.querySelector('.kitchen-toggle').emit('click');
  assert.equal(p.effects.length, 0);
  assert.deepEqual(p.grid.querySelector('.kitchen-recipe').querySelectorAll('li').map(li => li.textContent), ['Mix', 'Bake']);
});

test('desktop disclosures retain the closed card height until every panel is closed', async () => {
  const { grid } = await kitchen({ reduced: true, desktop: true, recipe: { method: 'Mix and bake.' } });
  const viewport = grid.querySelector('.kitchen-card-pages');
  const [description, recipe] = grid.querySelectorAll('.kitchen-toggle');
  await description.emit('click');
  assert.equal(viewport.style['--kitchen-card-height'], '420px');
  assert.ok(viewport.scrollTop > 0, 'opening details scrolls only inside the card');
  viewport.offsetHeight = 700;
  await recipe.emit('click');
  assert.equal(viewport.style['--kitchen-card-height'], '420px');
  await description.emit('click');
  assert.equal(viewport.style['--kitchen-card-height'], '420px');
  await recipe.emit('click');
  assert.equal(viewport.style['--kitchen-card-height'], undefined);
  assert.equal(viewport.scrollTop, 0);

  const mobile = await kitchen({ reduced: true });
  await mobile.grid.querySelector('.kitchen-toggle').emit('click');
  assert.equal(mobile.grid.querySelector('.kitchen-card-pages').style['--kitchen-card-height'], undefined);
});

test('in-frame arrows wrap through photos and inline video, pausing the video when leaving', async () => {
  const { grid, document } = await kitchen({ reduced: true });
  const frame = grid.querySelector('.kitchen-media-frame'), stage = grid.querySelector('.kitchen-media-stage');
  const next = frame.querySelector('.kitchen-media-next'), previous = frame.querySelector('.kitchen-media-previous');
  assert.equal(stage.children[0].src, '/one.png');
  assert.equal(stage.style.aspectRatio, '400 / 600');
  await next.emit('click');
  const video = stage.children[0];
  assert.equal(video.src, '/two.mp4');
  assert.equal(stage.style.aspectRatio, '600 / 400');
  assert.equal(video.playsInline, true);
  assert.equal(video.controls, false);
  assert.equal(video.muted, true);
  assert.equal(video.loop, true);
  assert.equal(video.poster, '/one.png');
  assert.match(video.getAttribute('controlslist'), /nodownload noplaybackrate/);
  assert.equal(grid.querySelector('.kitchen-media-count').textContent, '2 / 3');
  assert.match(video.getAttribute('controlslist'), /nofullscreen/);
  assert.equal(video.disablePictureInPicture, true);
  await next.emit('click');
  assert.equal(video.wasPaused, true);
  assert.equal(stage.children[0].src, '/three.png');
  assert.equal(stage.style.aspectRatio, '500 / 500');
  await next.emit('click');
  assert.equal(stage.children[0].src, '/one.png');
  await previous.emit('click');
  assert.equal(stage.children[0].src, '/three.png');
  stage.children[0].emit('click');
  assert.equal(stage.children.length, 1);
});

test('media changes close and reopen the shared shutter, including queued arrow clicks', async () => {
  const { grid, effects } = await kitchen();
  const stage = grid.querySelector('.kitchen-media-stage');
  const next = grid.querySelector('.kitchen-media-next');
  const moving = next.emit('click');
  await flush();
  assert.equal(stage.children[0].src, '/one.png', 'outgoing media stays mounted until the shutter closes');
  assert.equal(effects[0].opening, false);
  await next.emit('click');
  for (let i = 0; i < 4; i++) { effects[i].finish(); await flush(); }
  await moving;
  assert.equal(stage.children[0].src, '/three.png');
  assert.deepEqual(effects.map(effect => effect.opening), [false, true, false, true]);
});

test('closing the kitchen cancels a pending media swap', async () => {
  const { grid, effects, dialog } = await kitchen();
  const moving = grid.querySelector('.kitchen-media-next').emit('click');
  await flush();
  dialog.open = false;
  dialog.emit('close');
  await moving;
  assert.equal(grid.querySelector('.kitchen-media-stage').children[0].src, '/one.png');
  assert.equal(effects.length, 1);
});

test('muted looping video plays only while its frame and document are visible', async () => {
  const { grid, effects, document, visibility } = await kitchen({ observeVideo: true });
  const moving = grid.querySelector('.kitchen-media-next').emit('click');
  await flush(); effects[0].finish(); await flush(); effects[1].finish(); await moving;
  const video = grid.querySelector('video');
  assert.equal(video.wasPaused, true);
  visibility([{ target: video, isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(video.wasPaused, false);
  document.hidden = true; document.emit('visibilitychange');
  assert.equal(video.wasPaused, true);
  document.hidden = false; document.emit('visibilitychange');
  assert.equal(video.wasPaused, false);
  visibility([{ target: video, isIntersecting: false, intersectionRatio: 0 }]);
  assert.equal(video.wasPaused, true);
});
