import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('case-studies.js', import.meta.url), 'utf8');
function example({ reduced = false, paused = false } = {}) {
  const animations = [], pending = [], opened = [], observers = [];
  const target = () => {
    const listeners = new Map();
    return {
      dataset: {}, style: { setProperty(key, value) { this[key] = value; } }, attributes: {}, children: [],
      clientWidth: 340, clientHeight: 190, offsetWidth: 320, offsetHeight: 400, naturalWidth: 2, naturalHeight: 1,
      getBoundingClientRect() { return { left: 0, top: 0, width: this.offsetWidth, height: this.offsetHeight }; },
      focus() { document.activeElement = this; },
      cloneNode() { return { ...target(), src: this.src }; },
      removeAttribute(key) { delete this.attributes[key]; },
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key]; },
      replaceChildren(...children) { this.children = children; },
      append(child) { child.parentElement = this; this.children.push(child); },
      remove() { this.removed = true; },
      querySelector(selector) { return this.children.find(child => '.' + child.className === selector); },
      addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
      emit(type, event = {}) { for (const callback of listeners.get(type) || []) callback(event); },
      animate(frames, options) { const animation = { element: this, frames, options, cancelled: false, cancel() { this.cancelled = true; } }; animations.push(animation); return animation; },
    };
  };
  const document = target(), preference = { ...target(), matches: reduced }, window = target();
  const chapter = { inert: false, classList: { contains: () => false } };
  document.body = { classList: { contains: () => paused } };
  document.createElement = tag => {
    const element = target();
    if (tag === 'canvas') element.getContext = () => ({
      drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([20, 40, 60, 255, 160, 180, 200, 255]) }),
      createImageData: () => ({ data: new Uint8ClampedArray(8) }), putImageData() {},
    });
    return element;
  };
  const photos = [2025, 2024, 2023].map((year, index) => ({
    id: String(index), year, src: `${year}.jpg`, image: `raw/${year}.jpg`, width: 600, height: 900,
    palette: [{ hex: `#${index}12345`, weight: .75 }, { hex: '#abcdef', weight: .25 }],
  }));
  function print(image) {
    const frame = target(); frame.append(image);
    const figure = target();
    figure.querySelector = selector => selector === 'img' ? image : selector === 'figcaption' ? { textContent: image.src } : frame;
    return figure;
  }
  const elements = Object.fromEntries(['image', 'caption', 'state', 'options', 'feedback', 'reveal', 'next', 'explore'].map(name => [name, target()]));
  elements.print = print(elements.image);
  const game = {
    ...target(), dataset: { rounds: photos.map(photo => `${photo.year}/${photo.id}`).join(',') },
    querySelector: selector => elements[({ '[data-guess-image]': 'image', '.palette-game-print': 'print', '[data-guess-caption]': 'caption', '[data-guess-state]': 'state', '[data-guess-options]': 'options', '[data-guess-feedback]': 'feedback', '[data-guess-reveal]': 'reveal', '[data-guess-next]': 'next', '[data-guess-explore]': 'explore' })[selector]],
  };
  const switches = ['landscape', 'filtered'].map(initial => {
    const panels = [initial, 'alternative'].map((value, index) => {
      const image = { ...target(), src: photos[index].src };
      return { ...print(image), dataset: { studyPanel: value }, hidden: value !== initial };
    });
    const status = target(), radio = target(), device = target(), stage = target(), caption = target();
    return { ...target(), dataset: { view: initial }, panels, status, radio, device, stage, caption, querySelectorAll: () => panels,
      querySelector: selector => initial === 'landscape' ? ({ '.pet-orientation-device': device, '.pet-orientation-stage': stage, '[data-orientation-caption]': caption })[selector] || null : selector === '.extraction-match' ? {} : selector === '[data-extraction-status]' ? status : selector.startsWith('input[') ? radio : null };
  });
  const choices = [0, 1].map(index => ({ ...target(), dataset: { analysisChoice: String(index) } }));
  choices.forEach((choice, index) => choice.setAttribute('aria-pressed', String(!index)));
  const panels = choices.map((_, category) => {
    const slides = [0, 1].map((index) => {
      const image = { ...target(), src: photos[(category + index) % photos.length].src };
      const figure = print(image);
      const steps = [-1, 1].map(step => ({ ...target(), dataset: { analysisStep: String(step) } }));
      return { ...target(), steps, dataset: { analysisPhoto: String(index) }, hidden: Boolean(index), image, figure,
        querySelector: selector => selector === 'figure' ? figure : selector.includes('data-analysis-step') ? steps.find(step => selector.includes('"' + step.dataset.analysisStep + '"')) : { textContent: `Example ${category}/${index}` } };
    });
    return { ...target(), hidden: Boolean(category), dataset: { analysisPanel: String(category) }, slides,
      get steps() { return slides.find(slide => !slide.hidden).steps; },
      querySelector: selector => selector.includes(':not') ? slides.find(slide => !slide.hidden) : slides.find(slide => selector.includes('"' + slide.dataset.analysisPhoto + '"')),
      querySelectorAll: selector => selector === '[data-analysis-step]' ? slides.flatMap(slide => slide.steps) : slides };
  });
  const openers = photos.slice(0, 2).map(photo => ({ ...target(), dataset: { analysisOpen: `${photo.year}/${photo.id}` } }));
  const status = target();
  const analysis = { querySelector: () => status, querySelectorAll: selector => ({ '[data-analysis-choice]': choices, '[data-analysis-panel]': panels, '[data-analysis-open]': openers })[selector] };
  const cardElements = Object.fromEntries(['turn', 'tag', 'front', 'back', 'place', 'flip', 'status', 'stage'].map(name => [name, target()]));
  const card = { dataset: { side: 'front', tag: 'ready' }, querySelector: selector => cardElements[({ '.pet-card-turn': 'turn', '[data-nfc-tag]': 'tag', '.pet-card-front': 'front', '.pet-card-back': 'back', '[data-nfc-place]': 'place', '[data-nfc-flip]': 'flip', '[data-nfc-status]': 'status', '.pet-card-stage': 'stage' })[selector]] };
  const prototypePrints = [0, 1].map(index => {
    const image = { ...target(), src: `prototype-${index}.jpg` };
    const figure = print(image), select = figure.querySelector;
    const steps = [-1, 1].map(step => ({ ...target(), dataset: { prototypeStep: String(step) } }));
    figure.hidden = Boolean(index);
    figure.steps = steps;
    figure.querySelector = selector => selector === 'figcaption span' ? { textContent: index ? 'Back' : 'Front' } : selector.includes('data-prototype-step') ? steps.find(step => selector.includes('"' + step.dataset.prototypeStep + '"')) : select(selector);
    return figure;
  });
  const prototypeStatus = target();
  const prototypeGallery = { querySelector: () => prototypeStatus, querySelectorAll: selector => selector === '[data-pet-photo]' ? prototypePrints : prototypePrints.flatMap(figure => figure.steps) };
  chapter.querySelector = () => ({ querySelectorAll: selector => ({ '[data-study-switch]': switches, '[data-palette-game]': [game], '[data-analysis-examples]': [analysis], '[data-nfc-card]': [card], '[data-pet-photos]': [prototypeGallery] })[selector] || [] });
  runInNewContext(source + '\ninitCaseStudy(photos, openPhoto);', {
    chapter, document, window, photos, Uint8ClampedArray, getComputedStyle: element => ({ filter: element.style.filter || 'none' }), matchMedia: () => preference, openPhoto: value => opened.push(value),
    IntersectionObserver: class { constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); } observe(element) { this.element = element; } disconnect() { this.disconnected = true; } },
    Image: class { decode() { return new Promise((resolve, reject) => pending.push({ src: this.src, resolve, reject })); } },
  });
  return { chapter, document, window, preference, photos, game, elements, switches, animations, pending, opened, choices, panels, openers, status, card, cardElements, prototypePrints, prototypeStatus, observers };
}
const settle = async request => { request.resolve(); await new Promise(setImmediate); };

