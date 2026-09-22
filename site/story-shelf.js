(() => {
  'use strict';
  const shelf = document.getElementById('story-shelf');
  if (!shelf) return;
  const projects = window.PROJECTS || [];
  const compact = matchMedia('(max-width: 700px), (orientation: landscape) and (max-height: 600px) and (max-width: 1100px)');
  const cards = [];
  let active = 0;

  // Numeric dimensions avoid Safari's container-unit/percentage-transform
  // interaction. Centering itself is done by grid, never by translate(-50%).
  function mobileFrame(width, height, ratio, slot) {
    const poses = [[0, .09, -3, 1], [-.16, -.17, -12, .84], [.17, -.15, 11, .84], [.17, .12, 9, .78]];
    const [dx, dy, angle, scale] = poses[slot];
    const imageWidth = Math.max(1, Math.min(width * .62 - 12, (height * .64 - 32) * ratio) * scale);
    const imageHeight = imageWidth / ratio;
    const radians = Math.abs(angle) * Math.PI / 180;
    const halfWidth = ((imageWidth + 12) * Math.cos(radians) + (imageHeight + 32) * Math.sin(radians)) / 2;
    const halfHeight = ((imageWidth + 12) * Math.sin(radians) + (imageHeight + 32) * Math.cos(radians)) / 2;
    // Bound the additional .65-degree tilt by the corner's arc length.
    const tiltAllowance = Math.hypot(imageWidth + 12, imageHeight + 32) / 2 * .65 * Math.PI / 180;
    // Six pixels of floating movement, plus room around the rotated frame.
    const clampOffset = (wanted, extent, half) => {
      const limit = Math.max(0, extent / 2 - half - tiltAllowance - 12);
      return Math.max(-limit, Math.min(limit, wanted));
    };
    return { imageWidth, imageHeight, x: clampOffset(width * dx, width, halfWidth), y: clampOffset(height * dy, height, halfHeight), angle };
  }

  const previewObserver = new ResizeObserver(entries => {
    if (!compact.matches) return;
    entries.forEach(({ target, contentRect: { width, height } }) => {
      if (!width || !height) return;
      target.querySelectorAll('.collab-paper').forEach(paper => {
        const frame = mobileFrame(width, height, Number(paper.dataset.ratio), Number(paper.parentElement.dataset.slot));
        paper.style.setProperty('--photo-width', `${frame.imageWidth}px`);
        paper.style.setProperty('--photo-height', `${frame.imageHeight}px`);
        paper.style.setProperty('--float-x', `${frame.x}px`);
        paper.style.setProperty('--float-y', `${frame.y}px`);
        paper.style.setProperty('--float-angle', `${frame.angle}deg`);
      });
      target.classList.add('is-positioned');
    });
  });

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  const imageLoads = new WeakMap();
  let selectionVersion = 0;

  function prepareImage(img) {
    if (imageLoads.has(img)) return imageLoads.get(img);
    // Stable sizes prevent a new responsive-image request on every hover.
    img.sizes = '(max-width: 700px) 60vw, 28vw';
    img.loading = 'eager';
    img.srcset = img.dataset.srcset || '';
    img.src = img.dataset.src;
    const ready = img.decode().then(() => {
      img.closest('.collab-paper').classList.add('is-image-ready');
    }).catch(() => {
      // A failed image must not prevent choosing a story or opening its details.
      if (img.naturalWidth) img.closest('.collab-paper').classList.add('is-image-ready');
    });
    imageLoads.set(img, ready);
    return ready;
  }

  async function select(index) {
    const version = ++selectionVersion;
    shelf.setAttribute('aria-busy', 'true');
    // Keep the current fan visible until the next set is decoded, then switch
    // all its prints together. Rapid hovering cannot reveal an outdated set.
    await Promise.all([...cards[index].link.querySelectorAll('img')].map(prepareImage));
    if (version !== selectionVersion) return;
    active = index;
    cards.forEach(({ card, link, button }, i) => {
      card.classList.toggle('is-active', i === index);
      button.setAttribute('aria-pressed', String(i === index));
      link.inert = compact.matches && i !== index;
    });
    shelf.removeAttribute('aria-busy');
  }

  projects.forEach((project, index) => {
    const title = project.preview?.title || project.title;
    const order = project.preview?.order || project.images.map((_, i) => i);
    const card = node('article', 'collab-card');
    const link = node('a', 'collab-prints');
    link.id = `story-preview-${project.slug}`;
    link.href = project.cover.src;
    link.dataset.project = project.slug;
    link.setAttribute('aria-label', `View ${title}`);
    // Cover is the first entry; CSS layers it above the other three prints.
    const photos = order.slice(0, 4).map(i => project.images[i]).filter(Boolean);
    photos.forEach((photo, slot) => {
      const print = node('span', `collab-print ${slot === 0 ? 'collab-print--cover' : 'collab-print--behind'}`);
      print.style.setProperty('--slot', slot);
      print.dataset.slot = slot;
      const img = node('img');
      // Keep the hidden back prints off the network until this story is selected.
      img.dataset.src = photo.previewSrc || photo.src.replace(/\.jpg$/i, '-1200.webp');
      if (!photo.previewSrc) {
        const edge = Math.max(photo.width, photo.height);
        img.dataset.srcset = `${encodeURI(photo.src.replace(/\.jpg$/i, '-640.webp'))} ${Math.round(photo.width * 640 / edge)}w, ${encodeURI(img.dataset.src)} ${Math.round(photo.width * 1200 / edge)}w`;
      }
      img.decoding = 'async';
      img.alt = slot === 0 ? (photo.alt || `${title} — photograph ${order[slot] + 1}`) : '';
      img.width = photo.width;
      img.height = photo.height;
      img.loading = 'lazy';
      img.draggable = false;
      const paper = node('span', 'collab-paper');
      paper.dataset.ratio = photo.width / photo.height;
      paper.append(img);
      if (slot === 0) paper.append(node('span', 'collab-action', 'View story'));
      print.append(paper);
      link.append(print);
    });
    const button = node('button', 'story-select');
    button.type = 'button';
    button.setAttribute('aria-label', `Preview ${title}`);
    button.setAttribute('aria-controls', link.id);
    button.append(node('span', 'story-title', title));
    const meta = node('span', 'collab-meta');
    meta.append(node('span', '', project.meta), node('span', '', project.year));
    button.append(meta);
    card.append(link, button);
    shelf.append(card);
    previewObserver.observe(link);
    cards.push({ card, link, button });
    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && !compact.matches) select(index);
    });
    card.addEventListener('focusin', () => select(index));
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
      cards[next].button.focus({ preventScroll: true });
    });
  });
  compact.addEventListener('change', () => select(active));
  document.addEventListener('axd:motion', event => {
    shelf.classList.toggle('motion-paused', event.detail.paused);
  });
  const syncVisibility = () => shelf.classList.toggle('motion-hidden', document.hidden);
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  cards.forEach(({ link }) => prepareImage(link.querySelector('img')));
  select(0);
})();
