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

## Hero and About

- **Hero photos and palettes:** `site/assets/data/photographs.js`.
- **Portrait:** search for `CHANGE PORTRAIT HERE` or `about-portrait` in `site/index.html`. Update `src`, `srcset`, `width`, `height`, and `alt` together. Current files are `andre.webp` and `andre-small.webp`.
- **Biography, email, social links, background dates:** `site/index.html`.
- **Logo share card:** `site/assets/images/share-logo.png`.
- **Favicon:** `site/assets/images/favicon-axd.png`. The build gives this a content-based filename to refresh icon caches and keeps the old PNG URL available. Also regenerate `site/favicon.ico` from the same image when changing the logo; it provides the standard fallback in 16, 32, 48, 64, 128, and 256 pixel sizes.

The portrait frame follows the photograph's natural proportions. Its padding is in `.portrait-window` in `site/layout.css`.

## Code map

| File under `site/` | Responsibility |
| --- | --- |
| `index.html` | Page structure, metadata, About/contact content, dialogs. |
| `styles.css` | Base visual system, fonts, intro, hero, and baseline responsive rules. |
| `layout.css` | Final responsive overrides, photo fans, About layout, gallery framing. |
| `script.js` | Project dialog content, galleries, full-image view, input handling. |
| `story-shelf.js` | Project previews and bounded mobile photo positions. |
| `photo-deck.js` | Hero photo sizing and flipping. |
| `logo-motion.js` | Palette logo and intro animation. |
| `name-motion.js` | AX → AXD → AXDRE → ANDRE, then varied spelling transitions. |
| `dialog-motion.js` | Opening shutter animation. |
| `section-navigation.js` | Horizontal chapters, touch/wheel/keyboard navigation. |
| `image-downloads.js` | Watermarked save/copy exports. |
| `build.mjs` | Creates deployable output, production URLs, and cache versions. |

Floating project photos use separate inner frames so their base positions stay fixed. Reduced motion, Pause motion, hidden tabs, and inactive sections stop the effect.

## Check an edit

Serve `site/` using the command in the repository README, save your edits, and refresh. If your browser retains a local script, hard-refresh it or change its `?v=` in the source HTML. Production builds generate content hashes automatically.

Before publishing:

```sh
node --check site/assets/data/projects.js
node --check site/script.js
node site/build.mjs
git diff --check
```

A build alone does not publish. Cloudflare deploys when a commit is pushed to `main`.