test('wrong guesses allow retry; the correct real palette reveals the original and opens its viewer', () => {
  const page = example(), { elements, game } = page;
  const original = JSON.stringify(page.photos);
  assert.equal(elements.image.src, '2025.jpg');
  assert.equal(game.dataset.state, 'guessing');
  assert.equal(elements.explore.hidden, true);
  const [wrong, correct] = elements.options.children;
  assert.equal(correct.children[1].children[0].style.background, page.photos[0].palette[0].hex);
  assert.equal(correct.children[1].children[0].style.flex, .75);
  assert.match(correct.getAttribute('aria-label'), /75.0%/);
  wrong.emit('click');
  assert.equal(game.dataset.state, 'guessing');
  assert.match(elements.feedback.textContent, /different photograph/i);
  correct.emit('click');
  assert.equal(game.dataset.state, 'revealed');
  assert.equal(elements.image.src, '2025.jpg', 'Reveal the original asset, not an invented recoloring');
  assert.match(elements.feedback.textContent, /That’s the one/);
  assert.equal(correct.dataset.result, 'correct');
  wrong.emit('click');
  assert.match(elements.feedback.textContent, /That’s the one/);
  elements.explore.emit('click');
  assert.deepEqual(page.opened, ['raw/2025.jpg']);
  assert.equal(JSON.stringify(page.photos), original);
});

