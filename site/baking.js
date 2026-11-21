(() => {
  'use strict';
  const tab = document.getElementById('baking-open');
  const dialog = document.getElementById('baking-dialog');
  if (!tab || !dialog || !window.AXDDialogs) return;
  const pages = dialog.querySelector('.baking-pages');
  const grid = document.getElementById('kitchen-grid');
  const status = document.getElementById('kitchen-status');
  const placeholders = [...grid.children].map(child => child.cloneNode(true));
  let signature = '';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 701px)');
  let paused = document.getElementById('motion-toggle')?.getAttribute('aria-pressed') === 'true';
  let stopCards = [];
  const visibleVideos = new WeakMap();
  const videoPlayers = new WeakMap();
  const videoObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    entries.forEach(entry => visibleVideos.set(entry.target, entry.isIntersecting && entry.intersectionRatio > .1));
    syncVideos();
  }, { root: pages, threshold: [0, .1] }) : null;
  const canPlayVideo = video => dialog.open && !document.hidden && !paused && !reduced.matches && (!videoObserver || visibleVideos.get(video));
  function syncVideos(resumed = false) {
    grid.querySelectorAll('video').forEach(video => {
      if (resumed && videoObserver) {
        // A sleeping tab can retain an obsolete IntersectionObserver result.
        const rect = video.getBoundingClientRect(), board = pages.getBoundingClientRect();
        const card = video.closest('.kitchen-card-pages').getBoundingClientRect();
        const width = Math.max(0, Math.min(rect.right, board.right, card.right) - Math.max(rect.left, board.left, card.left));
        const height = Math.max(0, Math.min(rect.bottom, board.bottom, card.bottom) - Math.max(rect.top, board.top, card.top));
        visibleVideos.set(video, width * height / Math.max(1, rect.width * rect.height) > .1);
      }
      videoPlayers.get(video)?.sync(resumed);
    });
  }
  document.addEventListener('axd:motion', event => {
    paused = event.detail.paused;
    if (paused) stopCards.forEach(stop => stop());
    syncVideos();
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) stopCards.forEach(stop => stop());
    syncVideos();
  });
  tab.hidden = false;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  function formattedText(text, defaultList) {
    const content = node('div', 'kitchen-text');
    for (const block of window.AXDKitchenText(text, defaultList)) {
      const element = node(block.type, '', block.text);
      if (block.blankLines) element.style.marginTop = `${block.blankLines * 1.55}em`;
      for (const item of block.items || []) {
        const li = node('li', '', item.text);
        if (block.type === 'ol') li.value = item.number;
        element.append(li);
      }
      content.append(element);
    }
    return content;
  }
  function disclosure(panel, label, layout) {
    const button = node('button', 'kitchen-toggle');
    const icon = node('span', '', '+');
    icon.setAttribute('aria-hidden', 'true');
    button.type = 'button';
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `Show ${label}`);
    button.append(icon);
    panel.hidden = true;
    let expanded = false, animation = null, revision = 0;
    button.addEventListener('click', async () => {
      const turn = ++revision;
      expanded = !expanded;
      animation?.cancel();
      layout.prepare();
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} ${label}`);
      icon.textContent = expanded ? '−' : '+';
      panel.hidden = false;
      if (expanded) layout.reveal(panel);
      if (!reduced.matches && !paused && typeof panel.animate === 'function') {
        animation = window.AXDSnapshot(panel, expanded);
        await animation.finished.catch(() => {});
      }
      if (revision !== turn) return;
      panel.hidden = !expanded;
      animation = null;
      layout.settle();
    });
    return button;
  }
  function recipeSection(recipe, entry, layout) {
    if (!recipe?.ingredients?.trim() && !recipe?.method?.trim()) return null;
    const details = node('section', 'kitchen-recipe');
    const heading = node('div', 'kitchen-caption-heading');
    const body = node('div');
    body.id = `recipe-${entry.id}`;
    heading.append(node('h4', '', 'Recipe'), disclosure(body, `recipe for ${entry.title}`, layout));
    details.append(heading, body);
    for (const [key, title, tag] of [['ingredients', 'Ingredients', 'ul'], ['method', 'Method', 'ol']]) {
      if (!recipe[key]?.trim()) continue;
      body.append(node('h4', '', title), formattedText(recipe[key], tag));
    }
    return details;
  }
  function card(entry) {
    const print = node('figure', 'baking-print');
    print.dataset.dish = entry.id;
    const viewport = node('div', 'kitchen-card-pages');
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'group');
    viewport.setAttribute('aria-label', `${entry.title}: photos and details`);
    print.append(viewport);
    let held = false;
    const layout = {
      prepare() {
        // Hold this card's closed footprint; opening details never lengthens the board.
        if (!desktop.matches || held) return;
        viewport.style.setProperty('--kitchen-card-height', `${viewport.offsetHeight}px`);
        held = true;
      },
      reveal(panel) {
        if (desktop.matches) viewport.scrollTop = Math.max(0, panel.offsetTop - (panel.previousElementSibling?.offsetHeight || 44) - 8);
      },
      settle() {
        if ([...viewport.querySelectorAll('.kitchen-toggle')].some(button => button.getAttribute('aria-expanded') === 'true')) return;
        viewport.style.removeProperty('--kitchen-card-height');
        viewport.scrollTop = 0;
        held = false;
      },
    };
    const media = entry.media || (entry.photo ? [{ ...entry.photo, type: 'image' }] : []);
    const frame = node('div', 'kitchen-media-frame');
    const stage = node('div', 'kitchen-media-stage');
    frame.append(stage);
    let active = 0, requested = 0, busy = false, generation = 0, shutter = null, resize = null;
    const count = node('span', 'kitchen-media-count');
    count.setAttribute('aria-live', 'polite');
    function createMedia(item) {
      const element = node(item.type === 'video' ? 'video' : 'img');
      element.width = item.width;
      element.height = item.height;
      if (item.type === 'video') {
        element.controls = false;
        element.muted = true;
        element.defaultMuted = true;
        element.loop = true;
        element.playsInline = true;
        element.setAttribute('muted', '');
        element.setAttribute('webkit-playsinline', '');
        element.setAttribute('controlslist', 'nodownload noplaybackrate nofullscreen noremoteplayback');
        element.disablePictureInPicture = true;
        element.disableRemotePlayback = true;
        element.addEventListener('dblclick', event => event.preventDefault());
        element.addEventListener('contextmenu', event => event.preventDefault());
        element.preload = 'metadata';
        element.poster = media.find(candidate => candidate.type === 'image')?.src || '';
        element.setAttribute('aria-label', item.alt || entry.title);
      } else {
        element.alt = item.alt || entry.title;
        element.loading = 'lazy';
        element.decoding = 'async';
      }
      element.src = item.src;
      return element;
    }
    function show(index, element = createMedia(media[index])) {
      const previousVideo = stage.querySelector('video');
      previousVideo?.pause();
      if (previousVideo) { videoObserver?.unobserve(previousVideo); videoPlayers.get(previousVideo)?.dispose(); }
      active = index;
      const item = media[active];
      if (item.width && item.height) stage.style.aspectRatio = `${item.width} / ${item.height}`;
      stage.replaceChildren(element);
      count.textContent = `${active + 1} / ${media.length}`;
      count.setAttribute('aria-label', `${item.type === 'video' ? 'Video' : 'Photo'} ${active + 1} of ${media.length}`);
      if (item.type === 'video') {
        videoPlayers.set(element, window.AXDKitchenVideo(element, () => canPlayVideo(element)));
        videoObserver?.observe(element);
      }
      syncVideos();
    }
    function ready(element, item) {
      if (item.type !== 'video') { element.loading = 'eager'; return element.decode(); }
      element.preload = 'auto';
      if (element.readyState >= 2) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const done = error => {
          clearTimeout(timeout);
          element.removeEventListener('loadeddata', loaded);
          element.removeEventListener('error', failed);
          error ? reject(error) : resolve();
        };
        const loaded = () => done();
        const failed = () => done(new Error('Video could not load'));
        const timeout = setTimeout(failed, 15000);
        element.addEventListener('loadeddata', loaded, { once: true });
        element.addEventListener('error', failed, { once: true });
      });
    }
    async function advance(direction) {
      requested = (requested + direction + media.length) % media.length;
      if (busy) return;
      busy = true;
      const turn = generation;
      try {
        // Finish each shutter before taking the latest queued selection.
        // Decoding first keeps an unloaded image from flashing into the frame.
        while (active !== requested && turn === generation) {
          const next = requested, item = media[next], incoming = createMedia(item);
          await ready(incoming, item);
          if (turn !== generation || !dialog.open) break;
          if (next !== requested) continue;
          const previousHeight = stage.offsetHeight;
          const moving = !reduced.matches && !paused && typeof stage.animate === 'function';
          if (moving) {
            shutter = window.AXDSnapshot(stage, false, { fill: 'forwards' });
            await shutter.finished.catch(() => {});
          }
          if (turn !== generation || !dialog.open) break;
          show(next, incoming);
          shutter?.cancel();
          if (moving) {
            if (previousHeight !== stage.offsetHeight) resize = stage.animate([
              { height: `${previousHeight}px` }, { height: `${stage.offsetHeight}px` }
            ], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
            shutter = window.AXDSnapshot(stage, true);
            await Promise.all([shutter.finished, resize?.finished].map(pending => pending?.catch(() => {})));
          }
          shutter = null;
          resize = null;
        }
      } catch {
        if (turn === generation) {
          requested = active;
          status.textContent = 'That photo or video could not load. Please try the arrow again.';
        }
      } finally {
        shutter?.cancel();
        resize?.cancel();
        shutter = null;
        resize = null;
        busy = false;
      }
    }
    stopCards.push(() => { generation++; requested = active; shutter?.cancel(); resize?.cancel(); shutter = null; resize = null; });
    viewport.append(frame);
    if (media.length) show(0);
    if (media.length > 1) {
      const previous = node('button', 'kitchen-media-arrow kitchen-media-previous');
      const next = node('button', 'kitchen-media-arrow kitchen-media-next');
      for (const [button, arrow] of [[previous, '←'], [next, '→']]) {
        button.type = 'button';
        const icon = node('span', '', arrow);
        icon.setAttribute('aria-hidden', 'true');
        button.append(icon);
      }
      previous.setAttribute('aria-label', `Previous photo or video of ${entry.title}`);
      next.setAttribute('aria-label', `Next photo or video of ${entry.title}`);
      previous.addEventListener('click', () => advance(-1));
      next.addEventListener('click', () => advance(1));
      frame.append(previous, next, count);
    }
    const caption = node('figcaption');
    const title = node('h3', '', entry.title);
    title.tabIndex = -1;
    const heading = node('div', 'kitchen-caption-heading');
    heading.append(title);
    frame.append(node('span', `kitchen-sticker${entry.kind === 'cooking' ? ' kitchen-sticker--cooking' : ''}`, entry.kind === 'baking' ? 'BAKING' : 'COOKING'));
    caption.append(heading);
    if (entry.description?.trim()) {
      const description = formattedText(entry.description);
      description.id = `description-${entry.id}`;
      heading.append(disclosure(description, `description for ${entry.title}`, layout));
      caption.append(description);
    }
    const recipe = recipeSection(entry.recipe, entry, layout);
    if (recipe) caption.append(recipe);
    viewport.append(caption);
    return print;
  }
  async function load() {
    try {
      const response = await fetch('/assets/data/kitchen.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('The kitchen could not be loaded. Please refresh to try again.');
      const data = await response.json();
      const next = JSON.stringify(data.entries);
      if (next !== signature) {
        stopCards.forEach(stop => stop());
        stopCards = [];
        grid.querySelectorAll('video').forEach(video => videoPlayers.get(video)?.dispose());
        videoObserver?.disconnect();
        grid.replaceChildren(...(data.entries.length ? data.entries.map(card) : placeholders.map(child => child.cloneNode(true))));
        signature = next;
      }
      status.textContent = '';
      syncVideos();
    } catch (error) { status.textContent = error.message || 'The kitchen could not be loaded. Please refresh to try again.'; }
  }
  const updates = 'BroadcastChannel' in window ? new BroadcastChannel('axd-kitchen') : null;
  if (updates) updates.onmessage = () => load();
  const resumeVideos = () => { if (dialog.open) { syncVideos(true); load(); } };
  window.addEventListener('focus', resumeVideos);
  window.addEventListener('pageshow', resumeVideos);
  window.addEventListener('online', resumeVideos);
  document.addEventListener('resume', resumeVideos);
  document.addEventListener('visibilitychange', () => {
    syncVideos(!document.hidden);
    if (document.hidden) stopCards.forEach(stop => stop());
    else if (dialog.open) load();
  });

  function open() {
    load();
    window.AXDDialogs.open(dialog);
    pages.scrollTop = 0;
    document.getElementById('baking-dismiss').focus({ preventScroll: true });
    syncVideos(true);
  }
  tab.addEventListener('click', open);
  if (new URLSearchParams(location.search).get('kitchen') === '1') open();
  const close = () => window.AXDDialogs.close(dialog);
  document.getElementById('baking-dismiss').addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', () => {
    stopCards.forEach(stop => stop());
    syncVideos();
    tab.focus({ preventScroll: true });
  });

  // Only dismiss a gesture that starts and ends on the backdrop.
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  let backdropPress = false;
  dialog.addEventListener('pointerdown', event => { backdropPress = outside(event); });
  dialog.addEventListener('pointercancel', () => { backdropPress = false; });
  dialog.addEventListener('click', event => {
    if (backdropPress && outside(event)) close();
    backdropPress = false;
  });
})();
