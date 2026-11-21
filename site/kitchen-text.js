(() => {
  'use strict';
  // Accept common pasted step labels, without mistaking quantities like 1.5 cups for steps.
  const step = /^(?:(\d{1,3})[.)]|\((\d{1,3})\)|step\s+(\d{1,3})\s*[:.)-])\s+(.+)$/i;
  window.AXDKitchenText = (text, defaultList = null) => {
    const blocks = [];
    let current = null, blankLines = 0, nextNumber = 1;
    const start = block => {
      if (blankLines && blocks.length) block.blankLines = blankLines;
      blankLines = 0;
      blocks.push(block);
      return block;
    };
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { current = null; blankLines++; continue; }
      const numbered = step.exec(line);
      if (numbered || defaultList) {
        const type = numbered ? 'ol' : defaultList;
        if (current?.type !== type) {
          current = start({ type, items: [] });
        }
        const number = numbered ? Number(numbered[1] || numbered[2] || numbered[3]) : nextNumber;
        nextNumber = number + 1;
        current.items.push({ number, text: numbered ? numbered[4] : line.replace(/^[-•]\s+/, '') });
      } else if (current?.type === 'ol') {
        current.items.at(-1).text += '\n' + line;
      } else if (current?.type === 'p') {
        current.text += '\n' + line;
      } else {
        current = start({ type: 'p', text: line });
      }
    }
    return blocks;
  };
})();
