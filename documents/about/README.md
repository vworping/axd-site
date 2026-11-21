# About document originals

These project copies are independent of Downloads and Desktop. Keep them here
when deleting or moving the original source files.

- `andre-weiss-cv.pdf`: the four-page CV supplied on November 21, 2026.
- `ps326-poster.pptx`: the original PS 326 research poster.
- `ps326-poster.pdf`: a viewing export of the poster, preserving its layout.
- `orthopedic-procedure-extraction.pdf`: the supplied research manuscript.

The website build does **not** copy this folder wholesale. Its reader serves rendered
pages from `site/assets/images/about-documents/` and accessible text from
`site/assets/data/about-documents.json`. The build copies only the CV and poster PDF
to `site/dist/assets/documents/` with content-hashed filenames and exposes their
download buttons. The research manuscript PDF and original PPTX stay in this archive.

Direct links on `https://mindofaxd.com` (or the local preview origin):

- CV: `/about?library=cv`
- Research collection: `/about?library=research`
- Conformity poster: `/about?library=conformity`
- Procedure-extraction paper: `/about?library=procedure-extraction`

Opening a tab or research card updates the address bar to its direct link.
Each document scrolls continuously inside a reader matching the kitchen window.
Research previews fill the shelf in their original proportions. Inset bottom-right
controls provide zoom, fit-to-window, the current page number, and CV/poster PDF
downloads. Pinch or Control-scroll to zoom, double-click to zoom/reset, or focus
the pages and use `+`, `-`, and `0`. Extracted text stays available to screen readers
without a separate text-view control.

To replace a document, replace its archived copy, then run
`python3 tools/prepare_about_documents.py` using Python with Pillow and pypdf,
and Poppler's `pdftoppm` on PATH. Re-export the poster with LibreOffice if its
PPTX changes. Finally run `node site/build.mjs` and preview the result.
