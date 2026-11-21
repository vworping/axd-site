import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createKitchenHandler, KITCHEN_BODY_LIMIT } from './kitchen-store.mjs';

const origin = 'http://127.0.0.1:6767';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=', 'base64');
const request = (method = 'GET', options = {}) => new Request(origin + '/__local/kitchen', {
  ...options, method, headers: { Host: '127.0.0.1:6767', ...options.headers },
});
function dish(values = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ title: 'A test dish', description: 'Made for a persistence test.', kind: 'cooking', submissionId: randomUUID(), mediaInfo: JSON.stringify([{ width: 1, height: 1 }]), ...values })) form.set(key, value);
  form.set('media', new Blob([png], { type: 'image/png' }), '../../untrusted-name.png');
  return form;
}
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'axd-kitchen-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets/data'), { recursive: true });
  await writeFile(join(directory, 'assets/data/kitchen.json'), '{"version":1,"entries":[]}\n');
  const handler = createKitchenHandler({ directory, origins: [origin] });
  const { token } = await (await handler(request())).json();
  const post = (form, headers = {}) => handler(request('POST', { body: form, headers: { Origin: origin, 'X-Kitchen-Token': token, ...headers } }));
  const read = async () => JSON.parse(await readFile(join(directory, 'assets/data/kitchen.json'), 'utf8'));
  return { directory, handler, post, read };
}

test('a dish and its photo persist in project files across preview restarts', async t => {
  const { directory, post } = await setup(t);
  const response = await post(dish({ title: 'Test pasta', ingredients: '200 g pasta\nSalt', method: 'Boil water.\nCook and share.' }));
  assert.equal(response.status, 201);
  const { entry } = await response.json();
  assert.equal(entry.title, 'Test pasta');
  assert.equal(entry.recipe.ingredients, '200 g pasta\nSalt');
  assert.equal(entry.media[0].alt, 'Test pasta');
  assert.match(entry.media[0].src, /^\/assets\/media\/kitchen\/[a-f0-9-]+\.png$/);
  assert.deepEqual(await readFile(join(directory, entry.media[0].src)), png);
  const restarted = createKitchenHandler({ directory, origins: [origin] });
  const saved = await (await restarted(request())).json();
  assert.deepEqual(saved.entries, [entry]);
});

test('blank recipes are omitted, and a partial recipe keeps only supplied content', async t => {
  const { post } = await setup(t);
  const without = await (await post(dish({ ingredients: '  ', method: '\n' }))).json();
  assert.equal('recipe' in without.entry, false);
  const withRecipe = await (await post(dish({ method: 'Mix and bake.' }))).json();
  assert.deepEqual(withRecipe.entry.recipe, { ingredients: '', method: 'Mix and bake.' });
});

test('long recipes and extra blank lines persist without truncation', async t => {
  const { post, read } = await setup(t);
  const description = 'Pastry\n\n\n' + 'Mix and bake.\n'.repeat(180) + '\n\nMeringue\nFinish and share.';
  const response = await post(dish({ description }));
  assert.equal(response.status, 201);
  assert.equal((await read()).entries[0].description, description);
  assert.equal((await post(dish({ description: 'x'.repeat(20001) }))).status, 400);
});

test('one dish keeps several photos and a video in their selected order', async t => {
  const { post, directory } = await setup(t);
  const form = dish({ mediaInfo: JSON.stringify([{ width: 1, height: 1 }, { width: 1, height: 1 }, { width: 640, height: 480 }]) });
  form.append('media', new Blob([png], { type: 'image/png' }), 'second.png');
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)]);
  form.append('media', new Blob([mp4], { type: 'video/mp4' }), 'clip.mp4');
  const response = await post(form);
  assert.equal(response.status, 201);
  const { entry } = await response.json();
  assert.deepEqual(entry.media.map(item => item.type), ['image', 'image', 'video']);
  assert.match(entry.media[2].src, /-3\.mp4$/);
  assert.deepEqual(await readFile(join(directory, entry.media[2].src)), mp4);
});

