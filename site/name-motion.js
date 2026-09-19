(() => {
  'use strict';
  const mark = document.getElementById('name-morph');
  const label = mark.querySelector('.name-label');
  const word = mark.querySelector('.name-word');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const names = ['AX', 'AXD', 'AXDRE', 'ANDRE'];
  let current = 0;
  let introduction = true;
  let timer, animation;
  let revision = 0;
  let ready = false;
  let visible = !('IntersectionObserver' in window);
  let paused = document.getElementById('motion-toggle').getAttribute('aria-pressed') === 'true';
  const canAnimate = () => ready && visible && !paused && !reduced.matches && !document.hidden;

  // Keep matching letters at either end: AXDRE -> ADRE -> ANDRE.
  function spellingSteps(from, to) {
    let prefix = 0, suffix = 0;
    while (prefix < Math.min(from.length, to.length) && from[prefix] === to[prefix]) prefix++;
    while (suffix < Math.min(from.length, to.length) - prefix && from[from.length - 1 - suffix] === to[to.length - 1 - suffix]) suffix++;
    const steps = [];
    let value = from;
    while (value.length > prefix + suffix) {
      const at = value.length - suffix - 1;
      value = value.slice(0, at) + value.slice(at + 1);
      steps.push(value);
    }
    for (let at = prefix; at < to.length - suffix; at++) {
      value = value.slice(0, at) + to[at] + value.slice(at);
      steps.push(value);
    }
    return steps;
  }

  function measure(text) {
    const probe = word.cloneNode(false);
    probe.textContent = text;
    probe.style.cssText = 'position:absolute;visibility:hidden;width:max-content;overflow:visible';
    label.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  }

  function fitLabel() {
    const size = parseFloat(getComputedStyle(mark).fontSize) * .98;
    label.style.fontSize = `${size}px`;
    const brackets = [...label.querySelectorAll('.name-bracket')].reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
    const required = Math.max(...names.map(measure)) + brackets + size * .05;
    const available = mark.clientWidth - 8;
    if (available > 0 && required > available) label.style.fontSize = `${size * available / required}px`;
    word.style.width = `${measure(word.textContent)}px`;
  }

  function schedule() {
    clearTimeout(timer);
    if (canAnimate()) timer = setTimeout(morph, introduction ? 1250 : 1600 + Math.random() * 700);
  }

  function settle() {
    revision++;
    animation?.cancel();
    animation = undefined;
    // Never leave a partially spelled name when paused or navigating away.
    word.textContent = names[current];
    fitLabel();
    schedule();
  }

  async function morph() {
    if (!canAnimate()) return;
    const version = ++revision;
    const next = introduction ? current + 1 : (current + 1 + Math.floor(Math.random() * (names.length - 1))) % names.length;
    try {
      for (const text of spellingSteps(names[current], names[next])) {
        const before = word.getBoundingClientRect().width;
        const after = measure(text);
        word.textContent = text;
        word.style.width = `${after}px`;
        // Only the word's width changes. The complete bracket glyphs remain
        // outside its clipping box, preventing the previous edge/line artifact.
        animation = word.animate([{ width: `${before}px` }, { width: `${after}px` }], {
          duration: 210, easing: 'cubic-bezier(.22,.7,.2,1)'
        });
        await animation.finished;
        if (version !== revision || !canAnimate()) return;
        animation = undefined;
      }
      current = next;
      if (current === names.length - 1) introduction = false;
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally {
      if (version === revision) {
        animation?.cancel();
        animation = undefined;
        word.textContent = names[current];
        fitLabel();
        schedule();
      }
    }
  }

  document.addEventListener('axd:motion', event => { paused = event.detail.paused; settle(); });
  reduced.addEventListener('change', settle);
  document.addEventListener('visibilitychange', settle);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; settle(); }).observe(mark);
  }
  if ('ResizeObserver' in window) new ResizeObserver(settle).observe(mark);
  else window.addEventListener('resize', settle, { passive: true });
  const font = document.fonts ? document.fonts.load('400 24px "DM Sans"') : Promise.resolve();
  font.catch(() => {}).then(() => { ready = true; fitLabel(); schedule(); });
})();
