import securityHeaders from './.generated/security-headers.json' with { type: 'json' };
import previewHeaders from './.generated/preview-security-headers.json' with { type: 'json' };
import { chapterPath, chapterMetadata } from './chapter-routes.mjs';

// Consolidate the public domains and enforce HTTPS before serving any asset.
// Combine host, protocol, and chapter aliases in one permanent redirect.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      url.protocol = 'https:';
    }
    if (url.hostname === 'www.mindofaxd.com') url.hostname = 'mindofaxd.com';
    const chapter = chapterPath(url.pathname);
    if (chapter) url.pathname = chapter;
    if (url.href !== request.url) return Response.redirect(url.href, 308);
    // Authoring is a loopback preview feature, never a public submission endpoint.
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        /^\/(?:__local(?:\/|$)|kitchen-editor(?:[./]|$)|kitchen-store\.mjs$)/.test(url.pathname)) {
      return new Response('Not found', { status: 404, headers: securityHeaders });
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
