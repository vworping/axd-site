# Palette constellation

The public explorer is served at https://mindofaxd.com/constellation/. The portfolio links directly to this route. Cloudflare static assets canonicalize `/constellation` to `/constellation/` so relative images and fonts resolve correctly.

`site/constellation/index.html` and `site/constellation/assets/` are the published snapshot from the adjacent `perceptual-palette-drift` project. Its generator, templates, and palette data remain the source of truth. To publish a future explorer update, rebuild there, copy only `docs/constellation/index.html` and `docs/constellation/assets/` into `site/constellation/`, excluding `.DS_Store`, then run `node site/build.mjs`. Do not copy research reports, audits, metadata, or raw originals.

The build includes this page in the sitemap and hashes its inline script for the existing Content Security Policy. Publish through the normal reviewed commit to `main`; see [deployment](DEPLOYMENT.md).
