import securityHeaders from './.generated/security-headers.json' with { type: 'json' };
import previewHeaders from './.generated/preview-security-headers.json' with { type: 'json' };
import { chapterPath, chapterMetadata } from './chapter-routes.mjs';

// Enforce encryption before serving any public asset. Local HTTP previews work.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    const chapter = chapterPath(url.pathname);
    if (chapter && url.pathname !== chapter) {
      url.pathname = chapter;
      return Response.redirect(url.href, 308);
    }
    const assetURL = new URL(request.url);
    if (chapter) assetURL.pathname = '/';
    const asset = await env.ASSETS.fetch(chapter ? new Request(assetURL, request) : request);
    const isHTML = asset.ok && asset.headers.get('Content-Type')?.includes('text/html');
    const response = new Response(chapter && isHTML ? chapterMetadata(await asset.text(), chapter, url.origin) : asset.body, asset);
    if (chapter && isHTML) {
      response.headers.delete('Content-Length');
      response.headers.delete('ETag');
    }
    const headers = ['/pet-preview/', '/pet-preview/index.html'].includes(url.pathname) ? previewHeaders : securityHeaders;
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    return response;
  },
};
