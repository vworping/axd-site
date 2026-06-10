# axd-site

Static portfolio site for Andre Weiss / mindofaxd.com.

The site is plain HTML, CSS, and JavaScript, designed as a minimal editorial portfolio with photography-forward project sections. Project palettes are generated from curated image sets using k-means clustering in LAB color space.

## Structure

- `index.html`: page structure, metadata, favicon, social preview tags, and static content.
- `styles.css`: visual design, responsive layout, project modal, carousel, and lightbox styles.
- `script.js`: navigation, project rendering, modal behavior, carousel controls, and lightbox behavior.
- `assets/data/projects.js`: generated project data, image dimensions, palette values, and case study text.
- `assets/images/site-web/`: public optimized site-level images such as the hero and about portrait.
- `assets/images/projects-web/`: public optimized project images used by cards, case studies, and lightbox previews.
- `assets/images/projects/`: source/input project images. Some older source sets are tracked; newer raw sets are kept local and ignored.
- `assets/images/watermark-test/`: local watermark experiments, ignored by Git.
- `assets/resume/`: public resume assets.
- `tools/`: local scripts for image watermarking and palette generation.

## Project Structure

Each project is represented in `assets/data/projects.js` with:

- identity fields: `slug`, `title`, `meta`, `year`, `role`, `description`
- display fields: `tags`, `poeticTag`, `accent`, `wash`
- image fields: `cover`, `images`
- color analysis: `palette`
- expanded copy: `caseStudy`

Project image folders currently use this pattern:

```text
assets/images/projects-web/<project-name>/
  <slug>-01-cover.jpg
  <slug>-02-image.jpg
  <slug>-03-image.jpg
  <slug>-04-image.jpg
```

The live site reads from `site-web/` and `projects-web/`, not directly from raw project folders.

## Watermarking

Watermarks are not added by CSS or JavaScript. The script below bakes `[AXD]` directly into the exported image pixels while resizing/compressing the image for web use:

```bash
python3 tools/watermark_web_images.py --src <source> --out <output> --overwrite
```

Current convention:

- Public project images in `assets/images/projects-web/` can be watermarked.
- Hero/about images in `assets/images/site-web/` should be optimized for web use, but the intended direction is to keep them unwatermarked.
- `assets/images/watermark-test/` is only for local experiments and should not be committed.

## Palette Generation

The palette generator reads the configured project image folders, calculates LAB/k-means palette data, and rewrites `assets/data/projects.js`:

```bash
python3 tools/generate_project_palettes.py
```

Project metadata currently lives inside `tools/generate_project_palettes.py`, so adding a new project means adding its metadata and image folder there before regenerating `assets/data/projects.js`.

The image scripts require Python packages such as Pillow, NumPy, and scikit-image.

## Development

Because the site is static, it can be opened directly in a browser or served with any simple local static server.

Useful checks before committing:

```bash
node --check script.js
git diff --check
```

## Git Notes

Avoid `git add .` when raw image folders are present. Stage specific files and public asset folders intentionally.

Ignored local/generated paths include `.DS_Store`, Python cache folders, watermark tests, editor backup files, and selected raw project source folders.

## Deployment

The site is intended to deploy from the GitHub repository through Cloudflare Pages. The Cloudflare project config lives in `wrangler.jsonc`.
