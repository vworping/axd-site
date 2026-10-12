# Palette constellation

The public explorer is served at https://mindofaxd.com/constellation/. The portfolio links directly to this route. Cloudflare static assets canonicalize `/constellation` to `/constellation/` so relative images and fonts resolve correctly.

`site/constellation/index.html` and `site/constellation/assets/` are the published snapshot from the adjacent `perceptual-palette-drift` project. Its generator, templates, and palette data remain the source of truth. To publish a future explorer update, rebuild there, copy only `docs/constellation/index.html` and `docs/constellation/assets/` into `site/constellation/`, excluding `.DS_Store`, then run `node site/build.mjs`. Do not copy research reports, audits, metadata, or raw originals.

Preserve the portfolio's wheel refinements when replacing this snapshot: opening a matching photograph pins the current color, and closing the preview keeps all three matches available. Touch/mouse previews return focus to the wheel without outlining the thumbnail; keyboard previews restore focus to the opened thumbnail. Clear the selection using the center's Clear color button, tapping the selected slice again, or tapping empty space inside or outside the wheel. The wheel shuffles all 150 photograph palettes and its six shapes on each visit, blending palettes every 3.2 seconds and shapes every 4.4 seconds. Selection, pause, and reduced-motion behavior still stop the animation.

The build includes this page in the sitemap and hashes its inline script for the existing Content Security Policy. Publish through the normal reviewed commit to `main`; see [deployment](DEPLOYMENT.md).

Display photographs are clean 1800px JPEG exports made by `src/export_constellation_images.py` in the source project. The save/copy feature applies the watermark at export time. The source also owns the floating, resizing frames and the PET-style shutter animation.
