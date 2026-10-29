(() => {
  'use strict';
  const photos = window.ABOUT_PORTRAITS || [];
  const image = document.getElementById('about-portrait');
  if (!image || photos.length < 2) return;
  const chapter = document.getElementById('about');
  const card = image.closest('.portrait-card');
  const stage = image.parentElement;
  const palette = document.getElementById('portrait-palette');
  const status = document.getElementById('portrait-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map();
  let index = 0, requested = 0, request = 0;
  let paused = document.getElementById('motion-toggle')?.getAttribute('aria-pressed') === 'true';
  let animations = [], outgoing;
  const swatches = photos[0].palette.map(() => document.createElement('span'));
  palette.replaceChildren(...swatches);
  card.querySelector('.portrait-controls').hidden = false;

  const sources = photo => `${photo.src.replace('.webp', '-small.webp')} ${Math.round(photo.width * 640 / Math.max(photo.width, photo.height))}w, ${photo.src} ${photo.width}w`;
  const canMove = () => !reduced.matches && !paused && !document.hidden && !chapter.inert;
  function settle() {
    animations.forEach(animation => animation.cancel());
    animations = [];
    outgoing?.remove();
    outgoing = null;
  }
  function updatePalette(photo, moving) {
    palette.setAttribute('aria-label', `Five colors extracted from this photograph: ${photo.palette.map(color => `${color.hex}, ${(color.weight * 100).toFixed(1)} percent`).join('; ')}`);
    photo.palette.forEach((color, i) => {
      const swatch = swatches[i];
      const before = { backgroundColor: swatch.style.backgroundColor, flexGrow: swatch.style.flexGrow };
      swatch.style.backgroundColor = color.hex;
      swatch.style.flexGrow = color.weight;
      swatch.title = `${color.hex.toUpperCase()} · ${(color.weight * 100).toFixed(1)}% of the retained sample`;
      if (moving) animations.push(swatch.animate([before, { backgroundColor: color.hex, flexGrow: color.weight }],
        { duration: 680, delay: i * 35, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }));
    });
  }
  function preload(next) {
    if (!cache.has(next)) {
      const photo = photos[next];
      const pending = new Image();
      pending.decoding = 'async';
      pending.sizes = image.sizes;
      pending.srcset = sources(photo);
      pending.src = photo.src;
      cache.set(next, pending.decode().catch(error => { cache.delete(next); throw error; }));
    }
    return cache.get(next);
  }
  function warmNext() {
    if (!chapter.inert && !document.hidden) preload((index + 1) % photos.length).catch(() => {});
  }
  async function advance(direction) {
    requested = (requested + direction + photos.length) % photos.length;
    const next = requested, ticket = ++request;
    try { await preload(next); } catch {
      if (ticket === request) {
        requested = index;
        status.textContent = 'That photograph could not load. Please try again.';
      }
      return;
    }
    if (ticket !== request || chapter.inert || document.hidden) return;
    settle();
    if (next === index) return;
    const moving = canMove() && typeof image.animate === 'function';
    if (moving) {
      outgoing = image.cloneNode();
      outgoing.removeAttribute('id');
      outgoing.removeAttribute('srcset');
      outgoing.src = image.currentSrc || image.src;
      outgoing.alt = '';
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.className = 'portrait-outgoing';
      stage.append(outgoing);
    }
    index = next;
    const photo = photos[index];
    image.srcset = sources(photo);
    image.src = photo.src;
    image.alt = photo.alt;
    image.width = photo.width;
    image.height = photo.height;
    status.textContent = `${photo.label}. Photograph ${index + 1} of ${photos.length}.`;
    updatePalette(photo, moving);
    if (moving) {
      const timing = { duration: 850, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' };
      animations.push(image.animate([
        { opacity: 0, transform: `translateX(${direction * 7}%) scale(1.035)` },
        { opacity: 1, transform: 'translateX(0) scale(1)' },
      ], timing));
      animations.push(outgoing.animate([
        { opacity: 1, transform: 'translateX(0) scale(1)' },
        { opacity: 0, transform: `translateX(${direction * -7}%) scale(.985)` },
      ], timing));
      const batch = animations;
      Promise.all(batch.map(animation => animation.finished.catch(() => {})))
        .then(() => { if (animations === batch) settle(); });
    }
    warmNext();
  }
  document.getElementById('portrait-prev').addEventListener('click', () => advance(-1));
  document.getElementById('portrait-next').addEventListener('click', () => advance(1));
  card.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    advance(event.key === 'ArrowLeft' ? -1 : 1);
  });
  function suspend() { ++request; requested = index; settle(); }
  document.addEventListener('axd:motion', event => { paused = event.detail.paused; if (paused) settle(); });
  reduced.addEventListener('change', () => { if (reduced.matches) settle(); });
  document.addEventListener('axd:chapter', event => { if (event.detail.id !== 'about') suspend(); else warmNext(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else warmNext(); });
  window.addEventListener('resize', settle, { passive: true });
  updatePalette(photos[0], false);
  warmNext();
})();
