import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const motionSource = await readFile(new URL('dialog-motion.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('script.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function page({ reduced = false, paused = false, animation = true } = {}) {
  const nodes = new Map();
  let document;
  class Node extends EventTarget {
    dataset = {};
    open = false;
    animations = [];
    closeCount = 0;
    classList = { toggle() {} };
    querySelector() { return new Node(); }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { return { left: 100, right: 900, top: 100, bottom: 600 }; }
    showModal() { this.open = true; }
    close() { this.open = false; this.closeCount++; this.dispatchEvent(new Event('close')); }
    animate(frames, options) {
      let finish, cancel;
      const finished = new Promise((resolve, reject) => { finish = resolve; cancel = reject; });
      const value = { frames, options, finished, finish, cancel: () => cancel(new Error('Cancelled')) };
      this.animations.push(value);
      return value;
    }
  }
  if (!animation) Node.prototype.animate = undefined;
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new Node());
    return nodes.get(id);
  };
  document = new Node();
  document.documentElement = new Node();
  document.getElementById = get;
  document.querySelectorAll = () => [];
  get('background-scroll-cue').parentElement = new Node();
  const media = new Node();
  media.matches = reduced;
  const window = new Node();
  const context = { document, window, matchMedia: () => media, ResizeObserver: class { observe() {} } };
  runInNewContext(motionSource, context);
  runInNewContext(pageSource, context);
  if (paused) {
    const event = new Event('axd:motion');
    event.detail = { paused };
    document.dispatchEvent(event);
  }
  return { get, document, dialogs: window.AXDDialogs };
}

const dialogs = [
  ['project-dialog', 'dialog-dismiss'],
  ['background-dialog', 'background-dismiss'],
  ['image-dialog', 'image-dismiss'],
];

function dismiss(dialog, button, route) {
  if (route === 'button') button.dispatchEvent(new Event('click'));
  if (route === 'backdrop') {
    const event = new Event('click');
    Object.assign(event, { clientX: 20, clientY: 20 });
    dialog.dispatchEvent(event);
  }
  if (route === 'Escape') {
    // Native dialogs close immediately unless the cancel event is prevented.
    if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
  }
}

for (const [id, button] of dialogs) {
  for (const route of ['button', 'backdrop', 'Escape']) {
    test(`${id}: ${route} waits for the closing shutter`, async () => {
      const view = page(), dialog = view.get(id);
      view.dialogs.open(dialog);
      const opening = dialog.animations[0];
      assert.equal(opening.frames[0].clipPath, 'inset(49.5% 0 49.5% 0)');
      opening.finish();
      await settle();

      dismiss(dialog, view.get(button), route);
      assert.equal(dialog.open, true, 'Keep the dialog in the top layer while the shutter closes');
      assert.equal(dialog.animations.length, 2);
      const closing = dialog.animations[1];
      assert.equal(closing.frames[0].clipPath, 'inset(0% 0 0% 0)');
      assert.equal(closing.frames.at(-1).clipPath, 'inset(49.5% 0 49.5% 0)');
      closing.finish();
      await settle();
      assert.equal(dialog.open, false);
      assert.equal(dialog.closeCount, 1);
      assert.equal(dialog.dataset.closing, undefined);
    });
  }
}

test('interior clicks keep each dialog open', () => {
  const view = page();
  for (const [id] of dialogs) {
    const dialog = view.get(id);
    dialog.open = true;
    const event = new Event('click');
    Object.assign(event, { clientX: 200, clientY: 200 });
    dialog.dispatchEvent(event);
    assert.equal(dialog.open, true);
    assert.equal(dialog.animations.length, 0);
  }
});

test('repeated dismissal during opening runs one closing shutter', async () => {
  const view = page(), dialog = view.get('project-dialog');
  view.dialogs.open(dialog);
  for (const route of ['button', 'Escape', 'backdrop']) dismiss(dialog, view.get('dialog-dismiss'), route);
  assert.equal(dialog.animations.length, 2);
  dialog.animations[1].finish();
  await settle();
  assert.equal(dialog.closeCount, 1);
  view.dialogs.open(dialog);
  assert.equal(dialog.open, true, 'The dialog can reopen after an interrupted opening');
  dialog.animations[2].finish();
  await settle();
});

test('Escape closes the expanded photograph without closing its parent project', async () => {
  const view = page(), project = view.get('project-dialog'), image = view.get('image-dialog');
  project.open = image.open = true;
  dismiss(image, view.get('image-dismiss'), 'Escape');
  image.animations[0].finish();
  await settle();
  assert.equal(image.open, false);
  assert.equal(project.open, true);
});

for (const options of [{ reduced: true }, { paused: true }, { animation: false }]) {
  test(`dialogs settle immediately with ${JSON.stringify(options)}`, () => {
    const view = page(options);
    for (const [id, button] of dialogs) {
      for (const route of ['button', 'backdrop', 'Escape']) {
        const dialog = view.get(id);
        view.dialogs.open(dialog);
        dismiss(dialog, view.get(button), route);
        assert.equal(dialog.open, false);
        assert.equal(dialog.animations.length, 0);
        assert.equal(dialog.dataset.closing, undefined);
      }
    }
  });
}
