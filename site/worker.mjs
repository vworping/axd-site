import securityHeaders from './.generated/security-headers.json' with { type: 'json' };

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
    for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
    return response;
  },
};
