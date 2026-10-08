# PET experience page

`site/pet.html` is linked from the Work chapter. It includes an enclosure deck, the three-step interaction, the interactive OS, and a short Making it paragraph. Copy lives in `site/pet.html`; styling in `experience.css`; deck, viewer, and embed behavior in `pet-experience.js`.

## Interactive OS

`site/pet-preview/` is a public snapshot of PET's `design/pet-badge-concept.html`, `pet-os.css`, `pet-os.js`, and required `design/assets`, updated October 7, 2026. The preview is the same browser OS used during development, including the animated greeting, settings, Hello simulation, and Constellation inspection. It does not create live introductions or write NFC cards. The QR is a labeled placeholder.

The portfolio adapter (`portfolio.css` and `portfolio.js`) removes redundant preview framing, reports the content height to the parent, shares the motion control, and adds photo exports. The OS script comes directly from PET, including its optional host motion event and support for nested photo-saving controls. Local source paths are removed from the public Constellation data. Font licenses accompany the preview fonts. The simulation subtitle sits under the portfolio's OS heading; the inline event buttons remain below the screen.

### Updating the OS

1. Edit and check the browser preview in PET: `design/pet-os.js`, `design/pet-os.css`, `design/pet-badge-concept.html`, and `design/assets/`. Firmware-only changes must first be reflected in this preview.
2. From the `axd-site` directory run `node site/sync-pet.mjs`. An optional argument points to a PET checkout in another location. The command refreshes the public snapshot and rebuilds `site/dist`. It preserves the experience-page copy, enclosure photos, and portfolio adapters. It does not commit, push, or publish.
3. Refresh the local PET page and check the changed screens. Publish through the normal portfolio workflow when ready.

The sync validates source and integration files before writing, removes local provenance paths, copies font licenses, and records source hashes in `pet-preview/source-manifest.json`. Normal portfolio builds continue to use the saved snapshot without needing the PET checkout. Do not edit generated `pet-preview/pet-os.js` or `pet-os.css` directly; the next sync replaces them.

The build copies and hashes the preview's scripts/styles. The Worker and static headers allow same-origin framing only for the preview document; the rest of the site retains its existing framing protection.

## Enclosure deck and viewers

`enclosure-01.webp` comes from PET's `design/enclosure/preview.png`; `enclosure-04c.webp` comes from `design/enclosure-v4c/preview.png`. These are CAD studies, and the later render contains an earlier UI mockup. Replace sources, dimensions, alt text, and viewer descriptions together when physical photos are available.

Hovering or focusing a frame brings it forward without moving its position. Clicking or tapping a visible frame opens it; arrow keys also change priority. The top deck has no extra control bar. The expanded viewer retains navigation, Close, Escape, and backdrop dismissal with focus restoration. It uses the main site's `dialog-motion.js` shutter animation in both directions. The header brackets use a moving rainbow; reduced motion and the page motion control pause it.

`image-downloads.js` provides the same watermarked Save/Copy dialog as the main page. It is reachable from the viewer's Save / copy button, right-click, or a touch hold. Constellation's OS inspection includes the same options. Clipboard support depends on the browser; Save remains available.

## Hardware links

The Making it paragraph links the Waveshare display (`B0DD7N19FT`), NULLLAB RC522 reader (`B0H8CGVYVV`), and 3.7 V LiPo battery (`B0FT3C1WRP`). Mapping: PET's `docs/PUBLIC-HELLO.md`.

## Validation

Local build and JavaScript syntax checks; Worker framing-policy checks; browser checks of deck switching, viewer opening/closing, watermarked image export, Hello through guest arrival, Constellation photo save options, and mobile embed sizing. Nothing published or pushed. The separate Constellation experience update remains deferred.
