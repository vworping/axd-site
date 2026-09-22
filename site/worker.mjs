// Enforce encryption before serving any public asset. Local HTTP previews work.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    return env.ASSETS.fetch(request);
  },
};
