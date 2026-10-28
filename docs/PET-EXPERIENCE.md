# PET experience page

`site/pet.html` supplies the `/PET` chapter. The `[pet.]` title is paired with a small current-OS device preview that links directly to the live demo below. Four numbered editorial sections follow: motivation, interaction decisions, prototype construction, and field testing. A short closing note keeps the unresolved V2 questions with the field observation; development has not started. Copy lives in `site/pet.html`; experience styling in `experience.css`; chapter-scoped editorial styling and comparison controls in `case-studies.css` and `case-studies.js`; deck, viewer, and embed behavior in `pet-experience.js`.

Orientation and color/monochrome controls make the design tradeoffs visual. The portrait wireframe is explicitly a concept; grayscale is a visual treatment, not an e-ink simulation. `assets/images/pet/os-home.png` and `os-photography.png` are captures of the current browser OS, taken October 26, 2026, with motion paused. They replace the earlier enclosure renders as the main supporting visuals. Refresh these screen captures when the OS changes. The live OS always uses the synchronized preview below.

## Interactive OS

`site/pet-preview/` is a public snapshot of PET's `design/pet-badge-concept.html`, `pet-os.css`, `pet-os.js`, and required `design/assets`, refreshed October 23, 2026. The preview is the same browser OS used during development, including the animated home greeting, orbital Hello composition, settings, Hello simulation, and Constellation inspection. It does not create live introductions or write NFC cards. Its labeled demo QR opens the PET project page.

The portfolio adapter (`portfolio.css` and `portfolio.js`) removes redundant preview framing, reports the content height to the parent, shares the single page-level motion control (the standalone preview retains its own button). The OS script comes directly from PET, including its optional host motion event and support for nested photo-saving controls. Local source paths are removed from the public Constellation data. Font licenses accompany the preview fonts. The simulation subtitle sits under the portfolio's OS heading; the inline event buttons remain below the screen.

### Updating the OS

1. Edit and check the browser preview in PET: `design/pet-os.js`, `design/pet-os.css`, `design/pet-badge-concept.html`, and `design/assets/`. Firmware-only changes must first be reflected in this preview.
2. From the `axd-site` directory run `node site/sync-pet.mjs`. An optional argument points to a PET checkout in another location. The command refreshes the public snapshot and rebuilds `site/dist`. It preserves the experience-page copy, enclosure photos, and portfolio adapters. It does not commit, push, or publish.
3. Refresh the local PET page and check the changed screens. Publish through the normal portfolio workflow when ready.

The sync validates source and integration files before writing, removes local provenance paths, copies font licenses, and records source hashes in `pet-preview/source-manifest.json`. Normal portfolio builds continue to use the saved snapshot without needing the PET checkout. Do not edit generated `pet-preview/pet-os.js` or `pet-os.css` directly; the next sync replaces them.

The build copies and hashes the preview's scripts/styles. The Worker and static headers allow same-origin framing only for the preview document; the rest of the site retains its existing framing protection.

The October 8 sync was reviewed against `firmware/main/pet_ui.c` and `pet_constellation.c`: home, greeting timing, Hello states, settings, and Constellation layouts. Browser copy now uses the same `x` text as the device. The browser remains a simulation of the firmware UI, not compiled firmware; radio, phone, and card events are simulated.

## Enclosure design, photographs, and viewers

The build section pairs one clean CAD Polaroid with the user's physical front/back photographs. `enclosure-final.webp` is a deterministic render of the final STL geometry, not an AI-generated approximation. It uses `BLACK_shell.stl`, `WHITE_back_tighter.stl`, `BLACK_AXD_NFC.stl`, and `BLACK_switch_5p2mm_reach.stl` from the supplied PET_ENCLOSURE_FINAL package, with the V7 glass mesh and the current `os-home.png` texture. The two camera angles expose the actual power slider, USB-C, SD, and both service-button openings. The backing and graphics retain their source alignment. The optional local renderer and pre-change checkpoint are saved in `.local-archive/pet-hardware-refresh/` and `.local-archive/pet-before-hardware-refresh/`.

The original HEIC front photograph was decoded with libheif. Both physical photos and both supplied business-card designs are resized/encoded as WebP with metadata stripped. Original sources remain untouched. The old enclosure studies remain in the asset directory but are no longer displayed.

Build dimensions (138 × 96 × 22.4 mm), parts links, and the distinction between the printed shell and untested backing/switch revisions live in one expandable “Inside the build” note. No explanatory text is burned into the render.

