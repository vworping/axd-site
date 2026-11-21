import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const catalogue = JSON.parse(await readFile(new URL('assets/data/about-documents.json', root), 'utf8'));

test('the CV, poster, and paper have complete readable page sets', async () => {
  assert.deepEqual(catalogue.documents.map(doc => [doc.id, doc.pages.length]), [['cv', 4], ['conformity', 1], ['procedure-extraction', 13]]);
  for (const doc of catalogue.documents) {
    await access(new URL(doc.cover.slice(1), root));
    for (const page of doc.pages) {
      assert.match(page.src, /^\/assets\/images\/about-documents\/[a-z-]+\/page-\d+-[a-f0-9]+\.webp$/);
      const bytes = await readFile(new URL(page.src.slice(1), root));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(page.width >= 1900 && page.height >= 2500, `Readable resolution for ${page.src}`);
      assert.ok(page.text.trim().length > 50, `Accessible text for ${page.src}`);
    }
  }
});

test('the complete source archive stays separate from the public download folder', async () => {
  for (const name of ['andre-weiss-cv.pdf', 'ps326-poster.pptx', 'ps326-poster.pdf', 'orthopedic-procedure-extraction.pdf']) {
    const bytes = await readFile(new URL(`../documents/about/${name}`, root));
    assert.ok(bytes.length > 10000);
    assert.equal(bytes.toString('ascii', 0, name.endsWith('.pdf') ? 4 : 2), name.endsWith('.pdf') ? '%PDF' : 'PK');
    await assert.rejects(access(new URL(`dist/documents/about/${name}`, root)), { code: 'ENOENT' });
    await assert.rejects(access(new URL(`dist/assets/${name}`, root)), { code: 'ENOENT' });
  }
  assert.doesNotMatch(JSON.stringify(catalogue), /(?:src|href)":"[^"]*\.(?:pdf|pptx)/i);
});

test('only the CV and poster PDFs are offered as exact, versioned downloads', async () => {
  const published = JSON.parse(await readFile(new URL('dist/assets/data/about-documents.json', root), 'utf8'));
  const files = await readdir(new URL('dist/assets/documents/', root));
  assert.equal(files.length, 2);
  for (const [id, source] of [['cv', 'andre-weiss-cv.pdf'], ['conformity', 'ps326-poster.pdf']]) {
    const download = published.documents.find(doc => doc.id === id).download;
    assert.match(download.href, /^\/assets\/documents\/[a-z0-9-]+-[a-f0-9]{12}\.pdf$/);
    assert.match(download.name, /\.pdf$/);
    const actual = await readFile(new URL(`dist${download.href}`, root));
    assert.deepEqual(actual, await readFile(new URL(`../documents/about/${source}`, root)));
  }
  assert.equal(published.documents.find(doc => doc.id === 'procedure-extraction').download, undefined);
});
