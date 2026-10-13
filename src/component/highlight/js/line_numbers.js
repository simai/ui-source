export function initLineNumbers(engine) {
  function lineNumbersBlock(element) {
    if (!element || element.querySelector(':scope > .sf-code-lines')) return;
    const lines = element.innerHTML.split(/\r?\n/);
    // data-start: the number of the first line, for an excerpt of a longer file.
    const start = Number.parseInt(element.dataset.start ?? element.closest?.('[data-start]')?.dataset.start ?? '1', 10);
    const first = Number.isFinite(start) ? start : 1;
    const table = element.ownerDocument.createElement('span');
    table.className = 'sf-code-lines';
    table.setAttribute('role', 'presentation');
    lines.forEach((line, index) => {
      const row = element.ownerDocument.createElement('span');
      row.className = 'sf-code-line';
      const number = element.ownerDocument.createElement('span');
      number.className = 'sf-code-line__number';
      number.textContent = String(first + index);
      number.setAttribute('aria-hidden', 'true');
      const code = element.ownerDocument.createElement('span');
      code.className = 'sf-code-line__content';
      code.innerHTML = line || ' ';
      row.append(number, code);
      table.append(row);
    });
    element.replaceChildren(table);
  }
  engine.lineNumbersBlock = lineNumbersBlock;
  engine.lineNumbersBlockSync = lineNumbersBlock;
  engine.initLineNumbersOnLoad = () => {};
  return engine;
}
