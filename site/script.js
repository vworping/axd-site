(() => {
  'use strict';

  document.addEventListener('pointerdown', () => {
    document.documentElement.dataset.input = 'pointer';
  }, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') document.documentElement.dataset.input = 'keyboard';
  }, true);

  const $ = (id) => document.getElementById(id);
  const projects = window.PROJECTS || [];
  const wrap = (index, length) => ((index % length) + length) % length;
  const pad = (number) => String(number).padStart(2, '0');

  $('year').textContent = new Date().getFullYear();

  const background = $('background-dialog');
  const timeline = $('background-timeline');
  const backgroundScrollCue = $('background-scroll-cue');
  const backgroundScrollFooter = backgroundScrollCue.parentElement;
  function syncBackgroundScroll() {
    if (!background.open) return;
    // Test against the viewport without the cue's reserved space. This stays
    // independent of scroll position and cannot create its own overflow.
    const available = timeline.clientHeight + backgroundScrollFooter.offsetHeight;
    backgroundScrollFooter.hidden = timeline.scrollHeight <= available + 2;
    const remaining = timeline.scrollHeight - timeline.clientHeight - timeline.scrollTop;
    const hasMore = !backgroundScrollFooter.hidden && remaining > 2;
    if (!hasMore && document.activeElement === backgroundScrollCue) timeline.focus({ preventScroll: true });
    backgroundScrollCue.hidden = !hasMore;
  }
  $('background-open').addEventListener('click', () => {
    window.AXDDialogs.open(background);
    timeline.scrollTop = 0;
    syncBackgroundScroll();
  });
  backgroundScrollCue.addEventListener('click', () => timeline.scrollBy({
    top: timeline.clientHeight * .7,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  }));
  timeline.addEventListener('scroll', syncBackgroundScroll, { passive: true });
  const backgroundResize = new ResizeObserver(syncBackgroundScroll);
  backgroundResize.observe(timeline);
  backgroundResize.observe(background);
  // Font loading can change the rows without changing the scroll viewport.
  if (document.fonts) document.fonts.ready.then(syncBackgroundScroll);
  $('background-dismiss').addEventListener('click', () => background.close());
  background.addEventListener('close', () => $('background-open').focus({ preventScroll: true }));
  background.addEventListener('click', (event) => {
    if (event.target !== background) return;
    const rect = background.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) background.close();
  });

  const dialog = $('project-dialog');
  const imageDialog = $('image-dialog');
  let activeProject;
  let imageIndex = 0;
  let returnFocus;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused = false;
  let photoRequest = 0;
  let photoReveal;

  document.addEventListener('axd:motion', event => {
    motionPaused = event.detail.paused;
    dialog.classList.toggle('motion-paused', motionPaused);
    if (motionPaused) photoReveal?.cancel();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) photoReveal?.cancel();
  });

  function sizeGallery() {
    if (!activeProject || !dialog.open) return;
    const gallery = dialog.querySelector('.dialog-gallery');
    const frame = $('gallery-expand');
    const stage = frame.querySelector('.gallery-image-stage');
    const inset = parseFloat(getComputedStyle(stage).getPropertyValue('--photo-inset')) + 1;
    const strip = parseFloat(getComputedStyle(frame, '::before').height);
    const shortLandscape = matchMedia('(orientation: landscape) and (max-height: 600px) and (max-width: 1100px)').matches;
    const availableHeight = innerWidth <= 700 && !shortLandscape
      ? Math.min(innerHeight * .53, 520)
      : gallery.clientHeight - gallery.querySelector('.gallery-controls').offsetHeight - $('gallery-thumbnails').offsetHeight;
    const photo = activeProject.images[imageIndex];
    const ratio = photo.width / photo.height;
    const width = Math.max(1, Math.min(gallery.clientWidth - inset * 2, (availableHeight - strip - inset * 2) * ratio));
    frame.style.width = `${width + inset * 2}px`;
    frame.style.height = `${width / ratio + inset * 2 + strip}px`;
  }
  new ResizeObserver(sizeGallery).observe(dialog.querySelector('.dialog-gallery'));
  window.addEventListener('resize', sizeGallery);

  const projectLinks = [...document.querySelectorAll('[data-project]')];

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function updateGallery(direction = 0) {
    if (!activeProject) return;
    imageIndex = wrap(imageIndex + direction, activeProject.images.length);
    const photo = activeProject.images[imageIndex];
    const count = `${pad(imageIndex + 1)} / ${pad(activeProject.images.length)}`;
    const alt = photo.alt || `${activeProject.caseStudy.title} — photograph ${imageIndex + 1}`;
    const image = $('gallery-image');
    const edge = Math.max(photo.width, photo.height);
    image.decoding = 'async';
    image.sizes = '(max-width: 700px) calc(100vw - 40px), (max-width: 1500px) 48vw, 720px';
    image.srcset = `${encodeURI(photo.src.replace(/\.jpg$/i, '-640.webp'))} ${Math.round(photo.width * 640 / edge)}w, ${encodeURI(photo.src.replace(/\.jpg$/i, '-1200.webp'))} ${Math.round(photo.width * 1200 / edge)}w`;
    image.src = photo.src.replace(/\.jpg$/i, '-1200.webp');
    image.alt = alt;
    image.width = photo.width;
    image.height = photo.height;
    sizeGallery();
    const request = ++photoRequest;
    photoReveal?.cancel();
    image.decode().catch(() => {}).then(() => {
      if (request !== photoRequest || !dialog.open || reducedMotion.matches || motionPaused) return;
      photoReveal = image.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    });
    if (imageDialog.open) updateExpanded();
    $('gallery-count').textContent = count;
    $('expanded-count').textContent = count;
    $('gallery-thumbnails').querySelectorAll('button').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === imageIndex));
    });
  }

  function updateExpanded() {
    const photo = activeProject.images[imageIndex];
    const image = $('expanded-image');
    image.decoding = 'async';
    image.src = photo.src;
    image.alt = photo.alt || `${activeProject.caseStudy.title} — photograph ${imageIndex + 1}`;
    image.width = photo.width;
    image.height = photo.height;
  }

  function openProject(project, trigger) {
    dialog.classList.remove('is-gallery-ready');
    activeProject = project;
    imageIndex = 0;
    returnFocus = trigger;
    dialog.dataset.project = project.slug;
    dialog.style.setProperty('--project-accent', project.accent || project.palette?.[0]?.hex || '#bec9d7');
    dialog.style.setProperty('--project-wash', project.wash || project.palette?.[1]?.hex || '#344151');
    $('dialog-index').textContent = `${pad(projects.indexOf(project) + 1)} / ${pad(projects.length)}`;
    $('dialog-meta').textContent = `${project.meta} · ${project.year}`;
    $('dialog-title').textContent = project.caseStudy.title;
    $('dialog-summary').textContent = project.caseStudy.summary;
    $('dialog-palette').replaceChildren(...(project.palette || []).map((color) => {
      const swatch = element('span');
      swatch.style.setProperty('--swatch', color.hex);
      swatch.style.setProperty('--weight', color.weight || 1);
      swatch.title = color.hex.toUpperCase();
      return swatch;
    }));
    $('dialog-palette').setAttribute('aria-label', `Palette extracted from ${project.caseStudy.title}`);
    $('dialog-body').replaceChildren(...project.caseStudy.body.map((paragraph) => element('p', paragraph)));
    $('dialog-facts').replaceChildren(...project.caseStudy.facts.map((fact) => {
      const row = element('div');
      row.append(element('dt', fact.label), element('dd', fact.value));
      return row;
    }));
    $('dialog-links').replaceChildren(...(project.caseStudy.links || []).map((link) => {
      const anchor = element('a', link.label);
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.setAttribute('aria-label', `${link.label} (opens in a new tab)`);
      return anchor;
    }));
    $('gallery-thumbnails').replaceChildren(...project.images.map((photo, index) => {
      const button = element('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Show photograph ${index + 1}`);
      const thumbnail = element('img');
      thumbnail.src = photo.src.replace(/\.jpg$/i, '-thumb.webp');
      thumbnail.decoding = 'async';
      thumbnail.alt = '';
      thumbnail.width = 64;
      thumbnail.height = 64;
      button.append(thumbnail);
      button.addEventListener('click', () => { imageIndex = index; updateGallery(); });
      return button;
    }));
    updateGallery();
    window.AXDDialogs.open(dialog);
    sizeGallery();
    // Commit the first fitted dimensions before enabling transitions between photos.
    $('gallery-expand').getBoundingClientRect();
    dialog.classList.add('is-gallery-ready');
    dialog.scrollTop = 0;
  }

  // Links remain useful as image links when JavaScript or the dialog API is unavailable.
  if (typeof dialog.showModal === 'function') {
    projectLinks.forEach((link) => {
      const project = projects.find((item) => item.slug === link.dataset.project);
      if (!project) return;
      link.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openProject(project, link);
      });
    });
  }
  $('dialog-dismiss').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => returnFocus?.focus({ preventScroll: true }));
  $('gallery-prev').addEventListener('click', () => updateGallery(-1));
  $('gallery-next').addEventListener('click', () => updateGallery(1));
  $('expanded-prev').addEventListener('click', () => updateGallery(-1));
  $('expanded-next').addEventListener('click', () => updateGallery(1));
  $('gallery-expand').addEventListener('click', () => { window.AXDDialogs.open(imageDialog); updateExpanded(); });
  $('image-dismiss').addEventListener('click', () => imageDialog.close());
  document.querySelectorAll('.image-dismiss-side').forEach((side) => {
    side.addEventListener('click', () => imageDialog.close());
  });
  $('expanded-image').addEventListener('click', (event) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const box = image.getBoundingClientRect();
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const left = box.left + (box.width - width) / 2;
    const top = box.top + (box.height - height) / 2;
    if (event.clientX < left || event.clientX > left + width || event.clientY < top || event.clientY > top + height) imageDialog.close();
  });
  imageDialog.addEventListener('close', () => $('gallery-expand').focus({ preventScroll: true }));
  for (const modal of [dialog, imageDialog]) {
    modal.addEventListener('keydown', (event) => {
      // The topmost native dialog owns Escape and focus trapping.
      if (modal === dialog && imageDialog.open) return;
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      updateGallery(event.key === 'ArrowLeft' ? -1 : 1);
      modal.focus({ preventScroll: true });
    });
    modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      const rect = modal.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
    });
  }
  addSwipe($('gallery-expand'), (direction) => updateGallery(direction));
  addSwipe($('expanded-image'), (direction) => updateGallery(direction));

  function addSwipe(target, callback) {
    let start;
    let suppressClickUntil = 0;
    target.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      start = { x: event.clientX, y: event.clientY };
    }, { passive: true });
    target.addEventListener('pointerup', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      suppressClickUntil = Date.now() + 400;
      callback(dx < 0 ? 1 : -1);
    }, { passive: true });
    target.addEventListener('pointercancel', () => { start = null; }, { passive: true });
    target.addEventListener('click', (event) => {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }
})();
