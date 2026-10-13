// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr and the local fixture server.
//
// A checkbox, a radio and a switch of one size stand in a form beside a text
// field of that size. Each mark is as tall as the field's text line, sits on
// the centre of its label's first line, and is followed by its label at one
// step for all three; a description starts where the label starts. Tolerance
// is zero pixels, at a desktop and a mobile width.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/choice-composition-lab.html';
  const failures = [];
  let measured = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-size]')].map((col) => {
      const size = col.dataset.size;
      const line = parseFloat(getComputedStyle(col.querySelector('.sf-input input')).lineHeight);
      return [...col.querySelectorAll('[data-lab]')].filter((el) => !el.dataset.lab.startsWith('input')).map((el) => {
        const mark = el.querySelector('.sf-checkbox-box, .sf-radio-button-box, .sf-switch-toggler').getBoundingClientRect();
        const label = el.querySelector('.sf-checkbox-label, .sf-radio-button-text, .sf-switch-text');
        const lr = label.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(label.firstChild);
        const text = [...range.getClientRects()][0];
        const desc = el.querySelector('.sf-checkbox-description, .sf-radio-button-description, .sf-switch-description').getBoundingClientRect();
        return {
          lab: el.dataset.lab, size, line,
          mark: Math.round(mark.height),
          centre: Math.round((lr.top + parseFloat(getComputedStyle(label).lineHeight) / 2) - (mark.top + mark.height / 2)),
          step: Math.round(text.left - mark.right),
          description: Math.round(desc.left - lr.left),
        };
      });
    }).flat());
    measured += rows.length;
    for (const size of ['1/2', '1', '2']) {
      const list = rows.filter((r) => r.size === size);
      const where = `${width}px size ${size}`;
      for (const r of list) {
        if (r.mark !== r.line) failures.push(`${where} ${r.lab}: mark ${r.mark}, text line ${r.line}`);
        if (r.centre !== 0) failures.push(`${where} ${r.lab}: mark ${r.centre}px off its label's first line`);
        if (r.description !== 0) failures.push(`${where} ${r.lab}: description ${r.description}px off the label`);
      }
      const steps = [...new Set(list.map((r) => r.step))];
      if (steps.length > 1) failures.push(`${where}: label steps differ — ${list.map((r) => `${r.lab}=${r.step}`).join(', ')}`);
    }
  }
  return { measured, failures };
}