Front/back arrows sit in the photograph's white caption strip. Incoming images decode before the shared Polaroid crossfade; stale or failed requests cannot replace the current photo, and keyboard focus follows the selected arrow. Selecting any of the three images opens the existing viewer, retaining previous/next, Close, Escape, backdrop dismissal, and focus restoration. The viewer retains the main site's shutter animation and watermarked export.

## Business-card interaction

The original front/back artwork is layered into a reversible card. “Place the NFC tag” animates a code-drawn illustrative sticker onto the top-right of the white front; replaying from the reverse first turns the card over. The illustration demonstrates placement and does not write a tag. The card and tag settle to their final states when reduced motion, the page motion toggle, navigation, or hidden-tab state interrupts animation. Controls announce the current side and placement through a live region; the hidden face is excluded from the accessibility tree.

`image-downloads.js` provides the same watermarked Save/Copy dialog as the main page. It is reachable from the viewer's Save / copy button, right-click, or a touch hold. Constellation's OS inspection includes the same options. Clipboard support depends on the browser; Save remains available.

## Hardware links

The expandable hardware notes link the Waveshare display (`B0DD7N19FT`), NULLLAB RC522 reader (`B0H8CGVYVV`), and 3.7 V LiPo battery (`B0FT3C1WRP`). Mapping: PET's `docs/PUBLIC-HELLO.md`. The build disclosure keeps hardware details out of the image captions.

## Validation

Local build and JavaScript syntax checks; Worker framing-policy checks; browser checks of deck switching, viewer opening/closing, watermarked image export, Hello through guest arrival, and mobile embed sizing. The page is published through the portfolio’s main-branch deployment. The separate [Constellation experience](CONSTELLATION.md) is now included in the portfolio.

October 8 update: verified one visible page-level motion toggle, pause/resume, and Hello through guest arrival in the browser; checked all preview manifest hashes and byte equality with the development CSS/JS. Native UI, protocol, socket, and certificate-name tests passed using the local LVGL 8.3.11 copy. The separate TLS test could not build because the temporary SDK Mbed TLS headers were missing. Removed six superseded OS screenshots, their greeting font, and unused gallery CSS. No device was flashed.

October 12 Hello redesign: synchronized the shared Hello layout from PET. All navigation, process steps, instructions, and actions use the OS fonts. Introduction has a larger green bracket greeting; the phone form uses a distinct static heading. NFC retains preparation, clear, review, and save with professional labels. Device status uses a full-width single line. The preview now has one guided demo button and Reset, with the existing page motion toggle. Its clean demo QR opens the PET project page. Native layout and interaction checks and the portfolio security checks passed; no physical badge was flashed.

October 13 preview update: removed the OS inspection Save / copy photo button and its image-export dialog, scripts, and styles. The sync script preserves this removal on future refreshes.

October 23 preview update: synchronized the current `hello-orbit-15` design, including the On your phone panel, Show QR / Back to phone controls, and Save Hello / Hello Saved screens. Verified all 47 snapshot hashes and byte equality with the source CSS/JS, plus the guided demo through simulated NFC save. Portfolio action-button contrast remains in `portfolio.css`, which synchronization preserves. Enclosure dimensions and notes now appear as readable HTML captions and expanded-view descriptions.

October 27 hardware presentation: smaller intro preview and two jump links under the project name; consistent bold section headings; exact-geometry CAD render; physical front/back photo switcher; front-side NFC placement and card flip. Local build, both composed-script syntax checks, and 55 tests passed. Desktop/mobile browser checks cover the new controls, heading weights, image viewer, and OS demo. No deployment or device flash.

October 28 final polish: removed the duplicate intro-link border, brought the small preview closer to the title, and reduced orientation/closing whitespace. The shared device frame blanks its screen, rotates 90 degrees, and reveals the new layout; reduced or paused motion immediately settles to the selected orientation. The NFC placement runs once when at least 35% of the card is visible in the active chapter, with replay still available. Its transparent/silver illustration follows the supplied [NTAG213 sticker reference](https://www.amazon.com/dp/B0FXG1F7KD). Reader/writer constraints link to the [MFRC522 datasheet](https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf); personalized greeting/topic wording follows PET’s PUBLIC-HELLO documentation. Build, syntax checks, and 57 tests passed, including automatic placement and interrupted rotation.
