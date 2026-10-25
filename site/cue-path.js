// One curved pointer for the photo deck and palette, at every viewport size.
(() => {
  function cuePath(tail, tip) {
    const dx = tip[0] - tail[0], dy = tip[1] - tail[1];
    const first = [tail[0], tail[1] + dy * .55];
    const second = [tip[0] - dx * .32, tip[1] - dy * .24];
    const length = Math.hypot(tip[0] - second[0], tip[1] - second[1]) || 1;
    const back = [(second[0] - tip[0]) / length, (second[1] - tip[1]) / length];
    const wing = side => [tip[0] + back[0] * 8 - back[1] * side * 4, tip[1] + back[1] * 8 + back[0] * side * 4];
    return `M${tail} C${first} ${second} ${tip} M${wing(-1)} L${tip} L${wing(1)}`;
  }
  window.AXDCuePath = cuePath;
  document.querySelectorAll('[data-curve-cue] path').forEach(path => {
    path.setAttribute('d', cuePath([64, 6], [12, 62]));
  });
})();
