import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./about-library.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
function library({ reduced = false } = {}) {
  const nodes = new Map(), pending = new Map(), effects = [];
  let document, outerOpens = 0;
  class Element {
    constructor(tag = 'div') { this.tag = tag; }
    events = new Map(); children = []; dataset = {}; style = { setProperty() {} }; attributes = new Map();
    hidden = false; open = false; clientWidth = 770; clientHeight = 510;
    textContent = ''; scrollTop = 0; scrollLeft = 0;
    addEventListener(type, fn) { this.events.set(type, fn); }
    emit(type, values = {}) { return this.events.get(type)?.({ preventDefault() {}, stopPropagation() {}, ...values }); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key); }
    removeAttribute(key) { this.attributes.delete(key); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    querySelector(selector) {
      if (selector.startsWith('[data-document=')) return this.children.find(child => child.dataset.document === selector.match(/"(.*?)"/)[1]);
      return this.children.find(child => child.tag === selector);
    }
    getBoundingClientRect() { return { top: 0, bottom: 1000, left: 0, right: 770 }; }
    animate() {}
    focus() { document.activeElement = this; }
  }
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  get('library-fit').append(new Element('span'));
  get('library-reader').hidden = true;
  get('library-index').hidden = true;
  document = Object.assign(new Element(), { getElementById: get, createElement: tag => new Element(tag) });
  const docs = ['cv', 'conformity', 'procedure-extraction'].map(id => ({ id, collection: id === 'cv' ? 'cv' : 'research', title: id, detail: '', label: id,
    cover: `/${id}-cover.webp`, pages: [{ src: `/${id}.webp`, width: 800, height: 1000, text: id }],
  }));
  class Image extends Element {
    constructor() { super('img'); }
    decode() {
      if (this.src.includes('cover')) return Promise.resolve();
      return new Promise(resolve => pending.set(this.src, resolve));
    }
  }
  const location = { href: 'http://localhost/about', search: '', pathname: '/about' };
  const history = { pushState(_state, _title, value) { const url = new URL(value); location.href = url.href; location.search = url.search; }, replaceState(...args) { this.pushState(...args); } };
  const window = Object.assign(new Element(), {
    AXDDialogs: { open(el) { el.open = true; outerOpens++; }, close(el) { el.open = false; el.emit('close'); } },
    AXDDocumentZoom: ({ onZoom }) => ({ scale: 1, reset() { onZoom(1); } }),
    AXDSnapshot(el, opening) {
      let finish;
      const animation = { el, opening, finished: new Promise(resolve => { finish = resolve; }), finish: () => finish(), cancel: () => finish() };
      effects.push(animation); return animation;
    },
  });
  runInNewContext(source, { window, document, Image, URL, URLSearchParams, location, history,
    matchMedia: () => ({ matches: reduced, addEventListener() {} }),
    fetch: async () => ({ ok: true, json: async () => ({ version: 1, documents: docs }) }),
    getComputedStyle: () => ({ paddingLeft: '14', paddingRight: '14', paddingTop: '14', paddingBottom: '58' }),
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  return { get, pending, effects, get opens() { return outerOpens; } };
}

test('initial opening waits for decoded content and uses only the outer shutter', async () => {
  const page = library();
  const opening = page.get('cv-open').emit('click');
  await settle();
  assert.equal(page.get('about-library').open, false);
  page.pending.get('/cv.webp')(); await opening;
  assert.equal(page.get('about-library').open, true);
  assert.equal(page.opens, 1);
  assert.equal(page.effects.length, 0, 'No nested opening shutter');
});

test('research keeps its shelf visible until the incoming page is decoded, then shutters one fixed surface', async () => {
  const page = library();
  await page.get('research-open').emit('click');
  page.get('library-index').children[0].emit('click'); await settle();
  assert.equal(page.get('library-index').hidden, false);
  assert.equal(page.get('library-reader').hidden, true);
  assert.equal(page.effects.length, 0);
  page.pending.get('/conformity.webp')(); await settle();
  assert.equal(page.effects[0].opening, false);
  assert.equal(page.get('library-index').hidden, false);
  page.effects[0].finish(); await settle();
  assert.equal(page.get('library-reader').hidden, false);
  assert.equal(page.effects[1].opening, true);
  assert.equal(page.effects[0].el, page.effects[1].el);
  assert.equal(page.effects[1].el, page.get('library-surface'));
  page.effects[1].finish(); await settle();
  assert.equal(page.get('about-library').dataset.changing, undefined);
  assert.equal(page.opens, 1);
});

test('closing during a slow preview load cannot reopen the dialog', async () => {
  const page = library();
  await page.get('research-open').emit('click');
  page.get('library-index').children[0].emit('click'); await settle();
  page.get('library-dismiss').emit('click');
  page.pending.get('/conformity.webp')(); await settle();
  assert.equal(page.get('about-library').open, false);
  assert.equal(page.opens, 1);
  assert.equal(page.effects.length, 0);
});

test('reduced motion swaps a ready document without shutter effects', async () => {
  const page = library({ reduced: true });
  await page.get('research-open').emit('click');
  page.get('library-index').children[0].emit('click'); await settle();
  page.pending.get('/conformity.webp')(); await settle();
  assert.equal(page.get('library-reader').hidden, false);
  assert.equal(page.effects.length, 0);
});
