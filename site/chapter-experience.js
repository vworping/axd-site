(() => {
  'use strict';
  const root = document.documentElement;
  const shell = document.querySelector('.hero-shell');
  const constellation = document.getElementById('constellation');
  const track = document.getElementById('section-track');
  const chapters = [...track.children];
  const exitSpotlight = document.getElementById('c-spotlight-exit');
  const spotlightContext = document.getElementById('c-spotlight-context');
  const spotlightHero = constellation.querySelector('.constellation-hero');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let spotlightDone = false, activeChapter = '', paused = reduced.matches;
  let spotlightPress = null;
  let canvasFrame = 0, canvasTime = 0, canvasProgress = 0, canvasDepth = 0;
  // The chapter starts spotlit in the markup, so even its first sliver is
  // already in focus mode during a horizontal gesture or direct page load.
  function clearSpotlight(keepPosition = false) {
    if (spotlightDone) return;
    spotlightDone = true;
    const previousBottom = spotlightHero.getBoundingClientRect().bottom;
    // When the visitor has already scrolled past the wheel, reveal the context
    // above them without moving the map they are reading.
    constellation.classList.toggle('spotlight-settled', keepPosition || paused || reduced.matches);
    spotlightContext.inert = false;
    constellation.classList.remove('is-spotlit');
    shell.classList.remove('constellation-spotlight');
    if (keepPosition) constellation.scrollTo({ top: constellation.scrollTop + spotlightHero.getBoundingClientRect().bottom - previousBottom, behavior: 'instant' });
    if (document.activeElement === exitSpotlight) {
      document.getElementById('c-palette-orbit').focus({ preventScroll: true });
    }
    exitSpotlight.hidden = true;
  }
  function paintSpotlight() {
    // The rail is authoritative: a chapter's bounds can still be at the origin
    // during startup layout, which used to leave the homepage header blurred.
    const width = track.getBoundingClientRect().width;
    const start = chapters.indexOf(constellation) * width;
    shell.classList.toggle('constellation-spotlight', !spotlightDone && track.scrollLeft + width > start + 1 && track.scrollLeft < start + width - 1);
  }
  function setChapter(id) {
    activeChapter = id;
    paintSpotlight();
    scheduleCanvas();
  }
  function canvasTarget() {
    const position = Math.max(0, Math.min(chapters.length - 1, track.scrollLeft / track.getBoundingClientRect().width));
    const left = Math.floor(position), right = Math.min(left + 1, chapters.length - 1), fraction = position - left;
    const depth = chapter => {
      const available = chapter.scrollHeight - chapter.clientHeight;
      return available > 0 ? Math.max(0, Math.min(1, chapter.scrollTop / available)) : 0;
    };
    // Blend the two visible chapters' vertical positions throughout a swipe.
    // Waiting for the chapter to settle made the background snap at the end.
    return { progress: position / (chapters.length - 1) * 2, depth: depth(chapters[left]) * (1 - fraction) + depth(chapters[right]) * fraction };
  }
  function writeCanvas() {
    root.style.setProperty('--chapter-progress', canvasProgress);
    root.style.setProperty('--chapter-depth', canvasDepth);
  }
  function animateCanvas(now) {
    canvasFrame = 0;
    if (paused || reduced.matches || document.hidden) { canvasTime = 0; return; }
    const target = canvasTarget();
    const blend = 1 - Math.exp(-Math.min(64, canvasTime ? now - canvasTime : 16) / 150);
    canvasTime = now;
    canvasProgress += (target.progress - canvasProgress) * blend;
    canvasDepth += (target.depth - canvasDepth) * blend;
    const unsettled = Math.abs(target.progress - canvasProgress) + Math.abs(target.depth - canvasDepth) > .0001;
    if (!unsettled) { canvasProgress = target.progress; canvasDepth = target.depth; canvasTime = 0; }
    writeCanvas();
    if (unsettled) canvasFrame = requestAnimationFrame(animateCanvas);
  }
  function scheduleCanvas() {
    if (!canvasFrame && !paused && !reduced.matches && !document.hidden) canvasFrame = requestAnimationFrame(animateCanvas);
  }
  function syncCanvasMotion() {
    shell.classList.toggle('canvas-paused', paused || reduced.matches || document.hidden);
    scheduleCanvas();
  }
  document.addEventListener('axd:chapter', event => setChapter(event.detail.id));
  track.addEventListener('scroll', () => { paintSpotlight(); scheduleCanvas(); }, { passive: true });
  exitSpotlight.addEventListener('click', () => clearSpotlight());
  const spotlightControl = target => target.closest('a, button, input, select, summary, #c-palette-orbit, #c-palette-selection');
  constellation.addEventListener('pointerdown', event => {
    spotlightPress = !spotlightDone && event.button === 0 && event.isPrimary !== false && !spotlightControl(event.target)
      ? { x: event.clientX, y: event.clientY, scroll: constellation.scrollTop } : null;
  });
  constellation.addEventListener('pointermove', event => {
    if (spotlightPress && Math.hypot(event.clientX - spotlightPress.x, event.clientY - spotlightPress.y) > 10) spotlightPress = null;
  });
  constellation.addEventListener('pointercancel', () => { spotlightPress = null; });
  constellation.addEventListener('click', event => {
    if (spotlightPress && Math.abs(constellation.scrollTop - spotlightPress.scroll) < 10 && !spotlightControl(event.target)) clearSpotlight();
    spotlightPress = null;
  });
  chapters.forEach(chapter => chapter.addEventListener('scroll', () => {
    if (chapter === constellation && !spotlightDone && constellation.scrollTop > 0 && spotlightHero.getBoundingClientRect().bottom <= constellation.getBoundingClientRect().top + 24) clearSpotlight(true);
    scheduleCanvas();
  }, { passive: true }));
  // Expanding the measurement note changes the scroll range too.
  constellation.addEventListener('toggle', scheduleCanvas, true);
  window.addEventListener('resize', () => { paintSpotlight(); scheduleCanvas(); }, { passive: true });
  document.addEventListener('visibilitychange', syncCanvasMotion);
  // Opening a photograph reveals the context underneath the dialog. Reading
  // past the complete spotlight, following a link, or Escape can also exit.
  new MutationObserver(() => {
    if (document.getElementById('c-focus-dialog').open) clearSpotlight();
  }).observe(document.getElementById('c-focus-dialog'), { attributes: true, attributeFilter: ['open'] });
  constellation.addEventListener('click', event => { if (event.target.closest('a')) clearSpotlight(); });
  constellation.addEventListener('focusin', event => {
    if (event.target.closest('.intro-links, .explorer-section, .project-story')) clearSpotlight();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && activeChapter === 'constellation') clearSpotlight(); });
  document.addEventListener('axd:motion', event => { paused = event.detail.paused; syncCanvasMotion(); });
  reduced.addEventListener('change', syncCanvasMotion);
  const initialCanvas = canvasTarget();
  canvasProgress = initialCanvas.progress;
  canvasDepth = initialCanvas.depth;
  writeCanvas();
  syncCanvasMotion();
  const initial = [...document.querySelectorAll('[data-section]')].find(chapter => chapter.dataset.route === location.pathname);
  setChapter(initial?.dataset.section || 'top');
})();
