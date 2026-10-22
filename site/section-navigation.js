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
  const routeOf = panel => panel.dataset.route;
  const fromURL = () => {
    const hash = location.hash === '#contact' ? '#about' : location.hash;
    const alias = location.pathname.replace(/\/$/, '').replace(/^\/pet(?:\.html)?$/i, '/PET').replace('/constellation/index.html', '/constellation') || '/';
    return Math.max(0, panels.findIndex(panel => hash ? '#' + panel.dataset.section === hash : routeOf(panel) === alias));
  };
  const initialPosition = fromURL();
  let lastChapter;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let index = 0;
  let scrollFrame;
  let navigationReady = false;
  let railWidth = 0;
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
    const settledState = available ? 'visible' : 'hidden';
    if (!navigationReady || paused || reduced.matches) {
      button.dataset.snapshot = settledState;
      return;
    }
    // Disabled controls stop accepting input immediately, but remain painted
    // until their closing shutter completes. A reversal cancels the old finish.
    button.dataset.snapshot = available ? 'opening' : 'closing';
    const animation = window.AXDSnapshot(button, available, {
      duration: available ? 460 : 360,
      easing: 'cubic-bezier(.65,0,.35,1)',
      fill: 'both'
    });
    buttonAnimations.set(button, animation);
    animation.finished.catch(() => {}).finally(() => {
      if (buttonAnimations.get(button) === animation) {
        button.dataset.snapshot = settledState;
        buttonAnimations.delete(button);
        animation.cancel();
      }
    });
  }

  function sync() {
    scrollFrame = 0;
    const width = track.getBoundingClientRect().width;
    // A resize can emit scroll before resize. Preserve the chapter rather
    // than interpreting the old pixel offset against the new page width.
    if (railWidth && Math.abs(width - railWidth) > .5) {
      railWidth = width;
      track.scrollTo({ left: index * width, behavior: 'instant' });
    }
    railWidth = width;
    index = Math.max(0, Math.min(panels.length - 1, Math.round(track.scrollLeft / width)));
    panels.forEach((panel, i) => { panel.inert = i !== index; });
    // Let the page arrive before its navigation controls snap into place.
    if (Math.abs(track.scrollLeft - index * track.getBoundingClientRect().width) < 2) {
      label.textContent = panels[index].dataset.sectionLabel;
      setAvailable(previous, index > 0);
      setAvailable(next, index < panels.length - 1);
      // Keep the outgoing label's width stable throughout its closing shutter.
      if (index > 0) previousLabel.textContent = `Back to ${panels[index - 1].dataset.sectionLabel}`;
      if (index < panels.length - 1) nextLabel.textContent = panels[index + 1].dataset.sectionLabel;
      previous.setAttribute('aria-label', index === 0 ? 'Previous section' : `Previous section: ${panels[index - 1].dataset.sectionLabel}`);
      next.setAttribute('aria-label', next.disabled ? 'Next section' : `Next section: ${panels[index + 1].dataset.sectionLabel}`);
    }
    // The shared canvas follows the rail continuously in chapter-experience.js.
    document.querySelectorAll('.site-header nav a').forEach((link) => {
      if (link.pathname === routeOf(panels[index])) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const panel = panels[index];
    if (Math.abs(track.scrollLeft - index * track.getBoundingClientRect().width) < 2) {
      if (location.pathname !== routeOf(panel) || location.hash) history.replaceState(null, '', routeOf(panel) + location.search);
      document.title = panel.dataset.title;
      document.querySelector('link[rel="canonical"]').href = location.origin + routeOf(panel);
      if (lastChapter !== panel) {
        lastChapter = panel;
        document.dispatchEvent(new CustomEvent('axd:chapter', { detail: { id: panel.dataset.section } }));
      }
    }
  }

  function goTo(target, instant = false, addHistory = false) {
    const position = Math.max(0, Math.min(panels.length - 1, target));
    if (addHistory) history.pushState(null, '', routeOf(panels[position]));
    track.scrollTo({ left: position * track.getBoundingClientRect().width, behavior: instant || reduced.matches ? 'instant' : 'smooth' });
    if (instant) sync();
  }

  root.classList.add('horizontal-layout');
  rail.hidden = false;
  previous.addEventListener('click', () => goTo(index - 1, false, true));
  next.addEventListener('click', () => goTo(index + 1, false, true));
  const syncMotion = () => {
    if (paused || reduced.matches) buttonAnimations.forEach(animation => animation.finish());
    sync();
  };
  document.addEventListener('axd:motion', event => { paused = event.detail.paused; syncMotion(); });
  reduced.addEventListener('change', syncMotion);
  goTo(initialPosition, true);
  navigationReady = true;
  // Settle the requested chapter after initial fragment scrolling and scroll snap.
  // This also lets standalone project pages return directly to the Work chapter.
  window.addEventListener('load', () => requestAnimationFrame(() => goTo(initialPosition, true)), { once: true });
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (link.origin !== location.origin || link.target || link.hasAttribute('download')) return;
    const position = panels.findIndex(panel => link.hash ? link.hash === `#${panel.dataset.section}` : link.pathname === routeOf(panel));
    if (position < 0) {
      const panel = link.closest('.project-chapter');
      const target = link.hash && document.getElementById(link.hash.slice(1));
      if (panel && target && panel.contains(target)) {
        event.preventDefault();
        panel.scrollTo({ top: target.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 24, behavior: reduced.matches ? 'instant' : 'smooth' });
      }
      return;
    }
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
  window.addEventListener('hashchange', () => goTo(fromURL()));
  window.addEventListener('popstate', () => goTo(fromURL(), true));
  window.addEventListener('resize', () => goTo(index, true), { passive: true });
  document.addEventListener('axd:home', () => goTo(0, true));

  // Keep both scroll axes native: vertical movement stays inside a chapter,
  // including at its boundaries. Only horizontal movement crosses chapters.
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]') || root.classList.contains('intro-pending')) return;
    if (event.target.closest('button,input,textarea,select,summary,[contenteditable],[role=group]')) return;
    const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    goTo(index + direction, false, true);
  });
})();
