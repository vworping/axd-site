import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./baking.js', import.meta.url), 'utf8');
const textSource = await readFile(new URL('./kitchen-text.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function kitchen({ reduced = false, recipe } = {}) {
  const effects = [];
  function node(tag = 'div') {
    const events = new Map(), attrs = new Map();
    return {
      tag, children: [], dataset: {}, style: {}, hidden: false,
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(type, fn) { events.set(type, fn); },
      emit(type, event = {}) { return events.get(type)?.(event); },
      setAttribute(key, value) { attrs.set(key, value); },
      getAttribute(key) { return attrs.get(key); },
      querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || child.tag === selector || child.className?.split(' ').includes(selector.slice(1))); },
      querySelector(selector) { return this.querySelectorAll(selector)[0]; },
      focus() {}, pause() { this.wasPaused = true; }, animate() {},
    };
  }
  const ids = Object.fromEntries(['baking-open', 'baking-dialog', 'kitchen-grid', 'kitchen-status', 'baking-dismiss'].map(id => [id, node()]));
  const pages = node(); pages.className = 'baking-pages';
  ids['baking-dialog'].append(pages, ids['kitchen-grid']);
  const document = Object.assign(node(), { getElementById: id => ids[id], createElement: node });
  const window = Object.assign(node(), {
    AXDDialogs: { open() {}, close() {} },
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
  runInNewContext(source, { window, document, matchMedia: () => ({ matches: reduced }), URLSearchParams, location: { search: '' }, fetch: async () => ({ ok: true, json: async () => ({ entries: [entry] }) }) });
  ids['baking-open'].emit('click');
  await flush();
  return { grid: ids['kitchen-grid'], document, effects };
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

test('in-frame arrows wrap through photos and inline video, pausing the video when leaving', async () => {
  const { grid } = await kitchen();
  const frame = grid.querySelector('.kitchen-media-frame'), stage = grid.querySelector('.kitchen-media-stage');
  const next = frame.querySelector('.kitchen-media-next'), previous = frame.querySelector('.kitchen-media-previous');
  assert.equal(stage.children[0].src, '/one.png');
  assert.equal(stage.style.aspectRatio, '400 / 600');
  next.emit('click');
  const video = stage.children[0];
  assert.equal(video.src, '/two.mp4');
  assert.equal(stage.style.aspectRatio, '600 / 400');
  assert.equal(video.playsInline, true);
  assert.match(video.getAttribute('controlslist'), /nofullscreen/);
  assert.equal(video.disablePictureInPicture, true);
  next.emit('click');
  assert.equal(video.wasPaused, true);
  assert.equal(stage.children[0].src, '/three.png');
  assert.equal(stage.style.aspectRatio, '500 / 500');
  next.emit('click');
  assert.equal(stage.children[0].src, '/one.png');
  previous.emit('click');
  assert.equal(stage.children[0].src, '/three.png');
  stage.children[0].emit('click');
  assert.equal(stage.children.length, 1);
});
