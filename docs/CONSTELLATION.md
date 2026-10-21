# Palette constellation

The public explorer is served at https://mindofaxd.com/constellation/. The portfolio links directly to this route. Cloudflare static assets canonicalize `/constellation` to `/constellation/` so relative images and fonts resolve correctly.

`site/constellation/index.html` and `site/constellation/assets/` are the published snapshot from the adjacent `perceptual-palette-drift` project. Its generator, templates, and palette data remain the source of truth. To prepare a future explorer update, rebuild there, then run `node site/sync-constellation.mjs` here (optionally passing the source project path), followed by `node site/build.mjs`. The sync copies only the generated HTML and public image/font assets, skips `.DS_Store`, and adds the portfolio's shared ambient background. It does not copy research reports, audits, metadata, PDFs, or raw originals.

Preserve the portfolio's wheel refinements when replacing this snapshot: opening a matching photograph pins the current color, and closing the preview keeps all three matches available. Touch/mouse previews return focus to the wheel without outlining the thumbnail; keyboard previews restore focus to the opened thumbnail. Clear the selection using the center's Clear color button, tapping the selected slice again, or tapping empty space inside or outside the wheel. The wheel shuffles all 150 photograph palettes and its six shapes on each visit, blending palettes every 3.2 seconds and shapes every 4.4 seconds. Selection, pause, and reduced-motion behavior still stop the animation.

These refinements now live in the source templates as well. The wheel invitation describes individual-color discovery; the map and photograph modal compare complete palettes. The short “About this project” section records Andre's motivation and potential design uses, with the measurement limitations in an expandable note. The research PDF is intentionally withheld.

The third “Closest palettes” print tucks behind the upper pair. The upper cards keep their stacking order during hover and keyboard focus so their photo IDs, years, comparison values, and numbered links remain available.

The build includes this page in the sitemap and hashes its inline script for the existing Content Security Policy. Publish through the normal reviewed commit to `main`; see [deployment](DEPLOYMENT.md).

Display photographs are clean 1800px JPEG exports made by `src/export_constellation_images.py` in the source project. The save/copy feature applies the watermark at export time. The source also owns the floating, resizing frames and the PET-style shutter animation.