test('skip reveals the correct answer; a new round resets the image, choices and result together', async () => {
  const page = example(), { elements, game } = page;
  elements.reveal.emit('click');
  assert.equal(game.dataset.state, 'revealed');
  elements.next.emit('click');
  assert.equal(elements.image.src, '2025.jpg');
  assert.equal(elements.options.children[0].getAttribute('aria-disabled'), 'true');
  await settle(page.pending[0]);
  assert.equal(elements.image.src, '2024.jpg');
  assert.equal(game.dataset.state, 'guessing');
  assert.equal(elements.explore.hidden, true);
  assert.equal(elements.options.children[2].children[1].children[0].style.background, page.photos[1].palette[0].hex);
  elements.options.children[2].emit('click');
  assert.equal(game.dataset.state, 'revealed');
  elements.explore.emit('click');
  assert.deepEqual(page.opened, ['raw/2024.jpg']);
});

test('rapid next requests cannot mismatch a photograph and its answer', async () => {
  const page = example(), { elements } = page;
  elements.next.emit('click');
  elements.next.emit('click');
  await settle(page.pending[1]);
  await settle(page.pending[0]);
  assert.equal(elements.image.src, '2023.jpg');
  elements.options.children[0].emit('click');
  assert.equal(page.game.dataset.state, 'revealed');
  elements.next.emit('click');
  await settle(page.pending[2]);
  assert.equal(elements.image.src, '2025.jpg', 'The collection wraps');
});

test('a failed image load preserves the current round and makes retry possible', async () => {
  const page = example(), { elements } = page;
  elements.next.emit('click');
  page.pending[0].reject(new Error('offline'));
  await new Promise(setImmediate);
  assert.equal(elements.image.src, '2025.jpg');
  assert.match(elements.feedback.textContent, /could not load/);
  assert.equal(elements.options.children[0].getAttribute('aria-disabled'), 'false');
  elements.next.emit('click');
  await settle(page.pending[1]);
  assert.equal(elements.image.src, '2024.jpg');
});

test('reveals and analysis selection work without animation under paused or reduced motion', async () => {
  for (const options of [{ reduced: true }, { paused: true }]) {
    const page = example(options);
    page.elements.reveal.emit('click');
    page.choices[1].emit('click');
    await settle(page.pending[0]);
    assert.equal(page.game.dataset.state, 'revealed');
    assert.equal(page.panels[1].hidden, false);
    assert.equal(page.animations.length, 0);
  }
});

test('interrupted reveals remove all effects and preserve the correct original', () => {
  for (const reason of ['pause', 'preference', 'departure', 'resize', 'hidden']) {
    const page = example();
    page.elements.reveal.emit('click');
    assert.ok(page.animations.length > 0);
    if (reason === 'pause') page.document.emit('axd:motion', { detail: { paused: true } });
    if (reason === 'preference') { page.preference.matches = true; page.preference.emit('change'); }
    if (reason === 'departure') { page.chapter.inert = true; page.document.emit('axd:chapter'); }
    if (reason === 'resize') page.window.emit('resize');
    if (reason === 'hidden') { page.document.hidden = true; page.document.emit('visibilitychange'); }
    assert.ok(page.animations.every(animation => animation.cancelled));
    assert.equal(page.elements.image.style.filter, '');
    assert.ok(page.game.children.every(element => element.removed));
    assert.equal(page.game.dataset.state, 'revealed');
  }
});

test('analysis selection exposes only its corresponding example and supports the existing viewer', async () => {
  const page = example();
  page.choices[1].emit('click');
  await settle(page.pending[0]);
  assert.deepEqual(page.panels.map(panel => panel.hidden), [true, false]);
  assert.deepEqual(page.choices.map(choice => choice.getAttribute('aria-pressed')), ['false', 'true']);
  assert.match(page.status.textContent, /Example 1\/0/);
  page.openers[1].emit('click');
  assert.deepEqual(page.opened, ['raw/2024.jpg']);
});

test('comparison controls remain isolated from the palette game and each other', () => {
  const page = example(), [orientation, extraction] = page.switches;
  orientation.emit('change', { target: { matches: () => false, value: 'unrelated' } });
  assert.equal(orientation.dataset.view, 'landscape');
  orientation.emit('change', { target: { matches: () => true, value: 'alternative' } });
  assert.deepEqual(orientation.panels.map(panel => panel.hidden), [true, false]);
  assert.equal(extraction.dataset.view, 'filtered');
  assert.equal(page.game.dataset.state, 'guessing');
});


