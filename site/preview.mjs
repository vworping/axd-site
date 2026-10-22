import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './worker.mjs';

// Exercise the same routing and security policy locally as in production.
// Run node site/build.mjs first. No framework or dependency install is needed.
const directory = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 6767);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
const ASSETS = {
  async fetch(request) {
    let path;
    try { path = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(directory, '.' + path);
    if (!file.startsWith(directory.replace(/\/$/, '') + sep)) return new Response('Not found', { status: 404 });
    try { return new Response(await readFile(file), { headers: { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream' } }); }
    catch { return new Response('Not found', { status: 404 }); }
  },
};
createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method }), { ASSETS });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
}).listen(port, '127.0.0.1', () => console.log(`Portfolio preview: http://127.0.0.1:${port}`));
