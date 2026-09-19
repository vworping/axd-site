(() => {
  'use strict';

  const root = document.documentElement;
  const page = document.getElementById('top');
  const brand = document.getElementById('brand');
  const overlay = document.getElementById('intro-overlay');
  const mark = document.getElementById('intro-mark');
  const word = mark.querySelector('.mark-word');
  const brandPaths = [...brand.querySelectorAll('path')];
  const introPaths = [...mark.querySelectorAll('path')];
  const brandGradients = [...brand.querySelectorAll('linearGradient')];
  const introGradients = [...mark.querySelectorAll('linearGradient')];
  const skip = document.getElementById('intro-skip');
  const replay = document.getElementById('replay-intro');
  const toggle = document.getElementById('motion-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  let paused = reduced.matches;
  let visible = true;
  let active = false;
  let started = 0;
  let flight;
  let frame = 0;

  // Two continuous semicircles become the actual [ ] around AXD.
  // Cubic segments have the same point count in both shapes, avoiding a jump.
  function draw(paths, gradients, seconds, unfold = 1) {
    paths.forEach((path, side) => {
      const vertices = side === 0 ? [[20, 6], [7, 6], [7, 54], [20, 54]]
        : [[140, 6], [153, 6], [153, 54], [140, 54]];
      const direction = side === 0 ? -1 : 1;
      const span = direction * Math.PI / 3;
      const initialAngle = -Math.PI / 2 + seconds * .45;
      const radius = 24;
      let d = '';
      for (let part = 0; part < 3; part++) {
        const angle = initialAngle + part * span;
        const end = angle + span;
        const k = 4 / 3 * Math.tan(span / 4);
        const circle = [
          [80 + radius * Math.cos(angle), 30 + radius * Math.sin(angle)],
          [80 + radius * (Math.cos(angle) - k * Math.sin(angle)), 30 + radius * (Math.sin(angle) + k * Math.cos(angle))],
          [80 + radius * (Math.cos(end) + k * Math.sin(end)), 30 + radius * (Math.sin(end) - k * Math.cos(end))],
          [80 + radius * Math.cos(end), 30 + radius * Math.sin(end)],
        ];
        const bracket = [0, 1 / 3, 2 / 3, 1].map((t) =>
          vertices[part].map((v, axis) => lerp(v, vertices[part + 1][axis], t)));
        const points = bracket.map((point, i) => point.map((v, axis) => lerp(circle[i][axis], v, unfold).toFixed(2)));
        if (!part) d += `M ${points[0]} `;
        d += `C ${points[1]} ${points[2]} ${points[3]} `;
      }
      path.setAttribute('d', d.trim());
    });
    // Move a smooth field of measured colors inside each crisp bracket.
    gradients.forEach((gradient, side) => {
      const phase = seconds * .33 + side * .85 * unfold;
      gradient.setAttribute('gradientTransform', `translate(0 ${22 * Math.sin(phase)}) rotate(${16 * Math.sin(phase * .65)} 80 30)`);
    });
  }

  function settleBrackets(paths) {
    if (paths.length < 2) return;
    paths[0].setAttribute('d', 'M 20 6 L 7 6 L 7 54 L 20 54');
    paths[1].setAttribute('d', 'M 140 6 L 153 6 L 153 54 L 140 54');
  }

  function setPalette(palette) {
    if (!Array.isArray(palette) || palette.length !== 5 || !palette.every((s) => /^#[\da-f]{6}$/i.test(s.hex))) return;
    const sequence = [0, 1, 2, 3, 4, 3, 2, 1, 0];
    [...brandGradients, ...introGradients].forEach((gradient) => {
      gradient.querySelectorAll('stop').forEach((stop, i) => stop.setAttribute('stop-color', palette[sequence[i]].hex));
    });
  }
  setPalette(window.PHOTOGRAPHS?.[0]?.palette);
  document.addEventListener('axd:palette', (event) => setPalette(event.detail.palette));

  function syncControls() {
    toggle.hidden = false;
    toggle.disabled = reduced.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
    if (reduced.matches) toggle.textContent = 'Reduced motion on';
    replay.hidden = false;
    replay.disabled = reduced.matches || paused;
    document.dispatchEvent(new CustomEvent('axd:motion', { detail: { paused } }));
  }

  function finishIntro() {
    const focusWasInside = overlay.contains(document.activeElement);
    active = false;
    flight = undefined;
    clearTimeout(window.axdIntroDeadline);
    root.classList.remove('intro-pending', 'intro-reveal');
    page.inert = false;
    overlay.style.removeProperty('--veil');
    mark.style.removeProperty('transform');
    word.style.removeProperty('opacity');
    word.style.removeProperty('transform');
    skip.style.removeProperty('opacity');
    if (focusWasInside) brand.focus({ preventScroll: true });
    requestFrame();
  }

  function paint(now) {
    frame = 0;
    // Let requestAnimationFrame follow the display refresh rate. The settled
    // header needs only gradient updates; its bracket geometry is already fixed.
    const seconds = paused || reduced.matches ? 0 : now / 1000;
    draw([], brandGradients, seconds);
    if (active) {
      if (!root.classList.contains('intro-pending') || window.axdIntroExpired) {
        finishIntro();
        return;
      }
      const elapsed = now - started;
      const unfold = smooth((elapsed - 900) / 1200);
      const appear = smooth((elapsed - 1700) / 600);
      if (unfold >= 1) settleBrackets(introPaths);
      else draw(introPaths, introGradients, seconds, unfold);
      word.style.opacity = appear;
      word.style.transform = `translateY(${9 * (1 - appear)}px)`;
      if (elapsed >= 2500) {
        if (!flight) {
          const from = mark.getBoundingClientRect();
          const to = brand.getBoundingClientRect();
          flight = { x: to.left - from.left, y: to.top - from.top, scale: to.width / from.width };
          root.classList.add('intro-reveal');
        }
        const progress = clamp((elapsed - 2500) / 1700);
        const easing = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
        mark.style.transform = `translate(${flight.x * easing}px, ${flight.y * easing}px) scale(${lerp(1, flight.scale, easing)})`;
        overlay.style.setProperty('--veil', 1 - smooth(progress / .8));
        skip.style.opacity = 1 - smooth(progress * 4);
      }
      if (elapsed >= 4250) { finishIntro(); return; }
    }
    requestFrame();
  }

  function requestFrame() {
    if (frame || document.hidden) return;
    if (!active && (paused || reduced.matches || !visible)) return;
    frame = requestAnimationFrame(paint);
  }

  function startIntro() {
    if (reduced.matches || paused) { finishIntro(); return; }
    if (active) return;
    window.axdIntroExpired = false;
    root.classList.add('intro-pending');
    root.classList.remove('intro-reveal');
    page.inert = true;
    mark.style.removeProperty('transform');
    word.style.opacity = 0;
    draw(introPaths, introGradients, performance.now() / 1000, 0);
    active = true;
    started = performance.now();
    flight = undefined;
    clearTimeout(window.axdIntroDeadline);
    window.axdIntroDeadline = setTimeout(finishIntro, 6000);
    requestFrame();
  }

  skip.addEventListener('click', finishIntro);
  document.querySelector('.skip-link').addEventListener('click', () => { if (active) finishIntro(); });
  document.addEventListener('keydown', (event) => {
    if (active && ['Escape', 'Tab'].includes(event.key)) finishIntro();
  });
  window.addEventListener('resize', () => { if (active) finishIntro(); }, { passive: true });
  window.addEventListener('pagehide', finishIntro);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else requestFrame();
  });
  toggle.addEventListener('click', () => {
    paused = !paused;
    if (paused && frame) { cancelAnimationFrame(frame); frame = 0; }
    if (paused && active) finishIntro();
    syncControls();
    requestFrame();
  });
  replay.addEventListener('click', () => {
    const behavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    document.dispatchEvent(new CustomEvent('axd:home'));
    window.scrollTo(0, 0);
    root.style.scrollBehavior = behavior;
    startIntro();
  });
  reduced.addEventListener('change', () => {
    paused = reduced.matches;
    if (paused) {
      finishIntro();
      cancelAnimationFrame(frame);
      frame = 0;
      draw(brandPaths, brandGradients, 0);
    }
    syncControls();
    requestFrame();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && !active && frame) { cancelAnimationFrame(frame); frame = 0; }
      requestFrame();
    }).observe(brand);
  }

  draw(brandPaths, brandGradients, 0);
  syncControls();
  if (root.classList.contains('intro-pending')) {
    page.inert = true;
    // Wait briefly for the display font so the shrinking mark lands precisely.
    const font = document.fonts ? document.fonts.load('900 32px Archivo').catch(() => {}) : Promise.resolve();
    Promise.race([font, new Promise((resolve) => setTimeout(resolve, 500))]).then(() => {
      if (root.classList.contains('intro-pending') && !window.axdIntroExpired) startIntro();
      else finishIntro();
    }).catch(finishIntro);
  } else {
    finishIntro();
  }
})();
