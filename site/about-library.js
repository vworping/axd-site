(() => {
  'use strict';
  const dialog = document.getElementById('about-library');
  if (!dialog || !window.AXDDialogs || !window.AXDDocumentZoom) return;
  const get = id => document.getElementById(`library-${id}`);
  const title = get('title'), detail = get('detail'), back = get('back'), surface = get('surface');
  const index = get('index'), reader = get('reader'), viewport = get('viewport'), canvas = get('canvas');
  const status = get('status'), pageCount = get('page-count'), download = get('download');
  const zoomOut = get('zoom-out'), zoomIn = get('zoom-in'), fit = get('fit');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = document.getElementById('motion-toggle')?.getAttribute('aria-pressed') === 'true';
  let catalogue, selected, trigger, revision = 0, animation, resizeFrame, countFrame;
  document.addEventListener('axd:motion', event => { paused = event.detail.paused; if (paused) animation?.cancel(); });
  reduced.addEventListener('change', () => { if (reduced.matches) animation?.cancel(); });
  const moving = () => !paused && !reduced.matches && typeof surface.animate === 'function';
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const href = id => `/about?library=${encodeURIComponent(id)}`;
  const linked = () => new URLSearchParams(location.search).get('library');
  function address(id, replace = false) {
    const url = new URL(location.href);
    if (id) { url.searchParams.set('library', id); url.searchParams.delete('kitchen'); }
    else url.searchParams.delete('library');
    if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
  }
  async function documents() {
    if (!catalogue) catalogue = fetch('/assets/data/about-documents.json', { cache: 'no-store' })
      .then(response => { if (!response.ok) throw new Error('Documents could not load. Please reopen this tab to try again.'); return response.json(); })
      .then(data => {
        if (data.version !== 1 || !Array.isArray(data.documents) || !data.documents.every(doc => doc.pages?.length)) throw new Error('The document collection is unavailable.');
        return data.documents;
      }).catch(error => { catalogue = null; throw error; });
    return catalogue;
  }
  function countPages() {
    countFrame = null;
    if (!selected || reader.hidden) return;
    const middle = viewport.getBoundingClientRect().top + viewport.clientHeight / 2;
    const sheets = [...canvas.children];
    const found = sheets.findIndex(sheet => sheet.getBoundingClientRect().bottom > middle);
    const current = (found === -1 ? sheets.length - 1 : found) + 1;
    const value = `${current} / ${sheets.length}`;
    if (pageCount.textContent !== value) pageCount.textContent = value;
    pageCount.setAttribute('aria-label', `Page ${current} of ${sheets.length}`);
  }
  function scheduleCount() {
    if (!countFrame) countFrame = requestAnimationFrame(countPages);
  }
  // The shell never changes size between the shelf, poster, paper, and CV.
  // Only the document scales inside it; a single poster starts fully in view.
  function layout(scale = zoom.scale) {
    if (!selected || reader.hidden || !dialog.open) return;
    const style = getComputedStyle(viewport);
    const width = Math.max(1, viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    const height = Math.max(1, viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    const ratio = selected.pages[0].width / selected.pages[0].height;
    const single = selected.pages.length === 1;
    const base = single ? Math.min(width, height * ratio) : width;
    canvas.style.width = `${base * scale}px`;
    canvas.style.marginTop = `${single ? Math.max(0, (height - base * scale / ratio) / 2) : 0}px`;
    canvas.style.setProperty('--document-zoom', scale);
    fit.querySelector('span').textContent = `${Math.round(scale * 100)}%`;
    const focused = document.activeElement;
    zoomOut.disabled = scale <= 1;
    zoomIn.disabled = scale >= (single ? 6 : 4);
    if ((focused === zoomOut || focused === zoomIn) && focused.disabled) fit.focus({ preventScroll: true });
    scheduleCount();
  }
  const zoom = window.AXDDocumentZoom({ viewport, canvas, onZoom: layout,
    enabled: () => dialog.open && !!selected && !reader.hidden,
    maxZoom: () => selected?.pages.length === 1 ? 6 : 4,
  });
  async function shutter(opening) {
    if (!moving()) return;
    animation = window.AXDSnapshot(surface, opening, { fill: 'forwards' });
    await animation.finished.catch(() => {});
  }
  async function documentPages(doc) {
    const sheets = doc.pages.map((source, number) => {
      const sheet = node('section', 'library-page');
      sheet.setAttribute('aria-label', `Page ${number + 1} of ${doc.pages.length}`);
      const image = new Image();
      image.alt = ''; image.draggable = false;
      image.width = source.width; image.height = source.height;
      image.decoding = 'async'; image.loading = number === 0 ? 'eager' : 'lazy';
      image.src = source.src;
      const error = node('p', 'library-page-error', `Page ${number + 1} could not load. Reopen this document to try again.`);
      error.hidden = true;
      image.addEventListener('error', () => { error.hidden = false; });
      sheet.append(image, node('div', 'sr-only', source.text), error);
      return sheet;
    });
    // Keep the current view painted until the replacement's first page is ready.
    await sheets[0].querySelector('img').decode();
    return sheets;
  }
  async function collectionCards(docs) {
    const cards = docs.filter(doc => doc.collection === 'research').map(doc => {
      const card = node('a', 'library-print');
      card.href = href(doc.id); card.dataset.document = doc.id;
      card.setAttribute('aria-label', `Read ${doc.title}`);
      const page = doc.pages[0], image = new Image();
      image.src = doc.cover; image.alt = ''; image.draggable = false;
      image.width = page.width; image.height = page.height;
      card.style.setProperty('--print-ratio', page.width / page.height);
      card.append(image, node('small', '', doc.label), node('strong', '', doc.title), node('span', '', doc.detail));
      card.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); event.stopPropagation(); navigate(doc.id);
      });
      return card;
    });
    await Promise.allSettled(cards.map(card => card.querySelector('img').decode()));
    return cards;
  }
  function showDocument(doc, sheets) {
    selected = doc;
    dialog.dataset.reading = 'true';
    title.textContent = doc.collection === 'cv' ? 'CV · Andre Weiss' : doc.title;
    detail.textContent = doc.collection === 'cv' ? '' : doc.detail;
    back.hidden = doc.collection === 'cv';
    index.hidden = true; reader.hidden = false;
    viewport.setAttribute('aria-label', `${doc.label}: ${doc.pages.length} ${doc.pages.length === 1 ? 'page' : 'pages'}`);
    canvas.replaceChildren(...sheets);
    download.hidden = !doc.download;
    if (doc.download) {
      download.href = doc.download.href;
      download.download = doc.download.name;
      download.title = `Download ${doc.collection === 'cv' ? 'CV' : 'poster'} (PDF)`;
      download.setAttribute('aria-label', download.title);
    } else { download.removeAttribute('href'); download.removeAttribute('download'); }
    zoom.reset();
    viewport.scrollTop = 0; viewport.scrollLeft = 0;
    pageCount.textContent = `1 / ${doc.pages.length}`;
    pageCount.setAttribute('aria-label', `Page 1 of ${doc.pages.length}`);
  }
  function showCollection(cards) {
    selected = null;
    dialog.dataset.reading = 'false';
    reader.hidden = true; index.hidden = false; back.hidden = true;
    title.textContent = 'Research'; detail.textContent = 'Papers & posters.';
    index.replaceChildren(...cards); index.scrollTop = 0;
  }
  async function navigate(id, button, updateAddress = true) {
    const turn = ++revision, wasOpen = dialog.open, returnId = selected?.id;
    animation?.cancel();
    if (button) trigger = button;
    if (updateAddress) address(id);
    dialog.dataset.changing = 'true';
    status.textContent = '';
    const loading = setTimeout(() => {
      if (turn === revision && dialog.open) status.textContent = 'Loading document…';
    }, 200);
    try {
      const docs = await documents();
      if (turn !== revision) return;
      const doc = id === 'research' ? null : docs.find(item => item.id === id);
      if (id !== 'research' && !doc) { id = 'research'; address(id, true); }
      const content = doc ? await documentPages(doc) : await collectionCards(docs);
      if (turn !== revision) return;
      clearTimeout(loading); status.textContent = '';
      if (wasOpen) await shutter(false);
      if (turn !== revision) return;
      // This swap happens behind the closed shutter, within the fixed shell.
      if (doc) showDocument(doc, content); else showCollection(content);
      if (!wasOpen) {
        // Initial opening uses only the dialog shutter, with decoded content.
        window.AXDDialogs.open(dialog);
        layout();
        get('dismiss').focus({ preventScroll: true });
      } else {
        layout();
        const closing = animation;
        const opening = shutter(true);
        closing?.cancel();
        await opening;
        if (turn !== revision) return;
        animation?.cancel(); animation = null;
        if (doc) viewport.focus({ preventScroll: true });
        else (index.querySelector(`[data-document="${returnId}"]`) || index.querySelector('a'))?.focus({ preventScroll: true });
      }
    } catch (error) {
      if (turn !== revision) return;
      if (!dialog.open) {
        showCollection([]);
        window.AXDDialogs.open(dialog);
        get('dismiss').focus({ preventScroll: true });
      }
      status.textContent = error.message || 'This document could not load. Please reopen it to try again.';
    } finally {
      clearTimeout(loading);
      if (turn === revision) { animation?.cancel(); animation = null; delete dialog.dataset.changing; }
    }
  }
  for (const kind of ['cv', 'research']) {
    const button = document.getElementById(`${kind}-open`);
    button.hidden = false;
    button.addEventListener('pointerenter', () => documents().catch(() => {}));
    button.addEventListener('focus', () => documents().catch(() => {}));
    button.addEventListener('click', () => navigate(kind, button));
  }
  back.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); event.stopPropagation(); navigate('research');
  });
  zoomIn.addEventListener('click', () => zoom.set(zoom.scale * 1.25));
  zoomOut.addEventListener('click', () => zoom.set(zoom.scale / 1.25));
  fit.addEventListener('click', () => zoom.set(1));
  viewport.addEventListener('scroll', scheduleCount, { passive: true });
  const resized = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => layout());
  };
  window.addEventListener('resize', resized, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resized).observe(viewport);
  const close = () => {
    revision++; animation?.cancel(); animation = null; delete dialog.dataset.changing;
    window.AXDDialogs.close(dialog);
  };
  get('dismiss').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    revision++; animation?.cancel(); animation = null;
    if (linked()) address(null, true);
    trigger?.focus({ preventScroll: true });
  });
  dialog.addEventListener('contextmenu', event => { if (event.target.closest('.library-page img')) event.preventDefault(); });
  dialog.addEventListener('dragstart', event => { if (event.target.closest('img')) event.preventDefault(); });
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  let backdropPress = false;
  dialog.addEventListener('pointerdown', event => { backdropPress = outside(event); });
  dialog.addEventListener('pointercancel', () => { backdropPress = false; });
  dialog.addEventListener('click', event => { if (backdropPress && outside(event)) close(); backdropPress = false; });
  const followAddress = () => {
    const id = linked();
    if (id && location.pathname === '/about') navigate(id, document.getElementById(id === 'cv' ? 'cv-open' : 'research-open'), false);
    else { revision++; if (dialog.open) close(); }
  };
  window.addEventListener('popstate', followAddress);
  followAddress();
})();
