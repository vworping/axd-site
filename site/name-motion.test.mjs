import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./name-motion.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function name({ reduced = false } = {}) {
  let now = 0, id = 0;
  const timers = new Map();
  function element(text = '') {
    const handlers = new Map();
    return {
      textContent: text, clientWidth: 250, children: [],
      style: { removeProperty(key) { delete this[key]; } },
      addEventListener(type, callback) { handlers.set(type, callback); },
      emit(type, event) { handlers.get(type)?.(event); },
      getBoundingClientRect() { return { width: this.textContent.length * 24 }; },
      append(child) { child.parent = this; this.children.push(child); },
      remove() { this.parent.children = this.parent.children.filter(child => child !== this); },
      cloneNode() { return element(); },
    };
  }
  const mark = element(), label = element(), word = element('AX'), greeting = element();
  label.querySelectorAll = () => [element('['), element(']')];
  mark.querySelector = selector => selector === '.name-label' ? label : word;
  const document = Object.assign(element(), {
    hidden: false,
    getElementById: id => id === 'name-morph' ? mark : id === 'motion-toggle' ? { getAttribute: () => 'false' } : null,
    querySelector: () => greeting,
  });
  const media = Object.assign(element(), { matches: reduced });
  const window = element();
  runInNewContext(source, {
    document, window, matchMedia: () => media, getComputedStyle: () => ({ fontSize: '48px' }),
    setTimeout(callback, delay) { const key = ++id; timers.set(key, { callback, at: now + delay }); return key; },
    clearTimeout(key) { timers.delete(key); },
  });
  await flush();
  return { word, label, document, media, timers,
    async tick(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
      }
      now = end;
    },
  };
}

test('the About name spells in a single natural-width word without clipped animation layers', async () => {
  const n = await name();
  await n.tick(1250);
  assert.equal(n.word.textContent, 'AXD');
  assert.equal(n.word.style.width, undefined);
  assert.equal(n.label.children.length, 0, 'measurement probes are removed before painting');
  await n.tick(190 + 1250);
  assert.equal(n.word.textContent, 'AXDR');
  await n.tick(190);
  assert.equal(n.word.textContent, 'AXDRE');
});

test('pausing during a spelling step cancels pending mutations and settles the complete name', async () => {
  const n = await name();
  await n.tick(1250 + 190 + 1250);
  assert.equal(n.word.textContent, 'AXDR');
  n.document.emit('axd:motion', { detail: { paused: true } });
  await n.tick(10000);
  assert.equal(n.word.textContent, 'AXD');
  assert.equal(n.timers.size, 0);
  n.document.emit('axd:motion', { detail: { paused: false } });
  await n.tick(1250 + 190);
  assert.equal(n.word.textContent, 'AXDRE');
});

test('hidden pages and reduced motion leave no name animation running', async () => {
  const n = await name();
  await n.tick(1250);
  n.document.hidden = true;
  n.document.emit('visibilitychange');
  await n.tick(10000);
  assert.equal(n.word.textContent, 'AX');
  assert.equal(n.timers.size, 0);
  const r = await name({ reduced: true });
  await r.tick(10000);
  assert.equal(r.word.textContent, 'AX');
  assert.equal(r.timers.size, 0);
});