test('color groups preserve original pixels, including transparency, without inventing colors', () => {
  const group = runInNewContext(source + '\npalettePixelGroups', { Uint8ClampedArray });
  const pixels = new Uint8ClampedArray([250, 10, 0, 255, 0, 10, 240, 128, 80, 40, 20, 0]);
  const groups = group(pixels, 3, [{ hex: '#ff0000' }, { hex: '#0000ff' }]);
  assert.equal(groups[0].count, 1);
  assert.equal(groups[1].count, 1);
  assert.deepEqual([...groups[0].pixels.slice(0, 4)], [250, 10, 0, 255]);
  assert.deepEqual([...groups[1].pixels.slice(4, 8)], [0, 10, 240, 128]);
  assert.equal(groups.reduce((sum, item) => sum + item.count, 0), 2);
});

test('swatches travel one by one and each original-color mask arrives after its swatch', () => {
  const page = example();
  page.elements.reveal.emit('click');
  const flights = page.animations.filter(animation => animation.element.className === 'palette-flight');
  assert.equal(flights.length, 2);
  assert.deepEqual(flights.map(animation => animation.options.delay), [0, 260]);
  assert.equal(page.elements.image.style.filter, 'grayscale(1)');
  const finish = page.animations.at(-1);
  finish.onfinish();
  assert.equal(page.elements.image.style.filter, '');
  assert.ok(page.game.children.every(element => element.removed));
  assert.ok(finish.cancelled, 'A completed filter animation cannot override the next monochrome round');
});

test('photo crossfades retain the outgoing image and clean it up when interrupted', async () => {
  const page = example();
  page.elements.reveal.emit('click');
  const flights = page.game.children.slice();
  page.elements.next.emit('click');
  await settle(page.pending[0]);
  assert.ok(flights.every(element => element.removed));
  assert.equal(page.elements.image.style.filter, '');
  const resize = page.animations.find(animation => animation.element === page.elements.print);
  assert.ok(resize.options.duration >= 650);
  assert.equal(resize.options.easing, 'cubic-bezier(.22,1,.36,1)');
  assert.equal(page.game.dataset.state, 'guessing');
  const outgoing = page.elements.image.parentElement.children.find(item => item.className === 'study-photo-outgoing');
  assert.equal(outgoing.src, '2025.jpg');
  assert.equal(outgoing.getAttribute('aria-hidden'), 'true');
  page.window.emit('resize');
  assert.equal(outgoing.removed, true);
});

test('analysis examples keep their category and ignore stale or failed loads', async () => {
  const page = example();
  page.panels[0].steps[1].emit('click');
  page.choices[1].emit('click');
  await settle(page.pending[1]);
  await settle(page.pending[0]);
  assert.equal(page.panels[1].hidden, false);
  assert.equal(page.panels[0].slides[1].hidden, true);
  page.panels[1].steps[1].emit('click');
  page.pending[2].reject(new Error('offline'));
  await new Promise(setImmediate);
  assert.equal(page.panels[1].slides[0].hidden, false);
  assert.match(page.status.textContent, /could not load/);
  page.panels[1].steps[1].emit('click');
  await settle(page.pending[3]);
  assert.equal(page.panels[1].slides[1].hidden, false);
  page.panels[1].steps[1].emit('click');
  await settle(page.pending[4]);
  assert.equal(page.panels[1].slides[0].hidden, false, 'Another example wraps within its category');
  page.panels[1].steps[0].emit('click');
  await settle(page.pending[5]);
  assert.equal(page.panels[1].slides[1].hidden, false, 'Previous example wraps in the opposite direction');
});

test('extraction comparison decodes before transitioning and rolls back a failed selection', async () => {
  const page = example(), extraction = page.switches[1];
  extraction.emit('change', { target: { matches: () => true, value: 'alternative' } });
  assert.equal(extraction.dataset.view, 'filtered');
  await settle(page.pending[0]);
  assert.equal(extraction.dataset.view, 'alternative');
  assert.deepEqual(extraction.panels.map(panel => panel.hidden), [true, false]);
  assert.ok(page.animations.some(animation => animation.options.duration === 700));
  extraction.emit('change', { target: { matches: () => true, value: 'filtered' } });
  page.pending[1].reject(new Error('offline'));
  await new Promise(setImmediate);
  assert.equal(extraction.dataset.view, 'alternative');
  assert.equal(extraction.radio.checked, true);
  assert.match(extraction.status.textContent, /could not load/);
});

