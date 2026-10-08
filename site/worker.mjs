import securityHeaders from './.generated/security-headers.json' with { type: 'json' };
import previewHeaders from './.generated/preview-security-headers.json' with { type: 'json' };

// Enforce encryption before serving any public asset. Local HTTP previews work.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    const headers = ['/pet-preview/', '/pet-preview/index.html'].includes(url.pathname) ? previewHeaders : securityHeaders;
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    return response;
  },
};
