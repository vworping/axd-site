(() => {
  'use strict';
  const photos = window.PHOTOGRAPHS || [];
  const stage = document.querySelector('.deck-stage');
  const deck = stage?.closest('.photo-deck');
  const hint = document.getElementById('deck-hint');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const slots = ['front', 'middle', 'back', 'rear', 'base'];
  let index = 0;
  let busyUntil = 0;
  let preparing = false;

  // Include the padding and rotated print in the fit, not just the image.
  function fitPrint(width, height, ratio, left, right, top, bottom) {
    const travel = Math.min(width, height) * .035;
    const sine = Math.sin(9 * Math.PI / 180);
    const horizontal = left + right + 2;
    const vertical = top + bottom + 2;
    const imageHeight = Math.max(1, Math.min(
      (width - 2 * travel - 4 - horizontal - sine * vertical) / (ratio + sine),
      (height - 2 * travel - 4 - vertical - sine * horizontal) / (1 + sine * ratio),
    ));
    return { imageHeight, horizontal, height: imageHeight + vertical, travel };
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
    image.sizes = '(min-width: 2000px) min(40vw, 80vh), (max-width: 700px) 70vw, (max-width: 1400px) 36vw, 480px';
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
    // These are physical prints: a photograph keeps the same dimensions in
    // every slot. A shared height also keeps portraits from towering over squares.
    const size = fitPrint(width, stage.clientHeight, Math.max(...prints.map(print => Number(print.dataset.aspect))),
      parseFloat(style.paddingLeft), parseFloat(style.paddingRight),
      parseFloat(style.paddingTop), parseFloat(style.paddingBottom));
    stage.style.setProperty('--print-travel', `${size.travel}px`);
    const widest = size.imageHeight * Math.max(...prints.map(print => Number(print.dataset.aspect))) + size.horizontal;
    prints.forEach((print) => {
      // Narrow portraits align with the fan's outside edge behind wider prints.
      print.style.setProperty('--print-spread', `${(widest - size.imageHeight * Number(print.dataset.aspect) - size.horizontal) / 2}px`);
      print.style.width = `${size.imageHeight * Number(print.dataset.aspect) + size.horizontal}px`;
      print.style.height = `${size.height}px`;
      print.style.setProperty('--print-height', `${size.height}px`);
    });
    requestAnimationFrame(positionCue);
  }

  function overlaps(a, b) {
    return ![a, b].some(polygon => polygon.some(([x,y], i) => {
      const [nextX,nextY] = polygon[(i + 1) % polygon.length];
      const project = ([px,py]) => px * (nextY - y) - py * (nextX - x);
      const first = a.map(project), second = b.map(project);
      return Math.max(...first) <= Math.min(...second) || Math.max(...second) <= Math.min(...first);
    }));
  }

  // Keep one short up-left curve outside the deck's fixed paper envelope.
  // Move the whole cue instead of clamping its label independently of the tip.
  function positionCue() {
    const svg = hint.querySelector('svg');
    const path = svg.querySelector('path');
    const position = getComputedStyle(deck).getPropertyValue('--deck-cue-position').trim();
    if (!position) {
      hint.style.visibility = '';
      svg.setAttribute('viewBox', '0 0 80 72');
      path.setAttribute('d', window.AXDCuePath([64, 6], [12, 62]));
      return;
    }
    const bounds = deck.getBoundingClientRect();
    const label = hint.querySelector('span');
    const stageBounds = stage.getBoundingClientRect();
    // Reserve the same outline for every photograph in every resting slot.
    // The cue belongs to the deck, so flipping must never move it.
    const width = Math.max(...prints.map(print => parseFloat(print.style.width)));
    const height = parseFloat(prints[0].style.height);
    const travel = parseFloat(stage.style.getPropertyValue('--print-travel'));
    const center = [stageBounds.left - bounds.left + stageBounds.width / 2,
      stageBounds.top - bounds.top + stageBounds.height / 2];
    const papers = [[-3, 0, 0], [7, 1, -.2], [-9, -.8, -.4], [4, .4, -.8], [-5, -.25, 1.4]].map(([angle, tx, ty]) => {
      const cosine = Math.cos(angle * Math.PI / 180), sine = Math.sin(angle * Math.PI / 180);
      return [[-1,-1], [1,-1], [1,1], [-1,1]].map(([x,y]) => {
        x *= width / 2; y *= height / 2;
        return [center[0] + tx * travel + cosine * x - sine * y,
          center[1] + ty * travel + sine * x + cosine * y];
      });
    });
    const right = Math.max(...papers.flat().map(point => point[0]));
    const bottom = Math.max(...papers.flat().map(point => point[1]));
    const centerY = stageBounds.top - bounds.top + stageBounds.height / 2;
    const desired = position === 'side' ? [right + 24, centerY + 42]
      : [bounds.width - label.offsetWidth, Math.min(bounds.height - label.offsetHeight - 2, bottom + 8)];
    const candidates = [];
    const distanceToPaper = point => Math.min(...papers.flatMap(paper => paper.map(([x,y], i) => {
      const [nextX,nextY] = paper[(i + 1) % paper.length];
      const dx = nextX - x, dy = nextY - y;
      const t = Math.max(0, Math.min(1, ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(point[0] - x - t * dx, point[1] - y - t * dy);
    })));
    const inside = (point, paper) => paper.every(([x,y], i) => {
      const [nextX,nextY] = paper[(i + 1) % paper.length];
      return (nextX - x) * (point[1] - y) - (nextY - y) * (point[0] - x) > .1;
    });
    for (const [dx,dy] of [[28,32], [22,24], [28,16]]) {
      const length = Math.hypot(dx * .32, dy * .24);
      const outward = [dx * .32 / length, dy * .24 / length];
      const clearance = position === 'side' ? 28 : 24;
      papers.forEach(paper => paper.forEach(([x,y], i) => {
        const [nextX,nextY] = paper[(i + 1) % paper.length];
        if ((nextY - y) * outward[0] - (nextX - x) * outward[1] <= 0) return;
        for (let step = 1; step < 20; step++) {
          const point = [x + (nextX - x) * step / 20, y + (nextY - y) * step / 20];
          const upperLimit = position === 'side' ? centerY - stageBounds.height * .3 : centerY;
          if (point[1] < upperLimit || papers.some(other => inside(point, other))) continue;
          const tip = point.map((value, axis) => value + outward[axis] * clearance);
          if (distanceToPaper(tip) < (position === 'side' ? 16 : 12)) continue;
          const tail = [tip[0] + dx, tip[1] + dy];
          const labelX = tail[0] - 24, labelY = tail[1] + 7;
          if (labelX < 0 || labelX + label.offsetWidth > bounds.width || labelY + label.offsetHeight > bounds.height - 2) continue;
          const labelBox = [[labelX,labelY], [labelX + label.offsetWidth,labelY], [labelX + label.offsetWidth,labelY + label.offsetHeight], [labelX,labelY + label.offsetHeight]];
          if (papers.some(other => inside(tip, other) || overlaps(labelBox, other))) continue;
          candidates.push({ tip, tail, labelX, labelY, score: (labelX - desired[0]) ** 2 + (labelY - desired[1]) ** 2 });
        }
      }));
      if (candidates.length) break;
    }
    const cue = candidates.sort((a,b) => a.score - b.score)[0];
    hint.style.visibility = cue ? '' : 'hidden';
    if (!cue) return;
    hint.style.setProperty('--cue-label-x', `${cue.labelX}px`);
    hint.style.setProperty('--cue-label-y', `${cue.labelY}px`);
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    path.setAttribute('d', window.AXDCuePath(cue.tail, cue.tip));
  }

  function render() {
    prints.forEach((print, i) => {
      const slot = (i - index + photos.length) % photos.length;
      print.classList.remove(...slots.map(name => `deck-print--${name}`));
      print.classList.add(`deck-print--${slots[slot]}`);
      print.tabIndex = slot === 0 ? 0 : -1;
      print.setAttribute('aria-hidden', String(slot !== 0));
      print.setAttribute('aria-label', `Next photograph. ${photos[i].alt}`);
      if (slot === 0) { print.id = 'photo-next'; print.setAttribute('aria-describedby', 'deck-hint'); }
      else { print.removeAttribute('id'); print.removeAttribute('aria-describedby'); }
    });
    document.dispatchEvent(new CustomEvent('axd:palette', { detail: { palette: photos[index].palette } }));
  }

  async function advance(direction) {
    if (preparing || performance.now() < busyUntil) return;
    preparing = true;
    const next = (index + direction + photos.length) % photos.length;
    // Every physical print stays in the deck, including the two deepest cards.
    const ready = await Promise.all(prints.map(async print => {
      const image = print.querySelector('img');
      try { await image.decode(); return true; } catch { return false; }
    }));
    preparing = false;
    if (ready.some(value => !value)) return;
    const timing = getComputedStyle(prints[0]);
    const seconds = value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000);
    const delays = timing.transitionDelay.split(',').map(seconds);
    const duration = Math.max(...timing.transitionDuration.split(',').map((value, i) => seconds(value) + delays[i % delays.length]));
    busyUntil = performance.now() + (reduced.matches ? 0 : duration);
    const previous = prints[index];
    const focused = previous === document.activeElement;
    index = next;
    render();
    if (focused) prints[index].focus({ preventScroll: true });
  }

  stage.replaceChildren(...prints);
  layout();
  render();
  hint.hidden = false;
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(stage);
  else window.addEventListener('resize', layout, { passive: true });
  document.fonts.ready.then(positionCue);
})();
