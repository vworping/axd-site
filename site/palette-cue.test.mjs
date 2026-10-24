import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('constellation/index.html', import.meta.url), 'utf8');
const helper = source.match(/function paletteCuePath\(rim, normal, tail\) \{[\s\S]*?\n\}/)[0];
const cue = runInNewContext(`(${helper})`);
const coordinates = path => path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('arrowhead wings mirror one another around the straight incoming shaft', () => {
  for (let angle = 0; angle < Math.PI * 2; angle += .17) {
    for (const reach of [10, 40, 100]) {
      const normal = [Math.cos(angle), Math.sin(angle)], rim = [125, 160];
      const tail = [rim[0] + normal[0] * (32 + reach) + 7, rim[1] + normal[1] * (32 + reach)];
      const v = coordinates(cue(rim, normal, tail));
      assert.ok(v.every(Number.isFinite));
      const neck = v.slice(6, 8), tip = v.slice(8, 10), a = v.slice(10, 12), b = v.slice(14, 16);
      near(Math.hypot(tip[0] - rim[0], tip[1] - rim[1]), 32);
      near(Math.hypot(a[0] - tip[0], a[1] - tip[1]), Math.hypot(b[0] - tip[0], b[1] - tip[1]));
      const axis = [tip[0] - neck[0], tip[1] - neck[1]];
      const center = [(a[0] + b[0]) / 2 - tip[0], (a[1] + b[1]) / 2 - tip[1]];
      near(axis[0] * center[1] - axis[1] * center[0], 0);
      assert.ok(axis[0] * center[0] + axis[1] * center[1] < 0, 'Both wings trail the tip');
    }
  }
});

test('changing the wheel edge adjusts the cue without moving its tail', () => {
  const tail = [375, 440], normal = [.5, Math.sqrt(3) / 2];
  const first = coordinates(cue([320, 340], normal, tail));
  const second = coordinates(cue([335, 375], normal, tail));
  assert.deepEqual(first.slice(0, 2), tail);
  assert.deepEqual(second.slice(0, 2), tail);
  assert.notDeepEqual(first.slice(8, 10), second.slice(8, 10));
});

test('turning the cue preserves its curve and arrowhead proportions', () => {
  const rim = [120, 100], normal = [.8, -.6], tail = [240, 25];
  const original = coordinates(cue(rim, normal, tail));
  for (const angle of [-Math.PI / 2, Math.PI / 2, Math.PI, .6]) {
    const rotate = ([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
    const turned = coordinates(cue(rotate(rim), rotate(normal), rotate(tail)));
    for (let i = 0; i < original.length; i += 2) {
      const expected = rotate(original.slice(i, i + 2));
      near(turned[i], expected[0]);
      near(turned[i + 1], expected[1]);
    }
  }
});

test('the cue advances toward its tip without folding back when the rim turns', () => {
  const tail = [260, 330];
  for (let angle = 0; angle < Math.PI * 2; angle += .13) {
    for (const rim of [[230, 270], [260, 305], [280, 315]]) {
      const v = coordinates(cue(rim, [Math.cos(angle), Math.sin(angle)], tail));
      const tip = v.slice(8, 10), delta = tip.map((value, i) => value - tail[i]);
      const lengthSquared = delta.reduce((sum, value) => sum + value * value, 0);
      const progress = [0, 2, 4, 6, 8].map(offset => ((v[offset] - tail[0]) * delta[0] + (v[offset + 1] - tail[1]) * delta[1]) / lengthSquared);
      for (let i = 1; i < progress.length; i++) assert.ok(progress[i] >= progress[i - 1], 'Each control point must advance along the arrow');
      near(progress.at(-1), 1);
    }
  }
});