test('in-photo navigation keeps keyboard focus on the replacement arrow without stealing moved focus', async () => {
  const page = example(), panel = page.panels[0];
  const next = panel.steps[1];
  next.focus();
  next.emit('click');
  await settle(page.pending[0]);
  assert.equal(panel.slides[1].hidden, false);
  assert.equal(page.document.activeElement, panel.steps[1]);
  assert.notEqual(page.document.activeElement, next);
  panel.steps[0].focus();
  panel.steps[0].emit('click');
  page.choices[0].focus();
  await settle(page.pending[1]);
  assert.equal(panel.slides[0].hidden, false);
  assert.equal(page.document.activeElement, page.choices[0]);
});

test('NFC placement returns to the white front, and reduced motion keeps the same final state', () => {
  for (const reduced of [false, true]) {
    const page = example({ reduced }), { card, cardElements: controls } = page;
    controls.flip.emit('click');
    assert.equal(card.dataset.side, 'back');
    assert.equal(controls.front.getAttribute('aria-hidden'), 'true');
    controls.place.emit('click');
    assert.equal(card.dataset.side, 'front');
    assert.equal(card.dataset.tag, 'placed');
    assert.equal(controls.back.getAttribute('aria-hidden'), 'true');
    assert.equal(controls.tag.getAttribute('aria-hidden'), 'false');
    assert.match(controls.status.textContent, /top-right of the white front/);
    if (reduced) assert.equal(page.animations.length, 0);
    else assert.equal(page.animations.find(animation => animation.element === controls.tag).options.delay, 600);
    controls.place.emit('click');
    assert.equal(card.dataset.tag, 'placed');
  }
});

test('prototype photographs decode before changing, preserve keyboard focus, and ignore stale loads', async () => {
  const page = example(), { prototypePrints: prints } = page;
  const next = prints[0].steps[1];
  next.focus(); next.emit('click');
  assert.equal(prints[0].hidden, false);
  await settle(page.pending[0]);
  assert.equal(prints[1].hidden, false);
  assert.equal(page.document.activeElement, prints[1].steps[1]);
  assert.equal(page.prototypeStatus.textContent, 'Back');
  prints[1].steps[1].emit('click');
  prints[1].steps[1].emit('click');
  await settle(page.pending[2]);
  await settle(page.pending[1]);
  assert.equal(prints[1].hidden, false);
});

test('a failed prototype image leaves the existing photograph available', async () => {
  const page = example(), { prototypePrints: prints } = page;
  prints[0].steps[1].emit('click');
  page.pending[0].reject(new Error('Offline'));
  await new Promise(setImmediate);
  assert.equal(prints[0].hidden, false);
  assert.match(page.prototypeStatus.textContent, /could not load/);
  prints[0].steps[1].emit('click');
  await settle(page.pending[1]);
  assert.equal(prints[1].hidden, false);
});


test('the NFC tag arrives once when its card enters the active chapter viewport', () => {
  const page = example(), observer = page.observers[0];
  assert.equal(observer.options.root, page.chapter);
  page.chapter.inert = true;
  observer.callback([{ isIntersecting: true, intersectionRatio: .7 }]);
  assert.equal(page.card.dataset.tag, 'ready');
  page.chapter.inert = false;
  page.document.emit('axd:chapter');
  assert.equal(page.card.dataset.tag, 'placed');
  assert.equal(observer.disconnected, true);
  const count = page.animations.length;
  page.document.emit('axd:chapter');
  assert.equal(page.animations.length, count);
});

test('orientation blanks the screen before rotation and settles cleanly when motion stops', () => {
  const page = example(), orientation = page.switches[0];
  orientation.emit('change', { target: { matches: () => true, value: 'alternative' } });
  assert.equal(orientation.dataset.view, 'alternative');
  assert.deepEqual(orientation.panels.map(panel => panel.hidden), [true, false]);
  const rotation = page.animations.find(animation => animation.element === orientation.device);
  assert.match(rotation.frames[0].transform, /90deg/);
  assert.equal(rotation.frames.at(-1).transform, 'rotate(0deg)');
  const relight = page.animations.find(animation => animation.element === orientation.panels[1]);
  assert.equal(relight.options.delay, 800);
  page.document.emit('axd:motion', { detail: { paused: true } });
  assert.equal(rotation.cancelled, true);
  assert.ok(orientation.device.children.every(child => child.removed));
  assert.equal(orientation.panels[1].hidden, false);
  const quiet = example({ reduced: true });
  quiet.switches[0].emit('change', { target: { matches: () => true, value: 'alternative' } });
  assert.equal(quiet.switches[0].panels[1].hidden, false);
  assert.equal(quiet.animations.length, 0);
});
