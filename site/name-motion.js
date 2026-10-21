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

  // Whole words roll inside closely fitted brackets; the About name keeps spelling.
  function startTagline() {
    const tagline = document.getElementById('hero-tagline');
    if (!tagline) return;
    const line = tagline.querySelector('.tagline-label');
    const words = [...line.querySelectorAll('.tagline-word')];
    const pairs = [
      ['photographer', 'researcher’s'],
      ['data analyst', 'researcher’s'],
      ['data analyst', 'photographer’s'],
      ['photographer', 'data analyst’s'],
      ['creative technologist', 'photographer’s'],
      ['creative technologist', 'researcher’s'],
      ['strategist', 'researcher’s'],
      ['strategist', 'photographer’s'],
      ['friend', 'photographer’s'],
      ['baker', 'researcher’s'],
      ['photographer', 'baker’s'],
    ];
    let index = 0, version = 0, timeout;
    let remaining = [];
    let inView = false, loaded = false, stopped = paused;
    const animations = new Set();
    const running = () => loaded && inView && !stopped && !reduced.matches && !document.hidden;
    function wordWidth(word, text) {
      const probe = document.createElement('span');
      probe.className = 'tagline-value';
      probe.textContent = text;
      probe.style.cssText = 'position:absolute;visibility:hidden;width:max-content;white-space:nowrap';
      word.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    }
    function fit() {
      // Fit the longest phrases once per viewport so type size stays constant.
      // Then close each bracket around its current phrase instead of retaining
      // the measuring space around shorter words.
      line.style.removeProperty('--tagline-size');
      const reserve = () => words.forEach((word, i) => {
        word.style.width = `${Math.ceil(Math.max(...pairs.map(pair => wordWidth(word, pair[i]))))}px`;
      });
      reserve();
      const available = tagline.clientWidth - 2;
      const width = line.getBoundingClientRect().width;
      if (available > 0 && width > available) {
        const size = parseFloat(getComputedStyle(line).fontSize);
        line.style.setProperty('--tagline-size', `${size * available / width}px`);
      }
      words.forEach((word, i) => word.style.width = `${Math.ceil(wordWidth(word, pairs[index][i]))}px`);
    }
    function value(text) {
      const span = document.createElement('span');
      span.className = 'tagline-value';
      span.textContent = text;
      return span;
    }
    function schedule() {
      clearTimeout(timeout);
      if (running()) timeout = setTimeout(morphPair, 3000);
    }
    function settlePair() {
      version++;
      animations.forEach(animation => animation.cancel());
      animations.clear();
      words.forEach((word, i) => word.replaceChildren(value(pairs[index][i])));
      fit();
      schedule();
    }
    async function morphPair() {
      if (!running()) return;
      const revision = ++version;
      // Visit every other pairing in a fresh random order before refilling.
      if (!remaining.length) remaining = pairs.map((_, i) => i).filter(i => i !== index);
      const [next] = remaining.splice(Math.floor(Math.random() * remaining.length), 1);
      try {
        await Promise.all(words.map(async (word, i) => {
          if (pairs[index][i] === pairs[next][i]) return;
          const outgoing = word.firstElementChild;
          const incoming = value(pairs[next][i]);
          const before = word.getBoundingClientRect().width;
          const after = Math.ceil(wordWidth(word, pairs[next][i]));
          word.append(incoming);
          const options = { duration: 400, delay: i * 100, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' };
          const rolling = [
            outgoing.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], options),
            incoming.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], options),
            word.animate([{ width: `${before}px` }, { width: `${after}px` }], options),
          ];
          rolling.forEach(animation => animations.add(animation));
          await Promise.all(rolling.map(animation => animation.finished));
          if (revision !== version || !running()) return;
          word.replaceChildren(incoming);
          word.style.width = `${after}px`;
          rolling.forEach(animation => {
            animation.cancel();
            animations.delete(animation);
          });
        }));
        if (revision === version) index = next;
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      } finally {
        if (revision === version) settlePair();
      }
    }
    document.addEventListener('axd:motion', event => { stopped = event.detail.paused; settlePair(); });
    reduced.addEventListener('change', settlePair);
    document.addEventListener('visibilitychange', settlePair);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; settlePair(); }).observe(tagline);
    } else inView = true;
    if ('ResizeObserver' in window) new ResizeObserver(settlePair).observe(tagline);
    else window.addEventListener('resize', settlePair, { passive: true });
    const font = document.fonts ? document.fonts.load('400 24px "DM Sans"') : Promise.resolve();
    font.catch(() => {}).then(() => { loaded = true; settlePair(); });
  }
  startTagline();

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
