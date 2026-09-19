(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  document.addEventListener('axd:motion', event => { paused = event.detail.paused; });

  window.AXDDialogs = {
    open(dialog) {
      if (dialog.open) return;
      const play = !reduced.matches && !paused;
      dialog.showModal();
      dialog.focus({ preventScroll: true });
      if (!play || typeof dialog.animate !== 'function') return;
      const snap = dialog.animate([
        { clipPath: 'inset(49.5% 0 49.5% 0)', transform: 'scale(.985)', opacity: .7 },
        { clipPath: 'inset(46% 0 46% 0)', transform: 'scale(.99)', opacity: 1, offset: .18 },
        { clipPath: 'inset(0% 0 0% 0)', transform: 'scale(1)', opacity: 1 }
      ], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
      const cancel = () => snap.cancel();
      dialog.addEventListener('close', cancel, { once: true });
      snap.finished.catch(() => {}).finally(() => dialog.removeEventListener('close', cancel));
    }
  };
})();
