(() => {
  'use strict';
  const root = document.documentElement;
  const track = document.getElementById('section-track');
  const panels = [...track.children];
  const rail = document.querySelector('.section-navigation');
  const label = document.getElementById('section-current');
  const previous = document.getElementById('section-prev');
  const next = document.getElementById('section-next');
  const previousLabel = document.getElementById('section-prev-label');
  const nextLabel = document.getElementById('section-next-label');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let index = 0;
  let scrollFrame;
  let wheelTotal = 0;
  let wheelHandled = false;
  let wheelTimer;
  let navigationReady = false;
  const buttonAnimations = new Map();

  function setAvailable(button, available) {
    if (navigationReady && button.disabled === !available) return;
    const focused = document.activeElement === button;
    buttonAnimations.get(button)?.cancel();
    button.disabled = !available;
    button.setAttribute('aria-hidden', String(!available));
    if (focused && !available) {
      (button === previous ? next : previous).focus({ preventScroll: true });
    }
    if (!navigationReady || paused || reduced.matches) return;
    const open = { clipPath: 'inset(-6px)', transform: 'scale(1)', opacity: 1, visibility: 'visible' };
    const slit = { clipPath: 'inset(47% 0)', transform: 'scale(.985)', opacity: 1, visibility: 'visible' };
    const closed = { clipPath: 'inset(50% 0)', transform: 'scale(.985)', opacity: 0, visibility: 'visible' };
    button.classList.add('is-snapping');
    const frames = available
      ? [closed, { ...slit, offset: .12 }, { ...open, offset: .28 }, { ...slit, offset: .4 }, { ...open, offset: .5 }, open]
      : [open, { ...slit, offset: .45 }, { ...open, offset: .6 }, { ...slit, offset: .75 }, closed];
    const animation = button.animate(frames.map(frame => ({ ...frame, easing: 'steps(1, end)' })), {
      duration: 340, easing: 'linear'
    });
    buttonAnimations.set(button, animation);
    animation.finished.catch(() => {}).finally(() => {
      if (buttonAnimations.get(button) === animation) {
        buttonAnimations.delete(button);
        button.classList.remove('is-snapping');
      }
    });
  }

  function sync() {
    scrollFrame = 0;
    index = Math.max(0, Math.min(panels.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
    panels.forEach((panel, i) => { panel.inert = i !== index; });
    // Let the page arrive before its navigation controls snap into place.
    if (Math.abs(track.scrollLeft - index * track.clientWidth) < 2) {
      label.textContent = panels[index].dataset.sectionLabel;
      setAvailable(previous, index > 0);
      setAvailable(next, index < panels.length - 1);
      // Keep the outgoing label's width stable throughout its closing shutter.
      if (index > 0) previousLabel.textContent = ['Back', 'Back to photographs', 'Back to work'][index];
      if (index < panels.length - 1) nextLabel.textContent = ['Explore the work', 'About & Say Hello'][index];
      previous.setAttribute('aria-label', index === 0 ? 'Previous section' : `Previous section: ${panels[index - 1].dataset.sectionLabel}`);
      next.setAttribute('aria-label', next.disabled ? 'Next section' : `Next section: ${panels[index + 1].dataset.sectionLabel}`);
    }
    // Move the shared background with the rail, including native touch gestures.
    const progress = Math.max(0, Math.min(2, track.scrollLeft / track.clientWidth));
    root.style.setProperty('--chapter-progress', paused || reduced.matches ? 0 : progress);
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
  previous.addEventListener('click', () => goTo(index - 1, false, true));
  next.addEventListener('click', () => goTo(index + 1, false, true));
  const syncMotion = () => {
    if (paused || reduced.matches) buttonAnimations.forEach(animation => animation.cancel());
    sync();
  };
  document.addEventListener('axd:motion', event => { paused = event.detail.paused; syncMotion(); });
  reduced.addEventListener('change', syncMotion);
  const fromHash = () => {
    const hash = location.hash === '#contact' ? '#about' : location.hash;
    return Math.max(0, panels.findIndex((panel) => `#${panel.dataset.section}` === hash));
  };
  const initialPosition = fromHash();
  goTo(initialPosition, true);
  navigationReady = true;
  // Settle the requested chapter after initial fragment scrolling and scroll snap.
  // This also lets standalone project pages return directly to the Work chapter.
  window.addEventListener('load', () => requestAnimationFrame(() => goTo(initialPosition, true)), { once: true });
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const position = panels.findIndex((panel) => link.hash === `#${panel.dataset.section}`);
    if (position < 0) return;
    event.preventDefault();
    const isSkipLink = link.classList.contains('skip-link');
    // Finish a keyboard skip before transferring focus into the destination.
    goTo(position, isSkipLink, true);
    if (isSkipLink) {
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
