// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr and the local fixture server.
//
// A button and an icon button of every appearance, and a tag, of one size stand
// in a row beside a text field of that size. All are as tall as the field (a
// bordered appearance keeps its border inside the height); a picture is the
// field's text line high; a label follows a picture at one step in a button
// and in a tag; a text-only label is centred; a tag's remove mark is drawn and
// offers a 24px target. Tolerance is zero pixels, at a desktop and a mobile
// width.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/action-composition-lab.html';
  const failures = [];
  let measured = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.row[data-size]')].map((row) => {
      const size = row.dataset.size;
      // Sizes 1/3 and 3 have no form field; the text button of the size is the
      // reference there, and the field must agree with it where it exists.
      const button = row.querySelector('[data-lab^="button text"]');
      const reference = button.getBoundingClientRect().height;
      const line = parseFloat(getComputedStyle(button.querySelector('.sf-button-text-container')).lineHeight);
      const input = row.querySelector('.sf-input-field');
      const field = input ? input.getBoundingClientRect() : { height: reference };
      const items = [...row.querySelectorAll('[data-lab]')].filter((el) => !el.dataset.lab.startsWith('input')).map((el) => {
        const r = el.getBoundingClientRect();
        const pic = el.querySelector(':scope > .sf-icon, :scope > .sf-tag-color-icon');
        const label = el.querySelector('.sf-button-text-container, .sf-tag-container');
        let text = null;
        if (label) { const range = document.createRange(); range.selectNodeContents(label); text = range.getBoundingClientRect(); }
        const close = el.querySelector(':scope > .sf-icon-button--close');
        const mark = close && close.querySelector('.sf-close-icon').getBoundingClientRect();
        const target = close && getComputedStyle(close, '::after');
        return {
          lab: el.dataset.lab,
          height: Math.round(r.height),
          picture: pic ? Math.round(pic.getBoundingClientRect().height) : null,
          step: pic && text && pic.getBoundingClientRect().right <= text.left ? Math.round(text.left - pic.getBoundingClientRect().right) : null,
          centred: text && !pic && !close && !el.querySelector('.sf-tag-count') ? Math.round((text.left - r.left) - (r.right - text.right)) : null,
          mark: mark ? Math.round(mark.width) : null,
          target: close ? [close.getBoundingClientRect().width - 2 * parseFloat(target.left), close.getBoundingClientRect().height - 2 * parseFloat(target.top)].map(Math.round) : null,
        };
      });
      if (Math.round(field.height) !== Math.round(reference)) items.push({ lab: 'field', height: Math.round(field.height), picture: null, step: null, centred: null, mark: null, target: null });
      return { size, field: Math.round(reference), line, items };
    }));
    for (const { size, field, line, items } of rows) {
      measured += items.length;
      const where = `${width}px size ${size}`;
      const steps = new Set();
      for (const i of items) {
        // An element on a text line (a badge or a scale in a table cell) is the
        // line high, not the control high.
        const expected = i.lab.startsWith('line ') ? line : field;
        if (i.height !== expected) failures.push(`${where} ${i.lab}: height ${i.height}, expected ${expected}`);
        if (i.picture !== null && i.picture !== line) failures.push(`${where} ${i.lab}: picture ${i.picture}, text line ${line}`);
        if (i.step !== null) steps.add(i.step);
        if (i.centred !== null && Math.abs(i.centred) > 1) failures.push(`${where} ${i.lab}: label ${i.centred}px off centre`);
        if (i.mark === 0) failures.push(`${where} ${i.lab}: remove mark not drawn`);
        if (i.target && (i.target[0] < 24 || i.target[1] < 24)) failures.push(`${where} ${i.lab}: remove target ${i.target.join('x')}`);
      }
      if (steps.size > 1) failures.push(`${where}: picture-to-label steps differ — ${[...steps].join(', ')}`);
    }
  }
  return { measured, failures };
}
