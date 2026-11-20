import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const window = {};
runInNewContext(await readFile(new URL('./kitchen-text.js', import.meta.url), 'utf8'), { window });
const parse = (...args) => JSON.parse(JSON.stringify(window.AXDKitchenText(...args)));

test('pasted recipe steps keep their numbers without duplicating typed labels', () => {
  const [list] = parse('1. Brown the butter\n2) Add sugar\n(3) Fold in flour\nStep 4: Bake');
  assert.equal(list.type, 'ol');
  assert.deepEqual(list.items, [
    { number: 1, text: 'Brown the butter' }, { number: 2, text: 'Add sugar' },
    { number: 3, text: 'Fold in flour' }, { number: 4, text: 'Bake' },
  ]);
});

test('quantities stay intact, wrapped steps stay together, and paragraphs remain separate', () => {
  assert.deepEqual(parse('1.5 cups flour\n1 egg'), [{ type: 'p', text: '1.5 cups flour\n1 egg' }]);
  assert.deepEqual(parse('A family favorite.\n\n3. Mix\n  until smooth\n4. Bake\n\nShare warmly.'), [
    { type: 'p', text: 'A family favorite.' },
    { type: 'ol', items: [{ number: 3, text: 'Mix\nuntil smooth' }, { number: 4, text: 'Bake' }] },
    { type: 'p', text: 'Share warmly.' },
  ]);
});

test('optional recipe fields format unnumbered methods and ingredient amounts', () => {
  assert.deepEqual(parse('', 'ol'), []);
  assert.deepEqual(parse('Mix.\nBake.', 'ol'), [{ type: 'ol', items: [{ number: 1, text: 'Mix.' }, { number: 2, text: 'Bake.' }] }]);
  assert.deepEqual(parse('- 1.5 cups flour\n• 1 egg', 'ul'), [{ type: 'ul', items: [{ number: 1, text: '1.5 cups flour' }, { number: 2, text: '1 egg' }] }]);
  assert.deepEqual(parse('1. Mix\n2. Bake', 'ol')[0].items.map(item => item.text), ['Mix', 'Bake']);
});
