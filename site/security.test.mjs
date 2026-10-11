import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import worker from './worker.mjs';

// Build first: node site/build.mjs && node --test site/security.test.mjs
// Exercise the deployed Worker handler with an in-memory asset binding.
const routes = {
  '/': 'index.html',
  '/constellation/': 'constellation/index.html',
  '/constellation/index.html': 'constellation/index.html',
  '/pet': 'pet.html',
  '/pet.html': 'pet.html',
  '/pet-preview/': 'pet-preview/index.html',
  '/pet-preview/index.html': 'pet-preview/index.html',
};

for (const [route, file] of Object.entries(routes)) {
  test(`browser protections and executable inline scripts: ${route}`, async () => {
    const html = await readFile(new URL(`dist/${file}`, import.meta.url), 'utf8');
    const response = await worker.fetch(new Request(`https://mindofaxd.com${route}`), {
      ASSETS: { fetch: async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }) },
    });
    assert.equal(await response.text(), html);
    assert.equal(response.headers.get('Content-Type'), 'text/html');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
    assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=2592000');

    const preview = file === 'pet-preview/index.html';
    assert.equal(response.headers.get('X-Frame-Options'), preview ? 'SAMEORIGIN' : 'DENY');
    const policy = response.headers.get('Content-Security-Policy');
    const directives = policy.split(';').map(value => value.trim());
    for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", 'upgrade-insecure-requests',
      preview ? "frame-ancestors 'self'" : "frame-ancestors 'none'"]) {
      assert.ok(directives.includes(directive), `Missing ${directive}`);
    }
    const scripts = directives.find(value => value.startsWith('script-src ')).split(/\s+/);
    assert.ok(!scripts.includes("'unsafe-inline'"));
    assert.ok(!scripts.includes("'unsafe-eval'"));
    assert.ok(scripts.includes("'self'"));
    assert.ok(scripts.includes('https://static.cloudflareinsights.com'));
    // Include script tags with attributes so future module/ID changes are checked.
    for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=|\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(attributes)) continue;
      if (!source.trim()) continue;
      const hash = createHash('sha256').update(source).digest('base64');
      assert.ok(scripts.includes(`'sha256-${hash}'`), `Blocked inline script in ${file}`);
    }
  });

  test(`HTTPS redirect preserves path and query: ${route}`, async () => {
    const response = await worker.fetch(new Request(`http://mindofaxd.com${route}?from=portfolio`), {});
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), `https://mindofaxd.com${route}?from=portfolio`);
  });
}

test('framing exception does not extend to other subpages or missing assets', async () => {
  for (const route of ['/constellation', '/pet-preview/missing.html', '/missing.html']) {
    const response = await worker.fetch(new Request(`https://mindofaxd.com${route}`), {
      ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) },
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.ok(response.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
  }
});

test('localhost HTTP preview remains usable', async () => {
  const response = await worker.fetch(new Request('http://localhost:6767/pet.html'), {
    ASSETS: { fetch: async () => new Response('Local preview') },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'Local preview');
});
