import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import worker from './worker.mjs';
import { chapterMetadata, chapterRoutes } from './chapter-routes.mjs';

// Build first: node site/build.mjs && node --test site/security.test.mjs
// Exercise the deployed Worker handler with an in-memory asset binding.
const routes = {
  '/': 'index.html',
  '/constellation': 'index.html',
  '/PET': 'index.html',
  '/collaborations': 'index.html',
  '/about': 'index.html',
  '/pet-preview/': 'pet-preview/index.html',
  '/pet-preview/index.html': 'pet-preview/index.html',
};

test('public builds contain the kitchen display but no editor or write handler', async () => {
  const files = await readdir(new URL('./dist/', import.meta.url));
  for (const file of ['kitchen-editor.html', 'kitchen-editor.js', 'kitchen-store.mjs', 'preview.mjs']) assert.ok(!files.includes(file));
  const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('/baking.js?v='));
  assert.ok(!html.includes('kitchen-editor'));
  assert.ok(!html.includes('/__local/'));
});

test('production refuses editor and local API routes before touching the asset binding', async () => {
  for (const host of ['mindofaxd.com', 'axd-site.example.workers.dev']) {
    for (const path of ['/kitchen-editor', '/kitchen-editor.html', '/kitchen-editor.js', '/kitchen-store.mjs', '/__local/kitchen']) {
      for (const method of ['GET', 'POST']) {
        const response = await worker.fetch(new Request(`https://${host}${path}`, { method }), {
          ASSETS: { fetch() { assert.fail('Private authoring paths must not reach assets'); } },
        });
        assert.equal(response.status, 404);
      }
    }
  }
});

for (const [route, file] of Object.entries(routes)) {
  test(`browser protections and executable inline scripts: ${route}`, async () => {
    const html = await readFile(new URL(`dist/${file}`, import.meta.url), 'utf8');
    const response = await worker.fetch(new Request(`https://mindofaxd.com${route}`), {
      ASSETS: { fetch: async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }) },
    });
    assert.equal(await response.text(), chapterRoutes[route] ? chapterMetadata(html, route) : html);
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
  const response = await worker.fetch(new Request('http://localhost:6767/PET'), {
    ASSETS: { fetch: async () => new Response('Local preview') },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'Local preview');
});

test('www redirects permanently to the apex, including assets and legacy paths', async () => {
  const paths = [
    ...Object.keys(routes).map(path => [path, path]),
    ['/pet.html', '/PET'], ['/work/', '/collaborations'], ['/about/', '/about'],
    ['/index.html', '/'], ['/constellation/index.html', '/constellation'],
    ['/assets/images/share-logo.png', '/assets/images/share-logo.png'],
    ['/robots.txt', '/robots.txt'], ['/sitemap.xml', '/sitemap.xml'],
    ['/missing.html', '/missing.html'],
  ];
  for (const protocol of ['http:', 'https:']) {
    for (const [from, to] of paths) {
      // No asset binding: aliases must redirect before fetching any content.
      const response = await worker.fetch(new Request(`${protocol}//www.mindofaxd.com${from}?ref=job%20application&source=portfolio`), {});
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('Location'), `https://mindofaxd.com${to}?ref=job%20application&source=portfolio`);
    }
  }
});

test('following a www redirect returns the canonical page and current experience', async () => {
  const html = await readFile(new URL('dist/index.html', import.meta.url), 'utf8');
  for (const path of Object.keys(chapterRoutes)) {
    const redirect = await worker.fetch(new Request(`https://www.mindofaxd.com${path}`), {});
    const response = await worker.fetch(new Request(redirect.headers.get('Location')), {
      ASSETS: { fetch: async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }) },
    });
    assert.equal(response.status, 200, 'The canonical destination must not redirect again');
    const content = await response.text();
    assert.ok(content.includes(`rel="canonical" href="https://mindofaxd.com${path}"`));
    assert.ok(content.includes(`property="og:url" content="https://mindofaxd.com${path}"`));
    assert.match(content, /2026 — NOW<\/dt><dd><h3>Operations Lead, Product Strategy &amp; Marketing \(part-time\)<\/h3><p>ATLA Innovations/);
    assert.match(content, /2023 — 2025<\/dt><dd><h3>Research Data Operations Lead<\/h3><p>Boston University/);
    assert.match(content, /2021 — NOW<\/dt><dd><h3>Freelance Photographer &amp; Visual Designer/);
    assert.ok(!content.includes('Research Data Manager'));
  }
});

test('direct chapter requests fetch the shared document and receive their own metadata', async () => {
  const html = await readFile(new URL('dist/index.html', import.meta.url), 'utf8');
  for (const [path, { title }] of Object.entries(chapterRoutes)) {
    const response = await worker.fetch(new Request(`https://mindofaxd.com${path}`), {
      ASSETS: { fetch: async request => {
        assert.equal(new URL(request.url).pathname, '/');
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      } },
    });
    const content = await response.text();
    assert.ok(content.includes(`<title>${title}</title>`));
    assert.ok(content.includes(`rel="canonical" href="https://mindofaxd.com${path}"`));
    assert.ok(content.indexOf('id="constellation"') < content.indexOf('id="PET"'));
  }
});

test('legacy and trailing-slash project links preserve query strings', async () => {
  for (const [from, to] of [['/pet', '/PET'], ['/pet.html', '/PET'], ['/PET/', '/PET'], ['/constellation/', '/constellation'], ['/constellation/index.html', '/constellation'], ['/about/', '/about'], ['/work', '/collaborations'], ['/work/', '/collaborations'], ['/work/index.html', '/collaborations'], ['/collaborations/', '/collaborations'], ['/collaborations/index.html', '/collaborations']]) {
    const response = await worker.fetch(new Request(`https://mindofaxd.com${from}?ref=application`), {});
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), `https://mindofaxd.com${to}?ref=application`);
  }
});

test('composed chapters have unique IDs, resolved labels, and executable assets', async () => {
  const html = await readFile(new URL('dist/index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs across chapters');
  for (const [, references] of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) {
    for (const id of references.split(' ')) assert.ok(ids.includes(id), `Missing accessible label: ${id}`);
  }
  for (const [, path] of html.matchAll(/(?:src|href)="(\/[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g)) {
    await readFile(new URL(`dist${path}`, import.meta.url));
  }
  assert.ok(html.includes('Working toward V2.'));
  assert.ok(!html.includes('<!-- CONSTELLATION_CHAPTER -->'));
  assert.ok(!html.includes('<!-- PET_CHAPTER -->'));
});

test('collaborations is the canonical navigation and sitemap route', async () => {
  const html = await readFile(new URL('dist/index.html', import.meta.url), 'utf8');
  const sitemap = await readFile(new URL('dist/sitemap.xml', import.meta.url), 'utf8');
  assert.ok(html.includes('href="/collaborations">Collaborations</a>'));
  assert.ok(html.includes('data-route="/collaborations"'));
  assert.ok(!html.includes('href="/work"'));
  assert.ok(sitemap.includes('<loc>https://mindofaxd.com/collaborations</loc>'));
  assert.ok(!sitemap.includes('<loc>https://mindofaxd.com/work</loc>'));
});