test('an existing dish can gain a recipe later without reuploading its photos', async t => {
  const { post, read } = await setup(t);
  const first = (await (await post(dish())).json()).entry;
  const form = dish({ entryId: first.id, mediaInfo: '[]', ingredients: 'A pinch of salt', method: 'Share.' });
  form.delete('media');
  const response = await post(form);
  assert.equal(response.status, 201);
  const { entry } = await response.json();
  assert.deepEqual(entry.media, first.media);
  assert.deepEqual(entry.recipe, { ingredients: 'A pinch of salt', method: 'Share.' });
  assert.equal(entry.createdAt, first.createdAt);
  assert.equal((await read()).entries.length, 1);
});

test('adding media to an existing dish preserves its originals and remains safe to retry', async t => {
  const { post, read, directory } = await setup(t);
  const first = (await (await post(dish())).json()).entry;
  const changes = { entryId: first.id, submissionId: randomUUID(), title: 'Updated dish' };
  assert.equal((await post(dish(changes))).status, 201);
  assert.equal((await post(dish(changes))).status, 201);
  const { entries } = await read();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].media.length, 2);
  assert.equal(entries[0].media[0].src, first.media[0].src);
  assert.equal((await readdir(join(directory, 'assets/media/kitchen'))).length, 2);
});

test('concurrent submissions retain both dishes with newest entries first', async t => {
  const { post, read } = await setup(t);
  const responses = await Promise.all([post(dish({ title: 'First' })), post(dish({ title: 'Second' }))]);
  assert.deepEqual(responses.map(response => response.status), [201, 201]);
  assert.deepEqual((await read()).entries.map(entry => entry.title), ['Second', 'First']);
});

test('retrying a submission after a lost response does not duplicate it', async t => {
  const { post, read, directory } = await setup(t);
  const submissionId = randomUUID();
  await post(dish({ submissionId }));
  const retry = await post(dish({ submissionId }));
  assert.equal(retry.status, 201);
  assert.equal((await read()).entries.length, 1);
  assert.equal((await readdir(join(directory, 'assets/media/kitchen'))).length, 1);
});

test('cross-origin writes, missing editor tokens, and rebinding hosts cannot change files', async t => {
  const { post, read, handler } = await setup(t);
  for (const headers of [{ Origin: 'https://other.example' }, { 'X-Kitchen-Token': '' }, { Host: 'other.example:6767' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await post(dish(), headers)).status, 403);
  }
  assert.equal((await handler(request('GET', { headers: { Origin: 'https://other.example' } }))).status, 403);
  assert.equal((await read()).entries.length, 0);
});

test('invalid dishes and non-image uploads preserve the collection', async t => {
  const { post, read } = await setup(t);
  for (const changes of [{ title: '' }, { description: '' }, { kind: 'other' }, { mediaInfo: '[]' }, { submissionId: '../../escape' }, { title: 'x'.repeat(101) }]) {
    assert.equal((await post(dish(changes))).status, 400);
  }
  const fakePhoto = dish();
  fakePhoto.set('media', new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/png' }), 'fake.png');
  assert.equal((await post(fakePhoto)).status, 400);
  assert.equal((await read()).entries.length, 0);
});

test('oversized upload declarations and unsupported request methods are rejected', async t => {
  const { post, handler, read } = await setup(t);
  assert.equal((await post(dish(), { 'Content-Length': String(KITCHEN_BODY_LIMIT + 1) })).status, 413);
  assert.equal((await handler(request('DELETE'))).status, 405);
  assert.equal((await read()).entries.length, 0);
});

test('a damaged collection is not overwritten or left with an uploaded photo', async t => {
  const { directory, post, handler } = await setup(t);
  const path = join(directory, 'assets/data/kitchen.json');
  await writeFile(path, 'not valid json');
  assert.equal((await post(dish())).status, 500);
  assert.equal((await handler(request())).status, 500);
  assert.equal(await readFile(path, 'utf8'), 'not valid json');
  await assert.rejects(readdir(join(directory, 'assets/media/kitchen')), { code: 'ENOENT' });
});
