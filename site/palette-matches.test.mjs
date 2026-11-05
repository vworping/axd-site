import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('constellation/index.html', import.meta.url), 'utf8');
const { nodes } = JSON.parse(source.match(/<script>const DATA = ([^\n]+);/)[1]);
const matching = source.slice(source.indexOf("  const photoStrip = $('palette-photos')"), source.indexOf("  $('palette-photos').addEventListener('click'"));
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

function preview() {
  const requests = [];
  function element() {
    const node = {
      children: [], dataset: {}, style: { setProperty() {} },
      classList: { add() {}, remove() {} },
      setAttribute(name, value) { this[name] = value; },
      append(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; },
      querySelector: selector => node.parts[selector],
      querySelectorAll: () => node.children.flatMap(child => child.isImage ? [child] : child.querySelectorAll('img')),
      set innerHTML(value) {
        this.parts = Object.fromEntries(['image', 'swatch', 'caption'].map(name => ['.palette-mini-' + name, element()]));
        this.children = Object.values(this.parts);
      },
    };
    return node;
  }
  const strip = element(), tag = element();
  const noop = () => {};
  const show = runInNewContext(`let shownColor = '';\n${matching}\nshowMatches;`, {
    $: () => strip, tag,
    colorIndex: nodes.map(node => ({ node, colors: node.palette.map(color => ({ hex: color.hex, rgb: rgb(color.hex) })) })),
    rgb, paused: true,
    document: { addEventListener: noop, createElement: element },
    window: { addEventListener: noop }, reducedMotion: { addEventListener: noop },
    getComputedStyle: () => ({ width: '100px', height: '144px' }),
    Image: function () {
      const image = { ...element(), isImage: true };
      image.decode = () => new Promise((resolve, reject) => requests.push({ image, resolve, reject }));
      return image;
    },
  });
  return {
    show, strip, tag,
    takeRequests() { return requests.splice(0); },
    ids: () => strip.children.map(card => card.querySelector('.palette-mini-caption').textContent),
  };
}

test('every photograph URL matches the exact exported filename, including its extension case', async () => {
  const files = new Set(await readdir(new URL('constellation/', import.meta.url), { recursive: true }));
  for (const { src } of nodes) assert.ok(files.has(src), `Case-sensitive asset missing: ${src}`);
});

test('the reported dark, brown and yellow-green selections show their own three closest photographs', async () => {
  const page = preview();
  for (const [hex, expected] of [
    ['#2D2A28', ['6765 / 2022', '7998 / 2023', '5587 / 2021']],
    ['#A8A057', ['0184 / 2025', '3897 / 2022', '6765 / 2022']],
    ['#915D41', ['3092 / 2020', '6765 / 2022', '8236 / 2021']],
    ['#A8A057', ['0184 / 2025', '3897 / 2022', '6765 / 2022']],
  ]) {
    const pending = page.show(hex);
    const requests = page.takeRequests();
    assert.equal(requests.length, 3);
    requests.forEach(request => request.resolve());
    await pending;
    assert.deepEqual(page.ids(), expected);
    assert.equal(page.tag['aria-label'], `Photographs with colors similar to ${hex}`);
    page.strip.children.forEach(card => assert.equal(card.querySelector('.palette-mini-image').children[0].src, nodes.find(node => node.image === card.dataset.image).src));
  }
});

test('a transient failed image can be retried by selecting the same color again', async () => {
  const page = preview();
  const first = page.show('#A8A057');
  page.takeRequests().forEach((request, index) => index ? request.resolve() : request.reject(new Error('Temporary image failure')));
  await first;
  const retry = page.show('#A8A057');
  const requests = page.takeRequests();
  assert.equal(requests.length, 3);
  requests.forEach(request => request.resolve());
  await retry;
  assert.deepEqual(page.ids(), ['0184 / 2025', '3897 / 2022', '6765 / 2022']);
});

test('slow or failed older requests cannot overwrite or invalidate a newer selection', async () => {
  for (const fail of [false, true]) {
    const page = preview();
    const first = page.show('#2D2A28'), oldRequests = page.takeRequests();
    const latest = page.show('#A8A057');
    page.takeRequests().forEach(request => request.resolve());
    await latest;
    oldRequests.forEach(request => fail ? request.reject(new Error('Late failure')) : request.resolve());
    await first;
    assert.deepEqual(page.ids(), ['0184 / 2025', '3897 / 2022', '6765 / 2022']);
    await page.show('#A8A057');
    assert.equal(page.takeRequests().length, 0);
  }
});
