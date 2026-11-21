import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./kitchen-video.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function player() {
  let time = 100, eligible = true, id = 0;
  const events = new Map(), timers = new Map(), window = {};
  const video = { currentTime: 0, readyState: 4, networkState: 1, paused: true, loads: 0, plays: 0,
    addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type),
    load() { this.loads++; this.error = null; this.networkState = 2; },
    play() { this.plays++; this.paused = false; return this.result?.() || Promise.resolve(); },
    pause() { this.paused = true; },
  };
  runInNewContext(source, { window, Date: { now: () => time }, setTimeout(fn, delay) { timers.set(++id, { fn, at: time + delay }); return id; }, clearTimeout: key => timers.delete(key) });
  const controller = window.AXDKitchenVideo(video, () => eligible);
  return { video, controller, timers, setVisible(value) { eligible = value; controller.sync(); }, emit: type => events.get(type)?.(),
    async tick(ms) { time += ms; for (const [key, task] of [...timers]) if (task.at <= time) { timers.delete(key); task.fn(); } await flush(); },
  };
}
test('returning to a sleeping tab reloads an errored video and retries muted playback', async () => {
  const p = player(); p.controller.sync(); await flush();
  p.setVisible(false);
  p.video.error = { code: 2 }; p.video.readyState = 0;
  p.setVisible(true);
  assert.equal(p.video.loads, 1);
  assert.equal(p.video.paused, false);
  assert.equal(p.video.muted, true);
});
test('a stalled pending play promise cannot prevent recovery', async () => {
  const p = player(); p.video.result = () => new Promise(() => {});
  p.controller.sync();
  await p.tick(8100);
  assert.equal(p.video.loads, 1);
  assert.equal(p.video.plays, 2);
});
test('recovery is bounded while offline and a resume gives it another chance', async () => {
  const p = player(); p.controller.sync(); await flush();
  for (let i = 0; i < 8; i++) await p.tick(20000);
  assert.equal(p.video.loads, 3);
  p.video.error = { code: 2 }; p.controller.sync(true);
  assert.equal(p.video.loads, 4);
});
test('offscreen, paused, or removed media stops recovery work', async () => {
  const p = player(); p.controller.sync(); p.setVisible(false);
  await p.tick(20000);
  assert.equal(p.video.loads, 0);
  assert.equal(p.video.paused, true);
  assert.equal(p.timers.size, 0);
  p.controller.dispose(); p.setVisible(true);
  assert.equal(p.timers.size, 0);
});
test('healthy looping playback never reloads and autoplay denial does not loop retries', async () => {
  const p = player(); p.controller.sync(); await flush();
  for (const currentTime of [1, 2, .2, 1.2]) { p.video.currentTime = currentTime; p.emit('timeupdate'); await p.tick(3000); }
  assert.equal(p.video.loads, 0);
  const blocked = player(); blocked.video.result = () => Promise.reject({ name: 'NotAllowedError' });
  blocked.controller.sync(); await flush(); await blocked.tick(20000);
  assert.equal(blocked.video.loads, 0);
  assert.equal(blocked.video.plays, 1);
});
