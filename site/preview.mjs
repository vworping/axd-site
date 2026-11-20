import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './worker.mjs';
import { createKitchenHandler, KITCHEN_BODY_LIMIT } from './kitchen-store.mjs';

// Exercise the same routing and security policy locally as in production.
// Run node site/build.mjs first. No framework or dependency install is needed.
const directory = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 6767);
const source = fileURLToPath(new URL('./', import.meta.url));
const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
const kitchen = createKitchenHandler({ directory: source, origins });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
const ASSETS = {
  async fetch(request) {
    let path;
    try { path = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    if (path.endsWith('/')) path += 'index.html';
    // New dishes are visible immediately; the next build copies them for publishing.
    const editorAsset = ['/kitchen-editor', '/kitchen-editor.html', '/kitchen-editor.js'].includes(path);
    if (path === '/kitchen-editor') path = '/kitchen-editor.html';
    const kitchenAsset = editorAsset || path === '/assets/data/kitchen.json' || /^\/assets\/(?:images|media)\/kitchen\/[a-f0-9-]+\.(?:webp|jpg|png|mp4|webm)$/i.test(path);
    const base = kitchenAsset ? source : directory;
    const file = resolve(base, '.' + path);
    if (!file.startsWith(base.replace(/\/$/, '') + sep)) return new Response('Not found', { status: 404 });
    try {
      const bytes = await readFile(file);
      const headers = { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', ...(kitchenAsset ? { 'Cache-Control': 'no-store' } : {}) };
      // Native video players request byte ranges to load metadata and seek.
      if (/\.(mp4|webm)$/i.test(file)) {
        headers['Accept-Ranges'] = 'bytes';
        const range = request.headers.get('Range');
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          const start = match && match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match?.[2]));
          const end = match && match[1] && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
          if (!match || !Number.isInteger(start) || start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } });
          headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
          headers['Content-Length'] = String(end - start + 1);
          return new Response(bytes.subarray(start, end + 1), { status: 206, headers });
        }
      }
      return new Response(bytes, { headers });
    }
    catch { return new Response('Not found', { status: 404 }); }
  },
};
createServer(async (req, res) => {
  try {
    if (req.url?.split('?')[0] === '/__local/kitchen') {
      const origin = `http://${req.headers.host}`;
      if (!origins.includes(origin)) { res.writeHead(403); res.end('Use the local preview.'); return; }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > KITCHEN_BODY_LIMIT) {
          res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' });
          res.end(JSON.stringify({ error: 'This photograph is too large.' }));
          return;
        }
        chunks.push(chunk);
      }
      const response = await kitchen(new Request(origin + req.url, {
        method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const response = await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers }), { ASSETS });
    if (['/kitchen-editor', '/kitchen-editor.html'].includes(req.url?.split('?')[0])) {
      response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
}).listen(port, '127.0.0.1', () => console.log(`Portfolio preview: http://127.0.0.1:${port}`));
