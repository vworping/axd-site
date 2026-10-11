(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches || document.body.classList.contains('motion-paused');
  let frame = 0;
  function paint() {
    frame = 0;
    if (paused || reduced.matches) return;
    const distance = document.documentElement.scrollHeight - innerHeight;
    const progress = distance > 0 ? Math.min(2, Math.max(0, scrollY / distance * 2)) : 0;
    document.body.style.setProperty('--ambient-progress', progress);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('axd:motion', event => {
    paused = event.detail.paused;
    schedule();
  });
  reduced.addEventListener('change', () => { paused = reduced.matches; schedule(); });
  new ResizeObserver(schedule).observe(document.body);
  schedule();
})();
