# [AXD.] — Mind of AXD

**Andre Weiss · Photographer with a researcher's mind.**

[Visit mindofaxd.com](https://mindofaxd.com/) · [Editing guide](docs/EDITING.md) · [Deployment & rollback](docs/DEPLOYMENT.md)

![AXD logo](site/assets/images/share-logo.png?v=13)

A photography portfolio built around a stack of prints, measured color palettes, selected collaborations, and a personal introduction. Three horizontally navigable chapters connect the photographs, project stories, and About & Say Hello. The finished portfolio includes standalone Constellation and [pet.] experiences.

## What's inside

- Five hero photographs with palettes from **Perceptual Palette Drift**.
- A bracketed hero tagline that cycles through eleven role pairings, sharing the About page’s spelling animation and fitting the available width without shifting the layout.
- Project previews, complete stories, photo galleries, and expanded images.
- [Palette Constellation](https://mindofaxd.com/constellation/): an interactive palette sculpture, matching photograph previews, and a comparison photo board. A responsive **Click me** cue reuses the hero’s arrow as an overlay, adding no page space; tapping a color pins it while opening its photo previews.
- [Building [pet.]](https://mindofaxd.com/pet): a personal engagement tool, with enclosure studies, a few build notes, and an interactive OS preview.
- A palette-to-brackets intro, spelling name animation, shutter transitions, and ambient page gradients, with reduced-motion and pause support.
- Responsive desktop and mobile layouts, keyboard navigation, and native dialogs.
- Clean web images with watermarked copies available through **Take a copy**.

Plain HTML, CSS, and JavaScript. No framework or package installation is required to edit, preview, or build.

## Building [pet.]

The [PET page](https://mindofaxd.com/pet) tells the story of a **personal engagement tool**: a badge that starts a hello, brings a phone into the exchange, and uses an NFC card to carry the conversation forward. It brings together two enclosure CAD studies, the three-step interaction, and notes on learning ESP firmware, wiring the reader, and revising the case.

An embedded, interactive OS preview lets visitors explore the animated greeting, Hello flow, settings, and Constellation photo inspection. Phone, radio, and card events are simulated; the preview does not create live introductions or write NFC cards. The page shares the portfolio's motion controls, shutter transitions, expanded image viewer, and watermarked Save / copy tools.

Page content lives in `site/pet.html`; the saved OS snapshot lives in `site/pet-preview/`. See the [PET page notes](docs/PET-EXPERIENCE.md) for the source files, enclosure credits, and snapshot sync workflow.

## Edit content

| Change | File |
| --- | --- |
| Project dates, descriptions, collaborators, photos, and links | [`site/assets/data/projects.js`](site/assets/data/projects.js) |
| Hero photos and measured palettes | [`site/assets/data/photographs.js`](site/assets/data/photographs.js) |
| Hero tagline pairings and About name animation | [`site/name-motion.js`](site/name-motion.js) |
| Hero tagline markup, initial wording, and screen-reader text | [`site/index.html`](site/index.html) |
| About text, portrait, contact links, background | [`site/index.html`](site/index.html) |
| [pet.] page copy and enclosure photos | [`site/pet.html`](site/pet.html) |
| Constellation explorer and snapshot updates | [`docs/CONSTELLATION.md`](docs/CONSTELLATION.md) |
| [pet.] OS preview and sync workflow | [`docs/PET-EXPERIENCE.md`](docs/PET-EXPERIENCE.md) |
| Layout, spacing, responsive overrides | [`site/layout.css`](site/layout.css) |
| Fonts, base styles, core visual treatment | [`site/styles.css`](site/styles.css) |

For the visible project copy, edit `caseStudy.title`, `caseStudy.summary`, `caseStudy.body`, and `caseStudy.facts`. Change `year` for the date and `caseStudy.links` for external links. The [editing guide](docs/EDITING.md) describes each field.

For the rotating tagline, edit `pairs` inside `startTagline()` in `site/name-motion.js`. Each pair supplies the role and possessive perspective in “A [photographer] with a [researcher’s] mind.” The animation fits the longest sentence before cycling, respects the shared pause control and reduced-motion preference, and stops while offscreen or in a hidden tab. Keep the initial wording and stable screen-reader description in `site/index.html` in sync when changing the opening pair. Tagline styling and mobile alignment of the hero’s period with the E live in `site/layout.css`.

## Preview locally

From the repository root:

```sh
python3 -m http.server 6767 --bind 0.0.0.0 --directory site
```

Open **http://localhost:6767/**. For a phone on the same Wi-Fi, use `http://YOUR-MAC-IP:6767/`. On a Mac, `ipconfig getifaddr en0` usually returns the Wi-Fi address. If the port is occupied, use a different port or the already-running server.

Preview the standalone pages at `/constellation/` and `/pet.html`; Python's static server uses the `.html` filename for the PET page.

## Build and publish

```sh
node site/build.mjs
node --test site/security.test.mjs
git diff --check
```

The output is `site/dist/`. The build generates production metadata, security headers, and content hashes for script and stylesheet URLs so edited content refreshes correctly. The security tests check all four HTML pages, HTTPS redirects, and the OS preview's embedding policy. Build and tests were verified with Node.js 23.11.

**Cloudflare Workers Builds** deploys the `main` branch of this repository to the existing `axd-site` Worker. `wrangler.jsonc` runs the build and serves only `site/dist/`. Push a reviewed commit to `main` to publish. See [deployment & rollback](docs/DEPLOYMENT.md).

## Repository layout

```text
site/                  Editable website source
  assets/data/         Project stories and hero photographs
  assets/fonts/        Local fonts and their licenses
  assets/images/       Optimized web photographs and logo assets
  constellation/       Published palette explorer and web photographs
  name-motion.js       Shared spelling motion for the About name and hero tagline
  pet-preview/         Saved interactive OS preview for the [pet.] page
  sync-pet.mjs          Refreshes the OS snapshot from a local PET checkout
  worker.mjs           HTTPS redirects and response security headers
  security.test.mjs    Build-dependent Worker security checks
  dist/                Generated public output; ignored by Git
  .generated/          Generated Worker security headers; ignored by Git
docs/                  Editing, deployment, and palette provenance
wrangler.jsonc         Existing Cloudflare Worker + build configuration
```

The old portfolio is preserved in Git under **`pre-redesign-2026-09-19`**. On the original working machine, `.local-archive/` also retains the old site, raw inputs, image-processing tools, and a pre-launch redesign snapshot. It is ignored and never deployed.

## Images and credits

Photography and site content © Andre Weiss. Font licenses accompany the fonts in the main site, Constellation, and PET preview. Palette origins are recorded in [`docs/palette-provenance.json`](docs/palette-provenance.json); photograph sources are mapped in [`docs/image-sources.json`](docs/image-sources.json).

Displayed photographs are resized web copies. Download watermarking does not prevent screenshots or extraction of displayed images.
