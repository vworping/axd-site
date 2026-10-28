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
      getBoundingClientRect: () => ({ width: 1000, left: 0, right: 1000, top: 100, bottom: 600 }),
      scrollHeight: 1500, clientHeight: 500, scrollTop: 0,
      scrollTo({ top }) { this.scrollTop = top; },
    };
  };
  const document = node(), shell = node(), track = node(), values = new Map();
  track.children = ['top', 'constellation', 'PET', 'work', 'about'].map(id => ({ ...node(), dataset: { section: id, route: id === 'top' ? '/' : '/' + id } }));
  track.scrollLeft = position;
  track.children[1].scrollTop = 1000;
  const ids = new Map(track.children.map(chapter => [chapter.dataset.section, chapter]));
  ids.set('section-track', track);
  ids.set('c-spotlight-exit', { ...node(), hidden: false });
  const context = { ...node(), inert: true };
  const hero = { ...node(), bottom: 600, getBoundingClientRect: () => ({ bottom: hero.bottom + (context.inert ? 0 : 240) }) };
  track.children[1].querySelector = () => hero;
  ids.set('c-spotlight-context', context);
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
    document, track, hero, context, shell, value: name => values.get('--chapter-' + name),
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

const background = { target: { closest: () => null }, button: 0, clientX: 40, clientY: 160 };

test('a completed tap on surrounding chapter space reveals the context', () => {
  const page = preview();
  page.track.children[1].dispatch('pointerdown', background);
  assert.equal(page.document.getElementById('c-spotlight-exit').hidden, false);
  page.track.children[1].dispatch('click', background);
  assert.equal(page.document.getElementById('c-spotlight-exit').hidden, true);
  assert.equal(page.context.inert, false);
});

test('swipes and cancelled touches on empty space leave the spotlight active', () => {
  for (const gesture of ['pointermove', 'pointercancel', 'scroll']) {
    const page = preview(), chapter = page.track.children[1];
    chapter.dispatch('pointerdown', background);
    if (gesture === 'scroll') { chapter.scrollTop += 20; chapter.emit('scroll'); }
    else chapter.dispatch(gesture, { ...background, clientY: 210 });
    chapter.dispatch('click', background);
    assert.equal(page.document.getElementById('c-spotlight-exit').hidden, false, gesture);
    assert.equal(page.context.inert, true);
  }
});

test('scrolling within the hero stays spotlit, then reveals past it without shifting the map', () => {
  const page = preview(), chapter = page.track.children[1];
  chapter.scrollTop = 100;
  page.hero.bottom = 500;
  chapter.emit('scroll');
  assert.equal(page.context.inert, true);
  chapter.scrollTop = 500;
  page.hero.bottom = 100;
  chapter.emit('scroll');
  assert.equal(page.context.inert, false);
  assert.equal(chapter.scrollTop, 740, 'Compensate for the newly revealed context above the viewport');
  chapter.emit('scroll');
  assert.equal(chapter.scrollTop, 740, 'The exit happens only once');
});

test('pressing a wheel or photo control does not dismiss the spotlight before activation', () => {
  for (const control of ['#c-palette-orbit', 'button', '#c-palette-selection']) {
    const page = preview();
    page.track.children[1].dispatch('pointerdown', {
      ...background,
      target: { closest: selectors => selectors.split(', ').includes(control) ? {} : null },
    });
    assert.equal(page.document.getElementById('c-spotlight-exit').hidden, false, control);
    page.document.getElementById('c-spotlight-exit').emit('click');
    assert.equal(page.document.getElementById('c-spotlight-exit').hidden, true);
  }
});
