import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./document-zoom.js', import.meta.url), 'utf8');
function reader() {
  let scale = 1;
  const handlers = new Map(), window = {};
  const viewport = { dataset: {}, clientWidth: 400, clientHeight: 500, scrollLeft: 0, scrollTop: 0,
    addEventListener: (name, fn) => handlers.set(name, fn), focus() {}, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const canvas = { getBoundingClientRect: () => ({ left: 12 - viewport.scrollLeft, top: 12 - viewport.scrollTop, width: 376 * scale, height: 1200 * scale }) };
  runInNewContext(source, { window });
  const controller = window.AXDDocumentZoom({ viewport, canvas, onZoom: value => { scale = value; } });
  return { viewport, controller, emit(name, extra = {}) {
    const event = { clientX: 200, clientY: 250, deltaMode: 0, button: 0, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra };
    handlers.get(name)(event); return event;
  } };
}
test('ordinary wheel scrolling and one-finger scrolling stay native', () => {
  const page = reader();
  assert.equal(page.emit('wheel', { deltaY: 120 }).prevented, undefined);
  assert.equal(page.emit('touchstart', { touches: [{ clientX: 10, clientY: 10 }] }).prevented, undefined);
  assert.equal(page.emit('touchmove', { touches: [{ clientX: 10, clientY: 60 }] }).prevented, undefined);
  assert.equal(page.controller.scale, 1);
});
test('Control-wheel zoom preserves the document point under the pointer', () => {
  const page = reader();
  const anchor = { x: (200 - 12) / 376, y: (250 - 12) / 1200 };
  assert.equal(page.emit('wheel', { ctrlKey: true, deltaY: -50 }).prevented, true);
  assert.ok(page.controller.scale > 1);
  assert.ok(Math.abs(12 - page.viewport.scrollLeft + anchor.x * 376 * page.controller.scale - 200) < .001);
  assert.ok(Math.abs(12 - page.viewport.scrollTop + anchor.y * 1200 * page.controller.scale - 250) < .001);
});
test('pinch supports zooming both directions and cancellation restores native scroll', () => {
  const page = reader();
  const touches = distance => [{ clientX: 200 - distance / 2, clientY: 250 }, { clientX: 200 + distance / 2, clientY: 250 }];
  page.emit('touchstart', { touches: touches(100) });
  page.emit('touchmove', { touches: touches(200) });
  assert.equal(page.controller.scale, 2);
  page.emit('touchmove', { touches: touches(50) });
  assert.equal(page.controller.scale, 1);
  page.emit('touchcancel');
  assert.equal(page.emit('touchmove', { touches: touches(100) }).prevented, undefined);
});
test('keyboard zoom is bounded, zero resets, and ordinary reading keys are untouched', () => {
  const page = reader();
  for (let i = 0; i < 20; i++) page.emit('keydown', { key: '+' });
  assert.equal(page.controller.scale, 4);
  page.emit('keydown', { key: '0' });
  assert.equal(page.controller.scale, 1);
  assert.equal(page.emit('keydown', { key: 'ArrowDown' }).prevented, undefined);
  assert.equal(page.emit('keydown', { key: '+', metaKey: true }).prevented, undefined);
});
