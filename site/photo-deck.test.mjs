import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('photo-deck.js', import.meta.url), 'utf8');
const photoSource = await readFile(new URL('assets/data/photographs.js', import.meta.url), 'utf8');

function preview({ width = 400, height = 350, reduced = false } = {}) {
  let now = 0, resize, cueUpdates = 0;
  const document = { activeElement: null, dispatchEvent() {}, fonts: { ready: Promise.resolve() } };
  function element(tag) {
    const events = new Map(), attributes = new Map();
    const node = {
      tag, dataset: {}, children: [], className: '',
      style: { setProperty(name, value) { this[name] = value; } },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(name, value) { attributes.set(name, value); },
      removeAttribute(name) { attributes.delete(name); if (name === 'id') delete this.id; },
      getAttribute: name => attributes.get(name),
      addEventListener(type, callback) { events.set(type, callback); },
      emit(type, event = {}) { events.get(type)?.(event); },
      querySelector(selector) { return this.children.find(child => selector === child.tag || selector === '.' + child.className); },
      focus() { document.activeElement = this; },
      decode: async () => {},
    };
    node.classList = {
      contains: value => node.className.split(' ').includes(value),
      add(...values) { node.className = [...new Set([...node.className.split(' ').filter(Boolean), ...values])].join(' '); },
      remove(...values) { node.className = node.className.split(' ').filter(value => !values.includes(value)).join(' '); },
    };
    return node;
  }
  const deck = element('figure'), stage = element('div'), hint = element('figcaption');
  const svg = element('svg'); svg.append(element('path')); hint.append(element('span'), svg);
  stage.clientWidth = width; stage.clientHeight = height; stage.closest = () => deck;
  document.querySelector = () => stage;
  document.getElementById = () => hint;
  document.createElement = element;
  const style = { paddingLeft: '6px', paddingRight: '6px', paddingTop: '6px', paddingBottom: '32px', transitionDuration: '.6s, .4s', transitionDelay: '0s', getPropertyValue: () => '' };
  const window = { AXDCuePath: () => '', addEventListener(type, callback) { if (type === 'resize') resize = callback; } };
  runInNewContext(photoSource, { window });
  runInNewContext(source, {
    window, document, matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => style, performance: { now: () => now },
    CustomEvent: class {}, requestAnimationFrame: () => ++cueUpdates, cancelAnimationFrame() {},
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} },
  });
  return {
    stage, style, document,
    cueUpdates: () => cueUpdates,
    front: () => stage.children.find(print => print.id === 'photo-next'),
    async click() { this.front().emit('click'); await this.flush(); },
    async key(key) { this.front().emit('keydown', { key, preventDefault() {}, stopPropagation() {} }); await this.flush(); },
    async flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); },
    tick(ms = 600) { now += ms; },
    resize(width, height) { stage.clientWidth = width; stage.clientHeight = height; resize(); },
  };
}

test('all five photographs retain their identity, dimensions and cyclic order in every slot', async () => {
  for (const [width,height] of [[400,350], [350,270], [335,184], [208,189], [460,460], [750,650]]) {
    const page = preview({ width, height });
    const original = page.stage.children.map(print => ({ print, image: print.querySelector('img'), src: print.querySelector('img').src, width: print.style.width, height: print.style.height }));
    assert.equal(new Set(original.map(item => item.height)).size, 1, 'Portrait and square prints share a height');
    for (let step = 0; step < 11; step++) {
      assert.equal(page.front(), original[step % 5].print);
      assert.equal(page.stage.children.filter(print => !print.classList.contains('deck-print--away')).length, 3);
      original.forEach(({ print,image,src,width,height }) => {
        assert.equal(print.querySelector('img'), image);
        assert.equal(image.src, src);
        assert.equal(print.style.width, width);
        assert.equal(print.style.height, height);
        assert.equal(print.tabIndex, print === page.front() ? 0 : -1);
      });
      await page.click(); page.tick();
    }
  }
});

test('rapid input cannot start another flip before the full transition finishes', async () => {
  const page = preview();
  await page.click();
  const second = page.front();
  for (const delta of [100,320,179]) {
    page.tick(delta); await page.click(); assert.equal(page.front(), second);
  }
  page.tick(1); await page.click();
  assert.equal(page.front(), page.stage.children[2]);
});

test('keyboard reversal restores the photograph and focus without an outgoing card on top', async () => {
  const page = preview();
  page.front().focus();
  await page.key('ArrowRight'); page.tick();
  await page.key('ArrowLeft');
  assert.equal(page.front(), page.stage.children[0]);
  assert.equal(page.document.activeElement, page.front());
  assert.ok(page.stage.children.every(print => !print.classList.contains('is-leaving')));
});

test('a slow or failed decode keeps the current photograph intact', async () => {
  const page = preview();
  let ready;
  page.stage.children[1].querySelector('img').decode = () => new Promise(resolve => { ready = resolve; });
  await page.click();
  assert.equal(page.front(), page.stage.children[0]);
  await page.click();
  ready(); await page.flush();
  assert.equal(page.front(), page.stage.children[1]);
  page.tick();
  page.stage.children[2].querySelector('img').decode = async () => { throw new Error('Image unavailable'); };
  await page.click();
  assert.equal(page.front(), page.stage.children[1]);
});

test('rotation preserves the selected image and fits the right-side mat without cropping', async () => {
  const page = preview({ reduced: true });
  await page.click(); await page.click();
  const selected = page.front();
  page.style.paddingRight = '32px'; page.style.paddingBottom = '6px';
  page.resize(250,180);
  assert.equal(page.front(), selected);
  assert.equal(new Set(page.stage.children.map(print => print.style.height)).size, 1);
  for (const print of page.stage.children) {
    const imageWidth = parseFloat(print.style.width) - 40;
    const imageHeight = parseFloat(print.style.height) - 14;
    assert.ok(Math.abs(imageWidth / imageHeight - Number(print.dataset.aspect)) < 1e-8);
  }
});

test('the cue is anchored to layout and does not follow photograph flips', async () => {
  const page = preview({ reduced: true });
  await page.flush();
  const initialUpdates = page.cueUpdates();
  for (let i = 0; i < 10; i++) await page.click();
  await page.key('ArrowLeft');
  assert.equal(page.cueUpdates(), initialUpdates, 'Flipping must not reposition the cue');
  page.resize(250,180);
  assert.equal(page.cueUpdates(), initialUpdates + 1, 'Changing orientation updates the fixed anchor');
});
