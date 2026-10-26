import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('chapter-experience.js', import.meta.url), 'utf8');

function preview(reduced = false, position = 1000) {
  const node = () => {
    const listeners = new Map(), classes = new Set();
    return {
      classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
      emit(type, detail) { for (const callback of listeners.get(type) || []) callback({ detail }); },
      dispatch(type, event) { for (const callback of listeners.get(type) || []) callback(event); },
      getBoundingClientRect: () => ({ width: 1000, left: 0, right: 1000 }),
      scrollHeight: 1500, clientHeight: 500, scrollTop: 0,
    };
  };
  const document = node(), shell = node(), track = node(), values = new Map();
  track.children = ['top', 'constellation', 'PET', 'work', 'about'].map(id => ({ ...node(), dataset: { section: id, route: id === 'top' ? '/' : '/' + id } }));
  track.scrollLeft = position;
  track.children[1].scrollTop = 1000;
  const ids = new Map(track.children.map(chapter => [chapter.dataset.section, chapter]));
  ids.set('section-track', track);
  ids.set('c-spotlight-exit', { ...node(), hidden: false });
  ids.set('c-focus-dialog', node());
  document.documentElement = { style: { setProperty: (name, value) => values.set(name, value) } };
  document.getElementById = id => ids.get(id);
  document.querySelector = () => shell;
  document.querySelectorAll = () => track.children;
  let callbacks = [], now = 0;
  runInNewContext(source, {
    document, window: node(), location: { pathname: '/constellation' },
    matchMedia: () => ({ ...node(), matches: reduced }),
    MutationObserver: class { observe() {} },
    requestAnimationFrame(callback) { callbacks.push(callback); return callbacks.length; },
  });
  return {
    document, track, shell, value: name => values.get('--chapter-' + name),
    frames(count = 180) {
      for (let i = 0; i < count && callbacks.length; i++) {
        const pending = callbacks; callbacks = []; now += 16;
        pending.forEach(callback => callback(now));
      }
    },
  };
}

test('homepage header stays clear even before offscreen chapter bounds settle', () => {
  const page = preview(false, 0);
  assert.equal(page.shell.classList.contains('constellation-spotlight'), false);
  page.track.scrollLeft = 500;
  page.track.emit('scroll');
  assert.equal(page.shell.classList.contains('constellation-spotlight'), true);
  page.track.scrollLeft = 0;
  page.track.emit('scroll');
  assert.equal(page.shell.classList.contains('constellation-spotlight'), false);
});

test('canvas blends a scrolled chapter into an unscrolled neighbor before arrival', () => {
  const page = preview();
  assert.equal(page.value('depth'), 1);
  page.track.scrollLeft = 1500;
  page.track.emit('scroll');
  page.frames(1);
  assert.ok(page.value('depth') < 1 && page.value('depth') > .5, 'First frame eases toward the visible chapter mixture');
  page.frames();
  assert.equal(page.value('depth'), .5);
  assert.equal(page.value('progress'), .75);
  page.track.scrollLeft = 2000;
  page.track.emit('scroll');
  page.document.emit('axd:chapter', { id: 'PET' });
  page.frames(1);
  assert.ok(page.value('depth') > 0 && page.value('depth') < .5, 'Arrival must not reset the canvas abruptly');
  page.frames();
  assert.equal(page.value('depth'), 0);
  assert.equal(page.value('progress'), 1);
});

test('pausing motion freezes the current canvas instead of resetting it', () => {
  const page = preview();
  page.frames();
  page.document.emit('axd:motion', { paused: true });
  page.track.scrollLeft = 2000;
  page.track.emit('scroll');
  page.frames();
  assert.equal(page.value('progress'), .5);
  assert.equal(page.value('depth'), 1);
  page.document.emit('axd:motion', { paused: false });
  page.frames();
  assert.equal(page.value('progress'), 1);
  assert.equal(page.value('depth'), 0);
});

test('reduced motion keeps the canvas static during chapter navigation', () => {
  const page = preview(true);
  page.track.scrollLeft = 2000;
  page.track.emit('scroll');
  page.frames();
  assert.equal(page.value('progress'), .5);
  assert.equal(page.value('depth'), 1);
});

test('pressing surrounding chapter space dismisses the spotlight', () => {
  const page = preview();
  page.track.children[1].dispatch('pointerdown', { target: { closest: () => null } });
  assert.equal(page.document.getElementById('c-spotlight-exit').hidden, true);
});

test('pressing a wheel or photo control does not dismiss the spotlight before activation', () => {
  for (const control of ['#c-palette-orbit .palette-hit', '.palette-mini', '#c-palette-selection']) {
    const page = preview();
    page.track.children[1].dispatch('pointerdown', {
      target: { closest: selectors => selectors.split(', ').includes(control) ? {} : null },
    });
    assert.equal(page.document.getElementById('c-spotlight-exit').hidden, false, control);
    page.document.getElementById('c-spotlight-exit').emit('click');
    assert.equal(page.document.getElementById('c-spotlight-exit').hidden, true);
  }
});
