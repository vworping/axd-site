(() => {
  'use strict';
  const photos = window.ABOUT_PORTRAITS || [];
  let image = document.getElementById('about-portrait');
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
  let animations = [], outgoing = [];
  const swatches = photos[0].palette.map(() => document.createElement('span'));
  palette.replaceChildren(...swatches);
  card.querySelector('.portrait-controls').hidden = false;

  const sources = photo => `${photo.src.replace('.webp', '-small.webp')} ${Math.round(photo.width * 640 / Math.max(photo.width, photo.height))}w, ${photo.src} ${photo.width}w`;
  const canMove = () => !reduced.matches && !paused && !document.hidden && !chapter.inert;
  function settle() {
    image.style.opacity = '1';
    animations.forEach(animation => animation.cancel());
    animations = [];
    outgoing.forEach(layer => layer.remove());
    outgoing = [];
  }
  function updatePalette(photo, moving, previous = []) {
    palette.setAttribute('aria-label', `Five colors extracted from this photograph: ${photo.palette.map(color => `${color.hex}, ${(color.weight * 100).toFixed(1)} percent`).join('; ')}`);
    photo.palette.forEach((color, i) => {
      const swatch = swatches[i];
      const before = previous[i];
      // A flex-grow total below 1 leaves unfilled space. Keep the weights well
      // above that threshold even while the staggered bands are interpolating.
      const grow = color.weight * 100;
      swatch.style.backgroundColor = color.hex;
      swatch.style.flexGrow = grow;
      swatch.title = `${color.hex.toUpperCase()} · ${(color.weight * 100).toFixed(1)}% of the retained sample`;
      if (moving) animations.push(swatch.animate([before, { backgroundColor: color.hex, flexGrow: grow }],
        { duration: 680, delay: i * 35, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }));
    });
  }
  function preload(next) {
    if (!cache.has(next)) {
      const photo = photos[next];
      const pending = new Image();
      pending.decoding = 'async';
      pending.loading = 'eager';
      pending.sizes = image.sizes;
      pending.srcset = sources(photo);
      pending.src = photo.src;
      cache.set(next, pending.decode().then(() => pending).catch(error => { cache.delete(next); throw error; }));
    }
    return cache.get(next);
  }
  function warmNext() {
    if (!chapter.inert && !document.hidden) preload((index + 1) % photos.length).catch(() => {});
  }
  async function advance(direction) {
    requested = (requested + direction + photos.length) % photos.length;
    const next = requested, ticket = ++request;
    let incoming;
    try { incoming = await preload(next); } catch {
      if (ticket === request) {
        requested = index;
        status.textContent = 'That photograph could not load. Please try again.';
      }
      return;
    }
    if (ticket !== request || chapter.inert || document.hidden) return;
    if (next === index) return;
    const moving = canMove() && typeof image.animate === 'function';
    // Capture visible colors and proportions before canceling an interrupted
    // animation, so the next transition doesn't jump to its old destination.
    const previous = moving ? swatches.map(swatch => {
      const style = getComputedStyle(swatch);
      return { backgroundColor: style.backgroundColor, flexGrow: style.flexGrow };
    }) : [];
    if (moving) {
      // Freeze the visible composite on a rapid second tap. Removing its old
      // layers here would flash the previous destination at full opacity.
      image.style.opacity = getComputedStyle(image).opacity;
      animations.forEach(animation => animation.cancel());
      animations = [];
    } else settle();
    image.removeAttribute('id');
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.className = 'portrait-outgoing';
    outgoing.push(image);
    index = next;
    const photo = photos[index];
    // Mount the actual decoded element, rather than replacing the source of
    // a visible image (which can briefly repaint empty on mobile browsers).
    cache.delete(next);
    image = incoming;
    image.id = 'about-portrait';
    image.alt = photo.alt;
    image.width = photo.width;
    image.height = photo.height;
    image.style.opacity = moving ? '0' : '1';
    stage.append(image);
    status.textContent = `${photo.label}. Photograph ${index + 1} of ${photos.length}.`;
    updatePalette(photo, moving, previous);
    if (moving) {
      const timing = { duration: 850, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' };
      // The previous composition stays painted underneath until this decoded
      // photograph is opaque. Both layers resize together in the fixed frame.
      animations.push(image.animate([
        { opacity: 0 },
        { opacity: 1 },
      ], timing));
      const batch = animations;
      Promise.all(batch.map(animation => animation.finished.catch(() => {})))
        .then(() => { if (animations === batch) settle(); });
    } else settle();
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
  updatePalette(photos[0], false);
  warmNext();
})();
