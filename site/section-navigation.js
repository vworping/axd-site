(() => {
  'use strict';
  const root = document.documentElement;
  const track = document.getElementById('section-track');
  const panels = [...track.children];
  const rail = document.querySelector('.section-navigation');
  const label = document.getElementById('section-current');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let scrollFrame;
  let wheelTotal = 0;
  let wheelHandled = false;
  let wheelTimer;

  function sync() {
    scrollFrame = 0;
    index = Math.max(0, Math.min(panels.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
    panels.forEach((panel, i) => { panel.inert = i !== index; });
    label.textContent = panels[index].dataset.sectionLabel;
    document.querySelectorAll('.site-header nav a').forEach((link) => {
      if (link.hash === `#${panels[index].dataset.section}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const hash = `#${panels[index].dataset.section}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function goTo(target, instant = false, addHistory = false) {
    const position = Math.max(0, Math.min(panels.length - 1, target));
    if (addHistory) history.pushState(null, '', `#${panels[position].dataset.section}`);
    track.scrollTo({ left: position * track.clientWidth, behavior: instant || reduced.matches ? 'instant' : 'smooth' });
    if (instant) sync();
  }

  root.classList.add('horizontal-layout');
  rail.hidden = false;
  const fromHash = () => {
    const hash = location.hash === '#contact' ? '#about' : location.hash;
    return Math.max(0, panels.findIndex((panel) => `#${panel.dataset.section}` === hash));
  };
  goTo(fromHash(), true);
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const position = panels.findIndex((panel) => link.hash === `#${panel.dataset.section}`);
    if (position < 0) return;
    event.preventDefault();
    goTo(position, false, true);
    if (link.classList.contains('skip-link')) {
      panels[position].inert = false;
      panels[position].tabIndex = -1;
      panels[position].focus({ preventScroll: true });
    }
  });
  track.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(sync); }, { passive: true });
  window.addEventListener('hashchange', () => goTo(fromHash()));
  window.addEventListener('resize', () => goTo(index, true), { passive: true });
  document.addEventListener('axd:home', () => goTo(0, true));

  // Horizontal gestures stay native. A vertical wheel pages sideways only
  // when the current panel has no further vertical content in that direction.
  track.addEventListener('wheel', (event) => {
    if (event.ctrlKey || document.querySelector('dialog[open]') || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const panel = panels[index];
    const down = event.deltaY > 0;
    const canScroll = down ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 2 : panel.scrollTop > 2;
    if (canScroll) return;
    event.preventDefault();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelHandled = false; wheelTotal = 0; }, 180);
    if (wheelHandled) return;
    wheelTotal += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
    if (Math.abs(wheelTotal) < 45) return;
    wheelHandled = true;
    goTo(index + (wheelTotal > 0 ? 1 : -1));
  }, { passive: false });
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]') || root.classList.contains('intro-pending')) return;
    if (event.target.closest('button,input,textarea,select,summary,[contenteditable]')) return;
    const direction = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    goTo(index + direction, false, true);
  });
})();
