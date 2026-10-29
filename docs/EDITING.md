# Editing Mind of AXD

All editable site files live in `site/`. Edit source files, not `site/dist/`; the build recreates that directory.

## Projects

Open `site/assets/data/projects.js`. This is a JavaScript array assigned to `window.PROJECTS`, with JSON-style objects. Keep commas and quoted strings intact.

| Field | Where it appears |
| --- | --- |
| `slug` | Stable internal ID; avoid changing it casually. |
| `title` | Fallback project name. |
| `preview.title` | Title on the Work shelf. |
| `meta`, `year` | Collaborator/organization label and project date. |
| `preview.order` | Photo indexes fanned out on the shelf; first entry is the front photo. Indexes start at zero. |
| `caseStudy.title` | Opened project heading. |
| `caseStudy.summary` | Introductory description. |
| `caseStudy.body` | Main paragraphs, one string per paragraph. |
| `caseStudy.links` | Optional `{ "label": "…", "url": "https://…" }` links after the story and before the facts. |
| `caseStudy.facts` | Label/value entries for roles, collaborators, and other details. |
| `images` | Ordered photographs with `src`, `width`, `height`, and optional descriptive `alt`. |
| `palette` | Measured color swatches and weights. |

The older top-level `description`, `role`, and `tags` fields are retained as source metadata. Edit `caseStudy` for the visible story text.

### Image files

Project images live under `site/assets/images/projects/`. Keep each set of responsive derivatives together:

- `name.jpg`: full web image used in expanded view.
- `name-1200.webp` and `name-640.webp`: responsive gallery and shelf images.
- `name-thumb.webp`: small picker thumbnail.

Use real width and height values so the site preserves image proportions. `previewSrc` can override the shelf image path. The gallery can hold more than four photos; the shelf uses up to four entries from `preview.order`.

Project galleries fit their frames to those image dimensions and animate width and height with the same 440 ms easing as Constellation. The resize and photo fade respect Pause motion and reduced motion. Gallery sizing lives in `site/script.js`; its frame styling is in `site/layout.css`.

## Hero and About

- **Hero photos and palettes:** `site/assets/data/photographs.js`. Array order determines the visible 001–005 numbers. Responsive WebP files live under `site/assets/images/hero/`, named after their originals. The same palette drives each print and the AXD brackets; `docs/palette-provenance.json` records the measured source.
- **About portraits:** `site/assets/data/about-portraits.js` contains the three photographs, alt text, and measured palettes. The initial portrait remains in `site/index.html` as a fallback. Responsive WebP pairs live under `site/assets/images/about/`; source records are in `docs/image-sources.json` and extraction settings, sample counts, input hashes, and LAB centroids are in `docs/palette-provenance.json`.
- **Biography, email, social links, background dates:** `site/index.html`.
- **Logo share card:** `site/assets/images/share-logo.png`.
- **Favicon:** `site/assets/images/favicon-axd.png`. The build gives this a content-based filename to refresh icon caches and keeps the old PNG URL available. Also regenerate `site/favicon.ico` from the same image when changing the logo; it provides the standard fallback in 16, 32, 48, 64, 128, and 256 pixel sizes.

The portrait frame follows the photograph's natural proportions. Its padding is in `.portrait-frame` in `site/layout.css`. Arrows and left/right keys change portraits; clicking the photograph still opens the existing full-image viewer. Photo and palette transitions wait for image decoding, respect Pause motion and reduced motion, and settle when About leaves view. There is no automatic photo cycling.

The two new originals are preserved in `.local-archive/about-portraits/sources/` and are not published. Web copies are uncropped, oriented, converted to sRGB, stripped of metadata, and capped at 1200 or 640 pixels on the long edge. The original snow portrait is no longer at its old Desktop path; its existing 800×1200 WebP was used for palette extraction and left unchanged.

To regenerate the About assets with the existing Perceptual Palette Drift environment:

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 ../perceptual-palette-drift/.venv/bin/python tools/prepare-about-portraits.py --palette-project ../perceptual-palette-drift
```

This calls that project's `sample_lab_pixels` and `extract_palette` functions: 100,000 sampled pixels, five CIELAB clusters, fixed seeds, lightness range 10–95 with the existing low-sample fallback, no skin filtering, and a 1600-pixel analysis cap. Palette band widths represent shares of the retained sample. Re-extraction is only needed when photographs or extraction choices change; Python is not needed to build or run the site.

## Code map

| File under `site/` | Responsibility |
| --- | --- |
| `index.html` | Page structure, metadata, About/contact content, dialogs. |
| `styles.css` | Base visual system, fonts, intro, hero, and baseline responsive rules. |
| `layout.css` | Final responsive overrides, photo fans, About layout, gallery framing. |
| `script.js` | Project dialog content, galleries, full-image view, input handling. |
| `story-shelf.js` | Project previews and bounded mobile photo positions. |
| `photo-deck.js` | Hero photo sizing and flipping. |
| `about-portraits.js` | About photo navigation, decode-safe transitions, and measured palette strips. |
| `logo-motion.js` | Palette logo and intro animation. |
| `name-motion.js` | About name spelling transitions and staggered whole-word hero tagline rolls. |
| `dialog-motion.js` | Opening shutter animation. |
| `section-navigation.js` | Horizontal chapters, touch/wheel/keyboard navigation. |
| `image-downloads.js` | Watermarked save/copy exports. |
| `ambient-gradient.css`, `ambient-gradient.js` | Shared background gradients and scroll response on standalone pages. |
| `experience.css`, `pet-experience.js` | PET page layout, enclosure viewer, and OS embed integration. |
| `build.mjs` | Creates deployable output, production URLs, and cache versions. |
| `worker.mjs`, `security.test.mjs` | HTTPS redirects, response security headers, and regression checks. |

Floating project photos use separate inner frames so their base positions stay fixed. Reduced motion, Pause motion, hidden tabs, and inactive sections stop the effect.

## Check an edit

Serve `site/` using the command in the repository README, save your edits, and refresh. If your browser retains a local script, hard-refresh it or change its `?v=` in the source HTML. Production builds generate content hashes automatically.

Before publishing:

```sh
node --check site/assets/data/projects.js
node --check site/script.js
node site/build.mjs
node --test site/security.test.mjs
git diff --check
```

A build alone does not publish. Cloudflare deploys when a commit is pushed to `main`.

## Standalone experience pages

PET’s first-person build story is in `site/pet.html`, styled by `site/experience.css` and linked from the Work chapter. See [PET page notes](PET-EXPERIENCE.md) for image sources and the OS sync workflow. The palette explorer lives in `site/constellation/`; see [Constellation notes](CONSTELLATION.md) for snapshot updates. Add new standalone pages to the copy list and `pages` array in `site/build.mjs` so they receive metadata processing, asset hashes, and sitemap entries.
