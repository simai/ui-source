// The block's rows: one row per line, with the parts a line can carry --
// its number (data-lines, C254), a diff sign (C255), a prompt in a terminal
// (C257) -- and the marks the stylesheet draws (a marked or focused line,
// C256). The highlighter's colours are written into each row's content.

// The coloured HTML split at its line breaks. A token that spans lines (a
// block comment, a template string) is one <span> across them: split as it
// was, its first row lost the closing tag and the next its opening one, so
// the rest of the token lost its colour. Each row closes what is still open
// at its end and the next opens it again.
function splitLines(html) {
  const rows = [];
  const open = [];
  let row = '';
  const tag = /<(\/?)span\b[^>]*>|\r?\n/g;
  let cursor = 0;
  for (const match of html.matchAll(tag)) {
    row += html.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    if (match[0].startsWith('<')) {
      if (match[1]) open.pop(); else open.push(match[0]);
      row += match[0];
    } else {
      rows.push(row + '</span>'.repeat(open.length));
      row = open.join('');
    }
  }
  rows.push(row + html.slice(cursor));
  return rows;
}

export function initLineNumbers(engine) {
  // options.numbers: draw the number column; options.lines: one entry per
  // line, {diff: 'add'|'remove'|'', mark, focus, prompt, output, skip};
  // options.words: the words read aloud before a changed line.
  function lineNumbersBlock(element, options = {}) {
    if (!element || element.querySelector(':scope > .sf-code-lines')) return;
    const doc = element.ownerDocument;
    const lines = splitLines(element.innerHTML);
    const numbers = options.numbers !== false;
    const marks = Array.isArray(options.lines) ? options.lines : [];
    const diff = marks.some((line) => line?.diff);
    // data-start: the number of the first line, for an excerpt of a longer file.
    const start = Number.parseInt(element.dataset.start ?? element.closest?.('[data-start]')?.dataset.start ?? '1', 10);
    const first = Number.isFinite(start) ? start : 1;
    const table = doc.createElement('span');
    table.className = 'sf-code-lines';
    table.setAttribute('role', 'presentation');
    if (diff) table.dataset.diff = 'true';
    lines.forEach((line, index) => {
      const mark = marks[index] || {};
      const row = doc.createElement('span');
      row.className = 'sf-code-line';
      if (mark.diff) row.dataset.lineDiff = mark.diff;
      if (mark.mark) row.dataset.lineMark = '';
      if (mark.focus) row.dataset.lineFocus = '';
      if (mark.prompt) row.dataset.linePrompt = '';
      if (mark.output) row.dataset.lineOutput = '';
      // What copy leaves behind (core readCopyText): a removed line, and the
      // output of a terminal (C255, C257).
      if (mark.skip) row.dataset.copy = 'false';
      if (numbers) {
        const number = doc.createElement('span');
        number.className = 'sf-code-line__number';
        number.textContent = String(first + index);
        number.setAttribute('aria-hidden', 'true');
        row.append(number);
      }
      if (diff) {
        // The sign is the stylesheet's (::before), so it is neither copied
        // nor selected; a screen reader hears the word instead.
        const sign = doc.createElement('span');
        sign.className = 'sf-code-line__sign';
        sign.setAttribute('aria-hidden', 'true');
        row.append(sign);
        if (mark.diff) {
          const state = doc.createElement('span');
          state.className = 'sf-code-line__state';
          state.textContent = `${options.words?.[mark.diff] || mark.diff}: `;
          row.append(state);
        }
      }
      if (mark.prompt) {
        const prompt = doc.createElement('span');
        prompt.className = 'sf-code-line__prompt';
        prompt.setAttribute('aria-hidden', 'true');
        row.append(prompt);
      }
      const code = doc.createElement('span');
      code.className = 'sf-code-line__content';
      code.innerHTML = line || ' ';
      row.append(code);
      table.append(row);
    });
    element.replaceChildren(table);
  }
  engine.lineNumbersBlock = lineNumbersBlock;
  engine.lineNumbersBlockSync = lineNumbersBlock;
  engine.initLineNumbersOnLoad = () => {};
  return engine;
}

export { splitLines };
