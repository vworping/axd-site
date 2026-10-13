(() => {
  'use strict';
  const embedded = window.parent !== window;
  document.body.classList.toggle('portfolio-embedded', embedded);
  function reportHeight() {
    if (embedded) parent.postMessage({ type: 'pet:height', height: Math.ceil(document.querySelector('.workspace').getBoundingClientRect().height) + 4 }, location.origin);
  }
  new ResizeObserver(reportHeight).observe(document.querySelector('.workspace'));
  window.addEventListener('message', event => {
    if (!embedded || event.source !== parent || event.origin !== location.origin || event.data?.type !== 'pet:motion') return;
    document.dispatchEvent(new CustomEvent('pet:motion', { detail: { paused: Boolean(event.data.paused) } }));
    document.dispatchEvent(new CustomEvent('axd:motion', { detail: { paused: Boolean(event.data.paused) } }));
  });
  reportHeight();
})();
