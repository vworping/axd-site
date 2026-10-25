import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('cue-path.js', import.meta.url), 'utf8');
const context = { window: {}, document: { querySelectorAll: () => [] } };
runInNewContext(source, context);
const cue = context.window.AXDCuePath;
const coordinates = path => path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('hero and palette pointers keep symmetric heads at phone and desktop lengths', () => {
  for (const tail of [[64, 6], [230, 24], [450, 28]]) {
    for (const delta of [[-35, 40], [-60, 70], [-100, 120], [35, -40], [60, -70]]) {
      const tip = tail.map((value, i) => value + delta[i]);
      const v = coordinates(cue(tail, tip));
      assert.ok(v.every(Number.isFinite));
      assert.deepEqual(v.slice(0, 2), tail);
      assert.deepEqual(v.slice(6, 8), tip);
      const second = v.slice(4, 6), a = v.slice(8, 10), b = v.slice(12, 14);
      near(Math.hypot(a[0] - tip[0], a[1] - tip[1]), Math.sqrt(80));
      near(Math.hypot(a[0] - tip[0], a[1] - tip[1]), Math.hypot(b[0] - tip[0], b[1] - tip[1]));
      const axis = tip.map((value, i) => value - second[i]);
      const center = tip.map((value, i) => (a[i] + b[i]) / 2 - value);
      near(axis[0] * center[1] - axis[1] * center[0], 0);
      assert.ok(axis[0] * center[0] + axis[1] * center[1] < 0);
    }
  }
});

test('curves leave the label vertically and never fold back toward it', () => {
  for (const dy of [-120, -40, 40, 120]) {
    for (const dx of [-120, -30, 30, 120]) {
      const tail = [150, 150], tip = [150 + dx, 150 + dy];
      const v = coordinates(cue(tail, tip));
      near(v[2], tail[0]);
      const progress = [0, 2, 4, 6].map(i => ((v[i] - tail[0]) * dx + (v[i + 1] - tail[1]) * dy) / (dx * dx + dy * dy));
      for (let i = 1; i < progress.length; i++) assert.ok(progress[i] > progress[i - 1]);
      near(progress.at(-1), 1);
    }
  }
});

test('reversing a cue preserves its curve and head geometry', () => {
  const forward = coordinates(cue([64, 6], [12, 62]));
  const reverse = coordinates(cue([-64, -6], [-12, -62]));
  forward.forEach((value, i) => near(value, -reverse[i]));
});
