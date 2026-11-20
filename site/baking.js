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
  document.addEventListener('axd:motion', event => { paused = event.detail.paused; });
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
    let active = 0;
    const count = node('span', 'kitchen-media-count');
    count.setAttribute('aria-live', 'polite');
    function show(index) {
      stage.querySelector('video')?.pause();
      active = (index + media.length) % media.length;
      const item = media[active];
      if (item.width && item.height) stage.style.aspectRatio = `${item.width} / ${item.height}`;
      const element = node(item.type === 'video' ? 'video' : 'img');
      element.src = item.src;
      element.width = item.width;
      element.height = item.height;
      if (item.type === 'video') {
        element.controls = true;
        element.playsInline = true;
        element.setAttribute('webkit-playsinline', '');
        element.setAttribute('controlslist', 'nofullscreen noremoteplayback');
        element.disablePictureInPicture = true;
        element.disableRemotePlayback = true;
        element.addEventListener('dblclick', event => event.preventDefault());
        element.preload = 'metadata';
        element.setAttribute('aria-label', item.alt || entry.title);
      } else {
        element.alt = item.alt || entry.title;
        element.loading = 'lazy';
        element.decoding = 'async';
      }
      stage.replaceChildren(element);
      count.textContent = `${active + 1} / ${media.length}${item.type === 'video' ? ' · video' : ''}`;
    }
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
      previous.addEventListener('click', () => show(active - 1));
      next.addEventListener('click', () => show(active + 1));
      frame.append(previous, next);
      viewport.append(count);
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
        grid.querySelectorAll('video').forEach(video => video.pause());
        grid.replaceChildren(...(data.entries.length ? data.entries.map(card) : placeholders.map(child => child.cloneNode(true))));
        signature = next;
      }
      status.textContent = '';
    } catch (error) { status.textContent = error.message || 'The kitchen could not be loaded. Please refresh to try again.'; }
  }
  const updates = 'BroadcastChannel' in window ? new BroadcastChannel('axd-kitchen') : null;
  if (updates) updates.onmessage = () => load();
  window.addEventListener('focus', () => { if (dialog.open) load(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) grid.querySelectorAll('video').forEach(video => video.pause());
    else if (dialog.open) load();
  });

  function open() {
    load();
    window.AXDDialogs.open(dialog);
    pages.scrollTop = 0;
    document.getElementById('baking-dismiss').focus({ preventScroll: true });
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
    grid.querySelectorAll('video').forEach(video => video.pause());
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
