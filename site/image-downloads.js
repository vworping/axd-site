(() => {
  'use strict';
  const dialog = document.getElementById('image-save-dialog');
  const save = document.getElementById('image-save');
  const copy = document.getElementById('image-copy');
  const status = document.getElementById('image-save-status');
  let selected;
  let cachedBlob;
  let returnFocus;
  let holding;
  let press;
  let suppressClickUntil = 0;

  // Adapted from tools/watermark_web_images.py: scale lettering to the image,
  // choose contrasting ink, and give each mark an opposite-color outline.
  // This is a courtesy export flow, not protection against direct asset access.
  async function watermarkedCopy(source) {
    const image = new Image();
    image.src = source;
    await image.decode();
    if (document.fonts) await document.fonts.load('900 32px Archivo');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image export is unavailable in this browser.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let luminance = 0;
    let samples = 0;
    for (let i = 0; i < sample.length; i += 160) {
      luminance += .2126 * sample[i] + .7152 * sample[i + 1] + .0722 * sample[i + 2];
      samples++;
    }
    const lightInk = luminance / samples < 138;
    const size = Math.max(24, Math.min(canvas.width, canvas.height) * .085);
    ctx.font = `900 ${size}px Archivo, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lightInk ? 'rgba(255,255,255,.42)' : 'rgba(0,0,0,.36)';
    ctx.strokeStyle = lightInk ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.30)';
    ctx.lineWidth = Math.max(1, size * .025);
    const spacingX = ctx.measureText('[AXD.]').width * 1.55;
    const spacingY = size * 2.6;
    const radius = Math.hypot(canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 7);
    let row = 0;
    for (let y = -radius; y <= radius; y += spacingY, row++) {
      for (let x = -radius; x <= radius; x += spacingX) {
        const at = x + (row % 2 ? spacingX / 2 : 0);
        ctx.strokeText('[AXD.]', at, y);
        ctx.fillText('[AXD.]', at, y);
      }
    }
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create an image copy.')), 'image/png'));
  }

  function findImage(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('img') || target.closest('.deck-print,.collab-print,.gallery-expand')?.querySelector('img');
  }

  function openOptions(image) {
    if (dialog.open || !image || !image.currentSrc && !image.src) return;
    selected = image.currentSrc || image.src;
    cachedBlob = null;
    returnFocus = document.activeElement;
    status.textContent = '';
    save.disabled = false;
    copy.hidden = !navigator.clipboard?.write || !window.ClipboardItem;
    copy.disabled = false;
    window.AXDDialogs.open(dialog);
  }

  function getCopy() { return cachedBlob ||= watermarkedCopy(selected).catch(error => { cachedBlob = null; throw error; }); }
  function busy(value) { save.disabled = value; copy.disabled = value; }
  save.addEventListener('click', async () => {
    busy(true);
    status.textContent = 'Preparing your copy…';
    try {
      const blob = await getCopy();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = decodeURIComponent(new URL(selected, location.href).pathname.split('/').pop()).replace(/\.[^.]+$/, '');
      link.download = `${filename}-AXD-watermarked.png`;
      link.href = url;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'Your watermarked copy is ready.';
    } catch {
      status.textContent = 'Could not prepare this image. Please try again.';
    } finally { busy(false); }
  });
  copy.addEventListener('click', async () => {
    busy(true);
    status.textContent = 'Preparing your copy…';
    try {
      // Pass the promise immediately so Safari retains the button gesture.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': getCopy() })]);
      status.textContent = 'Watermarked image copied.';
    } catch {
      status.textContent = 'Copy is unavailable here. Use Save image instead.';
    } finally { busy(false); }
  });
  document.getElementById('image-save-dismiss').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => returnFocus?.focus({ preventScroll: true }));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener('contextmenu', event => {
    const image = findImage(event.target);
    if (!image) return;
    event.preventDefault();
    openOptions(image);
  });
  document.addEventListener('dragstart', event => { if (findImage(event.target)) event.preventDefault(); });
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    const image = findImage(event.target);
    if (!image) return;
    press = { x: event.clientX, y: event.clientY };
    holding = setTimeout(() => {
      suppressClickUntil = performance.now() + 700;
      openOptions(image);
      press = null;
    }, 600);
  }, { passive: true });
  document.addEventListener('pointermove', event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) { clearTimeout(holding); press = null; }
  }, { passive: true });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => { clearTimeout(holding); press = null; }, { passive: true });
  document.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && findImage(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('keydown', event => {
    if ((event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) && findImage(event.target)) {
      event.preventDefault();
      openOptions(findImage(event.target));
    }
  });
})();
