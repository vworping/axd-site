(() => {
  'use strict';
  window.AXDKitchenVideo = (video, shouldPlay) => {
    let timer, active = false, disposed = false, pending = false, generation = 0;
    let attempts = 0, lastTime = video.currentTime, lastProgress = Date.now(), nextRetry = 0, blocked = false;
    const listeners = [];
    const listen = (type, handler) => { video.addEventListener(type, handler); listeners.push([type, handler]); };
    const allowed = () => !disposed && active && shouldPlay();
    function play() {
      if (!allowed() || pending || blocked) return;
      pending = true;
      const turn = generation;
      video.muted = true;
      Promise.resolve(video.play()).catch(error => {
        if (turn !== generation) return;
        if (error.name === 'NotAllowedError') blocked = true;
        else if (error.name !== 'AbortError') lastProgress = 0;
      }).finally(() => { if (turn === generation) pending = false; });
    }
    function recover() {
      if (!allowed() || blocked || attempts >= 3 || Date.now() < nextRetry) return;
      attempts++;
      nextRetry = Date.now() + 2000 * 2 ** attempts;
      generation++; pending = false;
      lastProgress = Date.now();
      video.load();
      lastTime = video.currentTime;
      play();
    }
    function watch() {
      timer = null;
      if (!allowed()) { sync(); return; }
      const progressing = video.currentTime !== lastTime;
      if (progressing) { lastTime = video.currentTime; lastProgress = Date.now(); attempts = 0; }
      if (video.error || video.networkState === 3 || Date.now() - lastProgress >= 8000) recover();
      else if (video.paused && !pending) play();
      timer = setTimeout(watch, 2000);
    }
    function sync(resumed = false) {
      const wanted = !disposed && shouldPlay();
      clearTimeout(timer); timer = null;
      if (!wanted) {
        active = false; generation++; pending = false;
        video.pause();
        return;
      }
      if (!active || resumed) {
        attempts = 0; nextRetry = 0; blocked = false;
        generation++; pending = false;
        lastProgress = Date.now(); lastTime = video.currentTime;
      }
      active = true;
      if (video.error || video.networkState === 3 || (resumed && video.readyState === 0)) recover();
      else play();
      timer = setTimeout(watch, 2000);
    }
    listen('canplay', play);
    listen('loadeddata', play);
    listen('error', recover);
    listen('timeupdate', () => {
      if (video.currentTime === lastTime) return;
      lastTime = video.currentTime; lastProgress = Date.now(); attempts = 0;
    });
    return {
      sync,
      dispose() {
        disposed = true; sync();
        listeners.forEach(([type, handler]) => video.removeEventListener(type, handler));
      },
    };
  };
})();
