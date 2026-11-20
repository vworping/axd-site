(() => {
  'use strict';
  // Accept common pasted step labels, without mistaking quantities like 1.5 cups for steps.
  const step = /^(?:(\d{1,3})[.)]|\((\d{1,3})\)|step\s+(\d{1,3})\s*[:.)-])\s+(.+)$/i;
  window.AXDKitchenText = (text, defaultList = null) => {
    const blocks = [];
    let current = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { current = null; continue; }
      const numbered = step.exec(line);
      if (numbered || defaultList) {
        const type = numbered ? 'ol' : defaultList;
        if (current?.type !== type) {
          current = { type, items: [] };
          blocks.push(current);
        }
        const number = numbered ? Number(numbered[1] || numbered[2] || numbered[3]) : (current.items.at(-1)?.number ?? 0) + 1;
        current.items.push({ number, text: numbered ? numbered[4] : line.replace(/^[-•]\s+/, '') });
      } else if (current?.type === 'ol') {
        current.items.at(-1).text += '\n' + line;
      } else if (current?.type === 'p') {
        current.text += '\n' + line;
      } else {
        current = { type: 'p', text: line };
        blocks.push(current);
      }
    }
    return blocks;
  };
})();
