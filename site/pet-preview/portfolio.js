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
  new MutationObserver(() => {
    const photo = document.querySelector('.detail-photo');
    if (!photo || document.querySelector('.detail-save')) return;
    photo.id = 'preview-detail-photo';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'detail-save';
    save.dataset.saveImage = photo.id;
    save.textContent = 'Save / copy photo';
    photo.closest('.detail-sheet').append(save);
  }).observe(document.querySelector('.os'), { childList: true, subtree: true });
  reportHeight();
})();
