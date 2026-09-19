(() => {
  'use strict';
  const photos = window.PHOTOGRAPHS || [];
  const stage = document.querySelector('.deck-stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let busyUntil = 0;

  // Include the padding and rotated print in the fit, not just the image.
  function fitPrint(width, height, ratio, side, top, bottom) {
    const travel = width * .035;
    const sine = Math.sin(9 * Math.PI / 180);
    const horizontal = side * 2 + 2;
    const vertical = top + bottom + 2;
    const imageHeight = Math.max(1, Math.min(
      (width - 2 * travel - 4 - horizontal - sine * vertical) / (ratio + sine),
      (height - 2 * travel - 4 - vertical - sine * horizontal) / (1 + sine * ratio),
    ));
    return { width: imageHeight * ratio + horizontal, height: imageHeight + vertical, travel };
  }

  if (!photos.length) return;
  const prints = photos.map((photo, i) => {
    const print = document.createElement('button');
    print.type = 'button';
    print.className = 'deck-print';
    print.dataset.aspect = photo.width / photo.height;
    const image = document.createElement('img');
    Object.assign(image, { alt: photo.alt, width: photo.width, height: photo.height, draggable: false, decoding: 'async' });
    image.fetchPriority = i === 0 ? 'high' : i === 1 ? 'auto' : 'low';
    const edge = Math.max(photo.width, photo.height);
    image.sizes = '(max-width: 700px) 70vw, (max-width: 1400px) 36vw, 480px';
    image.srcset = `${photo.src.replace('.webp', '-small.webp')} ${Math.round(photo.width * 640 / edge)}w, ${photo.src.replace('.webp', '-medium.webp')} ${Math.round(photo.width * 960 / edge)}w, ${photo.src}?v=8 ${photo.width}w`;
    image.src = `${photo.src}?v=8`;
    const footer = document.createElement('span');
    footer.className = 'print-footer';
    const number = document.createElement('span');
    number.className = 'print-number';
    number.textContent = `AXD / ${String(i + 1).padStart(3, '0')}`;
    const palette = document.createElement('span');
    palette.className = 'frame-palette';
    palette.setAttribute('role', 'img');
    palette.setAttribute('aria-label', `Five colors extracted from this photograph: ${photo.palette.map(c => c.hex).join(', ')}`);
    photo.palette.forEach((color) => {
      const swatch = document.createElement('span');
      swatch.style.backgroundColor = color.hex;
      swatch.style.flexGrow = color.weight * 100;
      swatch.title = `${color.hex.toUpperCase()} · ${(color.weight * 100).toFixed(1)}%`;
      palette.append(swatch);
    });
    footer.append(number, palette);
    print.append(image, footer);
    print.addEventListener('click', () => { if (i === index) advance(1); });
    print.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      advance(event.key === 'ArrowLeft' ? -1 : 1);
    });
    return print;
  });

  function layout() {
    const width = stage.clientWidth;
    if (!width) return;
    const style = getComputedStyle(prints[0]);
    prints.forEach((print) => {
      const size = fitPrint(width, stage.clientHeight, Number(print.dataset.aspect),
        parseFloat(style.paddingLeft), parseFloat(style.paddingTop), parseFloat(style.paddingBottom));
      print.style.width = `${size.width}px`;
      print.style.height = `${size.height}px`;
      stage.style.setProperty('--print-travel', `${size.travel}px`);
    });
  }

  function render() {
    prints.forEach((print, i) => {
      const slot = (i - index + photos.length) % photos.length;
      print.classList.remove('deck-print--front', 'deck-print--middle', 'deck-print--back', 'deck-print--away');
      print.classList.add(`deck-print--${['front', 'middle', 'back'][slot] || 'away'}`);
      print.tabIndex = slot === 0 ? 0 : -1;
      print.setAttribute('aria-hidden', String(slot !== 0));
      print.setAttribute('aria-label', `Next photograph. ${photos[i].alt}`);
      if (slot === 0) { print.id = 'photo-next'; print.setAttribute('aria-describedby', 'deck-hint'); }
      else { print.removeAttribute('id'); print.removeAttribute('aria-describedby'); }
    });
    document.dispatchEvent(new CustomEvent('axd:palette', { detail: { palette: photos[index].palette } }));
  }

  function advance(direction) {
    if (performance.now() < busyUntil) return;
    busyUntil = performance.now() + (reduced.matches ? 0 : 420);
    const previous = prints[index];
    const focused = previous === document.activeElement;
    previous.classList.add('is-leaving');
    index = (index + direction + photos.length) % photos.length;
    render();
    if (focused) prints[index].focus({ preventScroll: true });
    setTimeout(() => previous.classList.remove('is-leaving'), 440);
  }

  stage.replaceChildren(...prints);
  layout();
  render();
  document.getElementById('deck-hint').hidden = false;
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(stage);
  else window.addEventListener('resize', layout, { passive: true });
})();
