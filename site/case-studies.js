// Visual masks only, not a new extraction: preserve every original RGB pixel.
// Nearest palette RGB groups give each travelling swatch a region to illuminate.
function palettePixelGroups(pixels, width, palette) {
  const colors = palette.map(color => [1, 3, 5].map(offset => parseInt(color.hex.slice(offset, offset + 2), 16)));
  const groups = colors.map(() => ({ pixels: new Uint8ClampedArray(pixels.length), x: 0, y: 0, count: 0 }));
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (!pixels[offset + 3]) continue;
    let closest = 0, distance = Infinity;
    colors.forEach((color, index) => {
      const candidate = color.reduce((sum, channel, axis) => sum + (pixels[offset + axis] - channel) ** 2, 0);
      if (candidate < distance) { distance = candidate; closest = index; }
    });
    const group = groups[closest], pixel = offset / 4;
    group.pixels.set(pixels.subarray(offset, offset + 4), offset);
    group.x += pixel % width;
    group.y += Math.floor(pixel / width);
    group.count++;
  }
  return groups;
}

// Called inside each composed chapter; explorer data and its viewer are reused.
function initCaseStudy(photos = [], openPhoto = null) {
  const study = chapter.querySelector('.case-study');
  if (!study) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  const cleanups = new Set();
  const stop = () => {
    animations.forEach(animation => animation.cancel()); animations.clear();
    cleanups.forEach(cleanup => cleanup()); cleanups.clear();
  };
  document.addEventListener('axd:motion', event => { if (event.detail.paused) stop(); });
  reduced.addEventListener('change', () => { if (reduced.matches) stop(); });
  document.addEventListener('axd:chapter', () => { if (chapter.inert) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('resize', stop, { passive: true });
  const canAnimate = () => !reduced.matches && !chapter.inert && !chapter.classList.contains('motion-paused') && !document.body.classList.contains('motion-paused');
  const printEase = 'cubic-bezier(.22,1,.36,1)';
  function animate(image, frames, duration, options = {}) {
    if (!canAnimate()) return;
    const animation = image.animate(frames, { duration, easing: 'ease-out', ...options });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
    return animation;
  }
  const preload = async image => { const incoming = new Image(); incoming.src = image.src; await incoming.decode(); };
  function morphPrint(before, after, update) {
    stop();
    const width = before.offsetWidth;
    const oldWindow = before.querySelector('.study-photo-window, .palette-image-stage');
    const windowHeight = oldWindow.offsetHeight;
    const oldImage = before.querySelector('img');
    const outgoing = oldImage.cloneNode();
    outgoing.className = 'study-photo-outgoing';
    outgoing.removeAttribute('data-guess-image');
    outgoing.alt = '';
    outgoing.setAttribute('aria-hidden', 'true');
    outgoing.style.filter = getComputedStyle(oldImage).filter;
    update();
    if (!canAnimate()) return;
    const nextWindow = after.querySelector('.study-photo-window, .palette-image-stage');
    const nextImage = after.querySelector('img');
    // Keep the old photograph present while the paper resizes, as in the map.
    // The window owns its aspect ratio; image height never sizes the paper.
    const targetWidth = after.offsetWidth, targetHeight = nextWindow.offsetHeight;
    nextWindow.append(outgoing);
    const cleanup = () => { outgoing.remove(); cleanups.delete(cleanup); };
    cleanups.add(cleanup);
    animate(after, [{ width: `${width}px` }, { width: `${targetWidth}px` }], 700, { easing: printEase });
    animate(nextWindow, [{ height: `${windowHeight}px` }, { height: `${targetHeight}px` }], 700, { easing: printEase });
    animate(nextImage, [{ opacity: 0 }, { opacity: 1 }], 650, { easing: 'ease-in-out' });
    const dissolve = animate(outgoing, [{ opacity: 1 }, { opacity: 0 }], 700, { easing: 'ease-in-out' });
    dissolve.onfinish = () => { animations.delete(dissolve); cleanup(); };
  }
  study.querySelectorAll('[data-nfc-card]').forEach(card => {
    const turn = card.querySelector('.pet-card-turn');
    const tag = card.querySelector('[data-nfc-tag]');
    const front = card.querySelector('.pet-card-front');
    const back = card.querySelector('.pet-card-back');
    const place = card.querySelector('[data-nfc-place]');
    const flip = card.querySelector('[data-nfc-flip]');
    const status = card.querySelector('[data-nfc-status]');
    let placed = false, visible = false, observer;
    function showSide(side) {
      const previous = card.dataset.side;
      card.dataset.side = side;
      front.setAttribute('aria-hidden', String(side !== 'front'));
      back.setAttribute('aria-hidden', String(side !== 'back'));
      flip.textContent = side === 'front' ? 'See the back ↻' : 'See the front ↻';
      if (previous !== side) animate(turn, [
        { transform: `rotateY(${previous === 'back' ? 180 : 0}deg)` },
        { transform: `rotateY(${side === 'back' ? 180 : 0}deg)` },
      ], 750, { easing: printEase });
      return previous !== side;
    }
    flip.addEventListener('click', () => {
      stop();
      showSide(card.dataset.side === 'front' ? 'back' : 'front');
      status.textContent = `Showing the ${card.dataset.side} of the card.`;
    });
    function placeTag() {
      placed = true;
      observer?.disconnect();
      stop();
      const flipped = showSide('front');
      card.dataset.tag = 'placed';
      tag.setAttribute('aria-hidden', 'false');
      place.textContent = 'Replay placement ↘';
      status.textContent = 'NFC tag placed at the top-right of the white front.';
      animate(tag, [
        { transform: 'translate(70%, -95%) rotate(24deg) scale(1.2)', opacity: 0, offset: 0 },
        { transform: 'translate(32%, -48%) rotate(12deg) scale(1.12)', opacity: 1, offset: .38 },
        { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1, offset: 1 },
      ], 1150, { delay: flipped ? 600 : 0, fill: 'backwards', easing: 'cubic-bezier(.25,.1,.25,1)' });
    }
    place.addEventListener('click', placeTag);
    const revealOnArrival = () => {
      if (!placed && visible && !chapter.inert && !document.hidden) placeTag();
    };
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .35);
        revealOnArrival();
      }, { root: chapter, threshold: .35 });
      observer.observe(card.querySelector('.pet-card-stage'));
      document.addEventListener('axd:chapter', revealOnArrival);
      document.addEventListener('visibilitychange', revealOnArrival);
    }
  });
  study.querySelectorAll('[data-pet-photos]').forEach(gallery => {
    const prints = [...gallery.querySelectorAll('[data-pet-photo]')];
    const status = gallery.querySelector('[data-prototype-status]');
    let current = 0, requested = 0, request = 0;
    async function move(step, trigger) {
      requested = (requested + step + prints.length) % prints.length;
      const index = requested, token = ++request, before = prints[current], after = prints[index];
      try { await preload(after.querySelector('img')); }
      catch {
        if (token !== request) return;
        requested = current;
        status.textContent = 'This photograph could not load. Please try again.';
        return;
      }
      if (token !== request) return;
      const keepFocus = document.activeElement === trigger;
      morphPrint(before, after, () => {
        current = index;
        prints.forEach(print => { print.hidden = print !== after; });
      });
      if (keepFocus) after.querySelector(`[data-prototype-step="${step}"]`).focus({ preventScroll: true });
      status.textContent = after.querySelector('figcaption span').textContent;
    }
    gallery.querySelectorAll('[data-prototype-step]').forEach(button => {
      button.addEventListener('click', () => move(Number(button.dataset.prototypeStep), button));
    });
  });
  function transferColors(game, image, photo, swatches) {
    if (!canAnimate()) return;
    const stage = image.parentElement;
    const sample = document.createElement('canvas');
    const ratio = image.naturalWidth / image.naturalHeight;
    sample.width = Math.round(Math.min(640, 640 * ratio));
    sample.height = Math.round(sample.width / ratio);
    const context = sample.getContext('2d', { willReadFrequently: true });
    let groups;
    try {
      context.drawImage(image, 0, 0, sample.width, sample.height);
      groups = palettePixelGroups(context.getImageData(0, 0, sample.width, sample.height).data, sample.width, photo.palette);
    } catch {
      animate(image, [{ filter: 'grayscale(1)' }, { filter: 'grayscale(0)' }], 1100);
      return;
    }
    const effects = [], bounds = game.getBoundingClientRect(), picture = image.getBoundingClientRect();
    const cleanup = () => { effects.forEach(element => element.remove()); image.style.filter = ''; cleanups.delete(cleanup); };
    cleanups.add(cleanup);
    image.style.filter = 'grayscale(1)';
    groups.forEach((group, index) => {
      const layer = document.createElement('canvas');
      layer.width = sample.width; layer.height = sample.height;
      layer.setAttribute('aria-hidden', 'true');
      const layerContext = layer.getContext('2d');
      const pixels = layerContext.createImageData(sample.width, sample.height);
      pixels.data.set(group.pixels);
      layerContext.putImageData(pixels, 0, 0);
      stage.append(layer); effects.push(layer);
      const source = swatches[index].getBoundingClientRect();
      const x = source.left + source.width / 2 - bounds.left;
      const y = source.top + source.height / 2 - bounds.top;
      const tx = picture.left - bounds.left + picture.width * (group.count ? group.x / group.count / sample.width : .5);
      const ty = picture.top - bounds.top + picture.height * (group.count ? group.y / group.count / sample.height : .5);
      const flight = document.createElement('span');
      flight.className = 'palette-flight';
      flight.setAttribute('aria-hidden', 'true');
      const size = Math.min(42, Math.max(18, source.width));
      flight.style.width = `${size}px`; flight.style.height = '18px';
      flight.style.setProperty('--flight-color', photo.palette[index].hex);
      game.append(flight); effects.push(flight);
      // A continuous arc and overlapping dissolves keep colors flowing, not popping.
      const frames = Array.from({ length: 9 }, (_, step) => {
        const t = step / 8, controlY = Math.min(y, ty) - 36;
        const cx = x + (tx - x) * t;
        const cy = (1 - t) ** 2 * y + 2 * (1 - t) * t * controlY + t * t * ty;
        return { transform: `translate(${cx - size / 2}px, ${cy - 9}px) scale(${1 - t * .35})`, opacity: Math.sin(Math.PI * t) * .85, filter: `blur(${t * 5}px)` };
      });
      animate(flight, frames, 1000, { delay: index * 260, easing: 'ease-in-out' });
      animate(swatches[index], [{ filter: 'brightness(1)' }, { filter: 'brightness(1.2)' }, { filter: 'brightness(1)' }], 1000, { delay: index * 260, easing: 'ease-in-out' });
      animate(layer, [{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0px)' }], 1300, { delay: index * 260 + 400, fill: 'backwards', easing: 'ease-in-out' });
    });
    // End with the full-resolution original. Pause/navigation also settles here.
    const finish = animate(image, [{ filter: 'grayscale(1)' }, { filter: 'grayscale(0)' }], 500, { delay: (groups.length - 1) * 260 + 1200, fill: 'forwards', easing: 'ease-in-out' });
    finish.onfinish = () => { animations.delete(finish); finish.cancel(); cleanup(); };
  }
  study.querySelectorAll('[data-study-switch]').forEach(group => {
    let request = 0;
    group.addEventListener('change', async event => {
      if (!event.target.matches('input[type="radio"]')) return;
      const view = event.target.value, panels = [...group.querySelectorAll('[data-study-panel]')];
      const apply = () => { group.dataset.view = view; panels.forEach(panel => { panel.hidden = panel.dataset.studyPanel !== view; }); };
      const device = group.querySelector('.pet-orientation-device');
      if (device) {
        if (group.dataset.view === view) return;
        stop();
        const stage = group.querySelector('.pet-orientation-stage');
        const previous = panels.find(panel => !panel.hidden);
        const outgoingContent = previous.cloneNode(true);
        outgoingContent.removeAttribute('data-study-panel');
        outgoingContent.setAttribute('aria-hidden', 'true');
        const width = device.clientWidth, height = device.clientHeight, stageHeight = stage.offsetHeight;
        apply();
        group.querySelector('[data-orientation-caption]').textContent = view === 'portrait'
          ? 'Portrait concept / the same content stacks.' : 'Current OS / projects and greeting share the screen.';
        if (!canAnimate()) return;
        const angle = view === 'portrait' ? -90 : 90;
        const outgoing = document.createElement('div');
        outgoing.className = 'pet-orientation-outgoing';
        outgoing.setAttribute('aria-hidden', 'true');
        outgoing.style.width = `${width}px`; outgoing.style.height = `${height}px`;
        outgoing.style.transform = `translate(-50%, -50%) rotate(${-angle}deg)`;
        outgoing.append(outgoingContent); device.append(outgoing);
        const cleanup = () => { outgoing.remove(); cleanups.delete(cleanup); };
        cleanups.add(cleanup);
        // Blank the display, turn the physical frame, then light the new layout.
        animate(outgoing, [{ opacity: 1 }, { opacity: 0 }], 160, { fill: 'forwards' });
        animate(stage, [{ height: `${stageHeight}px` }, { height: `${stage.offsetHeight}px` }], 900, { easing: printEase });
        animate(device, [
          { transform: `rotate(${angle}deg)`, offset: 0 },
          { transform: `rotate(${angle}deg)`, offset: .16 },
          { transform: 'rotate(0deg)', offset: .86 },
          { transform: 'rotate(0deg)', offset: 1 },
        ], 1000, { easing: 'ease-in-out' });
        const incoming = animate(panels.find(panel => !panel.hidden), [{ opacity: 0 }, { opacity: 1 }], 360, { delay: 800, fill: 'backwards', easing: 'ease-in-out' });
        incoming.onfinish = () => { animations.delete(incoming); cleanup(); };
        return;
      }
      if (!group.querySelector('.extraction-match')) { apply(); return; }
      const token = ++request, before = panels.find(panel => !panel.hidden), after = panels.find(panel => panel.dataset.studyPanel === view);
      const status = group.querySelector('[data-extraction-status]');
      try { await preload(after.querySelector('img')); }
      catch {
        if (token !== request) return;
        group.querySelector(`input[value="${group.dataset.view}"]`).checked = true;
        status.textContent = 'This comparison photograph could not load. Try again.';
        return;
      }
      if (token !== request) return;
      morphPrint(before, after, apply);
      status.textContent = after.querySelector('figcaption').textContent;
    });
  });
  const photoKey = photo => `${photo.year}/${photo.id}`;
  const findPhoto = key => photos.find(photo => photoKey(photo) === key);
  const paletteDescription = photo => photo.palette.map(color => `${color.hex}: ${(color.weight * 100).toFixed(1)}%`).join(', ');
  function paletteBar(photo) {
    const bar = document.createElement('span');
    bar.className = 'guess-palette-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.replaceChildren(...photo.palette.map(color => {
      const swatch = document.createElement('span');
      swatch.style.flex = color.weight;
      swatch.style.background = color.hex;
      return swatch;
    }));
    return bar;
  }
  study.querySelectorAll('[data-palette-game]').forEach(game => {
    const rounds = game.dataset.rounds.split(',').map(findPhoto).filter(Boolean);
    if (rounds.length < 3) return;
    const image = game.querySelector('[data-guess-image]');
    const print = game.querySelector('.palette-game-print');
    const caption = game.querySelector('[data-guess-caption]');
    const options = game.querySelector('[data-guess-options]');
    const feedback = game.querySelector('[data-guess-feedback]');
    const revealButton = game.querySelector('[data-guess-reveal]');
    const nextButton = game.querySelector('[data-guess-next]');
    const exploreButton = game.querySelector('[data-guess-explore]');
    let current = 0, requested = 0, request = 0, loading = false, revealed = false, choices = [];
    const setAvailable = () => {
      choices.forEach(({ button }) => button.setAttribute('aria-disabled', String(loading || revealed)));
      revealButton.setAttribute('aria-disabled', String(loading));
    };
    function reveal(matched) {
      if (loading || revealed) return;
      revealed = true;
      game.dataset.state = 'revealed';
      image.alt = `Original color photograph ${rounds[current].id}, ${rounds[current].year}.`;
      feedback.textContent = matched ? 'That’s the one.' : '';
      choices.forEach(({ button, photo, label }, index) => {
        const correct = photo === rounds[current];
        button.dataset.result = correct ? 'correct' : 'other';
        label.textContent = correct ? 'The match ✓' : '';
        button.setAttribute('aria-label', `Palette ${String.fromCharCode(65 + index)}${correct ? ', the matching palette' : ', from another photograph'}. ${paletteDescription(photo)}`);
      });
      revealButton.textContent = 'Replay colors';
      exploreButton.hidden = false;
      setAvailable();
      stop();
      const correct = choices.find(choice => choice.photo === rounds[current]);
      transferColors(game, image, rounds[current], correct.button.querySelector('.guess-palette-bar').children);
    }
    function renderRound() {
      const photo = rounds[current];
      revealed = false;
      game.dataset.state = 'guessing';
      image.src = photo.src;
      image.width = photo.width;
      image.height = photo.height;
      image.alt = `Monochrome view of photograph ${photo.id}, ${photo.year}.`;
      print.style.setProperty('--photo-ratio', photo.width / photo.height);
      caption.textContent = `${photo.id} / ${photo.year}`;
      feedback.textContent = '';
      revealButton.textContent = 'Reveal the colors';
      exploreButton.hidden = true;
      // Rotate the answer position. Every option is an unmodified collection palette.
      const candidates = [photo, rounds[(current + 1) % rounds.length], rounds[(current + 2) % rounds.length]];
      const offset = (current + 1) % candidates.length;
      const ordered = candidates.map((_, index) => candidates[(index - offset + candidates.length) % candidates.length]);
      choices = ordered.map((candidate, index) => {
        const button = document.createElement('button'), label = document.createElement('span');
        button.type = 'button';
        button.className = 'guess-option';
        label.className = 'guess-option-label';
        label.textContent = '';
        button.setAttribute('aria-label', `Choose palette ${String.fromCharCode(65 + index)}. ${paletteDescription(candidate)}`);
        button.replaceChildren(label, paletteBar(candidate));
        button.addEventListener('click', () => {
          if (loading || revealed) return;
          if (candidate === rounds[current]) reveal(true);
          else {
            button.dataset.result = 'retry';
            label.textContent = 'Try another';
            feedback.textContent = 'A different photograph. Try another palette.';
          }
        });
        return { button, photo: candidate, label };
      });
      options.replaceChildren(...choices.map(choice => choice.button));
      setAvailable();
    }
    async function next() {
      requested = (requested + 1) % rounds.length;
      const index = requested, token = ++request;
      loading = true;
      game.setAttribute('aria-busy', 'true');
      feedback.textContent = 'Loading another photograph…';
      setAvailable();
      const incoming = new Image();
      incoming.src = rounds[index].src;
      try { await incoming.decode(); }
      catch {
        if (token !== request) return;
        requested = current;
        loading = false;
        game.setAttribute('aria-busy', 'false');
        setAvailable();
        feedback.textContent = 'That photograph could not load. Try “Another photograph” again.';
        return;
      }
      if (token !== request) return;
      current = index;
      loading = false;
      game.setAttribute('aria-busy', 'false');
      morphPrint(print, print, renderRound);
    }
    renderRound();
    revealButton.addEventListener('click', () => {
      if (loading) return;
      if (!revealed) { reveal(false); return; }
      stop();
      const correct = choices.find(choice => choice.photo === rounds[current]);
      transferColors(game, image, rounds[current], correct.button.querySelector('.guess-palette-bar').children);
    });
    nextButton.addEventListener('click', next);
    exploreButton.addEventListener('click', () => { if (revealed) openPhoto?.(rounds[current].image); });
  });
  study.querySelectorAll('[data-analysis-examples]').forEach(analysis => {
    const choices = [...analysis.querySelectorAll('[data-analysis-choice]')];
    const panels = [...analysis.querySelectorAll('[data-analysis-panel]')];
    const status = analysis.querySelector('[data-analysis-status]');
    let request = 0;
    async function select(panel, photo, trigger = null) {
      const token = ++request;
      const currentPanel = panels.find(item => !item.hidden);
      const currentPhoto = currentPanel.querySelector('[data-analysis-photo]:not([hidden])');
      if (photo === currentPhoto) return;
      const before = currentPhoto.querySelector('figure'), after = photo.querySelector('figure');
      try { await preload(after.querySelector('img')); }
      catch {
        if (token === request) status.textContent = 'This example could not load. Try another photograph.';
        return;
      }
      if (token !== request) return;
      const returnFocus = trigger && document.activeElement === trigger;
      morphPrint(before, after, () => {
        panels.forEach(item => { item.hidden = item !== panel; });
        choices.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.analysisChoice === panel.dataset.analysisPanel)));
        panel.querySelectorAll('[data-analysis-photo]').forEach(item => { item.hidden = item !== photo; });
      });
      if (returnFocus) photo.querySelector(`[data-analysis-step="${trigger.dataset.analysisStep}"]`).focus({ preventScroll: true });
      status.textContent = `${photo.querySelector('[data-analysis-caption]').textContent}. ${photo.querySelector('.analysis-example-note').textContent}`;
    }
    choices.forEach(button => button.addEventListener('click', () => {
      const panel = panels.find(item => item.dataset.analysisPanel === button.dataset.analysisChoice);
      select(panel, panel.querySelector('[data-analysis-photo]:not([hidden])'));
    }));
    panels.forEach(panel => panel.querySelectorAll('[data-analysis-step]').forEach(button => {
      button.addEventListener('click', () => {
        const examples = [...panel.querySelectorAll('[data-analysis-photo]')];
        const current = examples.findIndex(photo => !photo.hidden);
        const next = (current + Number(button.dataset.analysisStep) + examples.length) % examples.length;
        select(panel, examples[next], button);
      });
    }));
    analysis.querySelectorAll('[data-analysis-open]').forEach(button => {
      button.addEventListener('click', () => {
        const photo = findPhoto(button.dataset.analysisOpen);
        if (photo) openPhoto?.(photo.image);
      });
    });
  });
}
