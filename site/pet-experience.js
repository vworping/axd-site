(() => {
  'use strict';
  const viewer = document.getElementById('image-viewer');
  const viewerImage = document.getElementById('viewer-image');
  const motion = document.getElementById('motion-toggle');
  const preview = document.getElementById('os-preview');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const brandGradients = [...document.querySelectorAll('.wordmark linearGradient')];
  let brandFrame = 0;
  const images = [...document.querySelectorAll('[data-gallery="device"]')];
  let current = images.length - 1, opener, paused = reduced.matches;
  // Use the main portfolio's continuous gradient movement and bracket geometry.
  function paintBrand(now) {
    brandFrame = 0;
    const seconds = paused ? 0 : now / 1000;
    brandGradients.forEach((gradient, side) => {
      const phase = seconds * .33 + side * .85;
      gradient.setAttribute('gradientTransform', `translate(0 ${22 * Math.sin(phase)}) rotate(${16 * Math.sin(phase * .65)} 80 30)`);
    });
    if (!paused && !document.hidden) brandFrame = requestAnimationFrame(paintBrand);
  }
  function updateMotion() {
    cancelAnimationFrame(brandFrame);
    paintBrand(performance.now());
    document.body.classList.toggle('motion-paused', paused);
    document.body.classList.toggle('motion-hidden', document.hidden);
    motion.textContent = paused ? 'Play motion' : 'Pause motion';
    motion.setAttribute('aria-pressed', String(paused));
    document.dispatchEvent(new CustomEvent('axd:motion', { detail: { paused } }));
    preview.contentWindow?.postMessage({ type: 'pet:motion', paused: paused || document.hidden }, location.origin);
  }
  function displayImage() {
    const button = images[current], source = button.querySelector('img');
    viewerImage.src = source.currentSrc || source.src;
    viewerImage.alt = source.alt;
    viewerImage.width = Number(source.getAttribute('width'));
    viewerImage.height = Number(source.getAttribute('height'));
    viewer.style.setProperty('--image-ratio', viewerImage.width / viewerImage.height);
    document.getElementById('viewer-title').textContent = button.dataset.title;
    document.getElementById('viewer-description').textContent = button.dataset.description;
    document.getElementById('viewer-count').textContent = `${current + 1} / ${images.length}`;
  }
  function renderDeck() {
    images.forEach((button, index) => {
      button.closest('.device-print').classList.toggle('is-front', index === current);
      button.closest('.device-print').classList.toggle('is-back', index !== current);
    });
    if (viewer.open) displayImage();
  }
  function move(direction) { current = (current + direction + images.length) % images.length; renderDeck(); }
  function openImage(trigger) {
    opener = trigger;
    displayImage();
    window.AXDDialogs.open(viewer);
    document.getElementById('close-viewer').focus({ preventScroll: true });
  }
  images.forEach((button, index) => {
    button.disabled = false;
    const prioritize = () => { if (!viewer.open) { current = index; renderDeck(); } };
    button.closest('.device-print').addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') prioritize();
    });
    button.addEventListener('focus', prioritize);
    button.addEventListener('click', () => { current = index; renderDeck(); openImage(button); });
  });
  document.getElementById('previous-image').addEventListener('click', () => move(-1));
  document.getElementById('next-image').addEventListener('click', () => move(1));
  document.getElementById('close-viewer').addEventListener('click', () => window.AXDDialogs.close(viewer));
  viewer.addEventListener('cancel', event => { event.preventDefault(); window.AXDDialogs.close(viewer); });
  const arrowNavigation = event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  };
  viewer.addEventListener('keydown', arrowNavigation);
  document.querySelector('.device-gallery').addEventListener('keydown', arrowNavigation);
  viewer.addEventListener('click', event => {
    const rect = viewer.getBoundingClientRect();
    if (event.target === viewer && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) window.AXDDialogs.close(viewer);
  });
  viewer.addEventListener('close', () => opener?.focus({ preventScroll: true }));
  motion.addEventListener('click', () => { paused = !paused; updateMotion(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; updateMotion(); });
  document.addEventListener('visibilitychange', updateMotion);
  preview.addEventListener('load', updateMotion);
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== preview.contentWindow) return;
    if (event.data?.type === 'pet:height' && Number.isFinite(event.data.height)) preview.style.height = `${Math.max(240, Math.min(1400, event.data.height))}px`;
  });
  motion.hidden = false;
  renderDeck();
  updateMotion();
})();
