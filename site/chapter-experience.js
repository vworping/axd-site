(() => {
  'use strict';
  const root = document.documentElement;
  const shell = document.querySelector('.hero-shell');
  const constellation = document.getElementById('constellation');
  const track = document.getElementById('section-track');
  const chapters = [...track.children];
  const exitSpotlight = document.getElementById('c-spotlight-exit');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let spotlightDone = false, activeChapter = '', paused = reduced.matches;
  let canvasFrame = 0, canvasTime = 0, canvasProgress = 0, canvasDepth = 0;
  // The chapter starts spotlit in the markup, so even its first sliver is
  // already in focus mode during a horizontal gesture or direct page load.
  function clearSpotlight() {
    if (spotlightDone) return;
    spotlightDone = true;
    constellation.classList.remove('is-spotlit');
    shell.classList.remove('constellation-spotlight');
    if (document.activeElement === exitSpotlight) {
      document.getElementById('c-palette-orbit').focus({ preventScroll: true });
    }
    exitSpotlight.hidden = true;
  }
  function paintSpotlight() {
    const bounds = constellation.getBoundingClientRect();
    const viewport = track.getBoundingClientRect();
    shell.classList.toggle('constellation-spotlight', !spotlightDone && bounds.left < viewport.right - 1 && bounds.right > viewport.left + 1);
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
  exitSpotlight.addEventListener('click', clearSpotlight);
  chapters.forEach(chapter => chapter.addEventListener('scroll', () => {
    if (chapter === constellation && constellation.scrollTop > 40) clearSpotlight();
    scheduleCanvas();
  }, { passive: true }));
  // Expanding the measurement note changes the scroll range too.
  constellation.addEventListener('toggle', scheduleCanvas, true);
  window.addEventListener('resize', scheduleCanvas, { passive: true });
  document.addEventListener('visibilitychange', syncCanvasMotion);
  // Opening the first photograph clears the invitation. Scrolling, following
  // a link, or using the keyboard can dismiss it without opening anything.
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
