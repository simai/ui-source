// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr and the local fixture server.
//
// The field and its open list are one composition. For every option kind, form
// size and look, at a desktop and a mobile width, this measures the field and
// the selected option and fails on any difference: picture box and position,
// where the label starts, where the chevron and the check sit, and the row
// height against the field height. Tolerance is zero pixels.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-alignment-lab.html';
  const failures = [];
  let measured = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Every stylesheet and the component scripts that bind the fields have to
    // be in before anything is measured: a cold first load measured some
    // fields unstyled.
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const labels = await page.evaluate(() => [...document.querySelectorAll('[data-lab]')].map((d) => d.dataset.lab));
    for (const label of labels) {
      const r = await page.evaluate(async (label) => {
        const dd = document.querySelector(`[data-lab="${label}"]`);
        const field = dd.querySelector('.sf-dropdown-field');
        field.scrollIntoView({ block: 'center' });
        field.click();
        await new Promise((done) => setTimeout(done, 250));
        const fr = field.getBoundingClientRect();
        const list = [...document.querySelectorAll('.sf-list')].find((l) => {
          const lr = l.getBoundingClientRect();
          return lr.width > 0 && (Math.abs(lr.top - fr.bottom) < 12 || Math.abs(lr.bottom - fr.top) < 12) && Math.abs(lr.left - fr.left) < 40;
        });
        if (!list) { field.click(); return { label, error: 'list did not open beside its field' }; }
        const option = list.querySelector('.sf-list-item.selected');
        const or = option.getBoundingClientRect();
        const x = (v) => Math.round(v - fr.left);
        const fromEnd = (v) => Math.round(fr.right - v);
        const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}@${x(b.left)}`; };
        const centre = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return `${Math.round(b.width)}@${fromEnd(b.left + b.width / 2)}`; };
        const firstText = (root) => {
          const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let t = walk.nextNode(); t; t = walk.nextNode()) {
            if (!t.textContent.trim() || t.parentElement.closest('.sf-icon, .sf-avatar, button')) continue;
            const range = document.createRange(); range.selectNodeContents(t);
            return x(range.getBoundingClientRect().left);
          }
          return null;
        };
        const input = field.querySelector('input:not([type=hidden])');
        const PICTURE = ':is(.sf-icon, .sf-flag, .sf-avatar, .sf-tag-color-icon)';
        const result = {
          label,
          field: Math.round(fr.height),
          row: Math.round(or.height),
          picture: [box(field.querySelector('.sf-dropdown-field-visual')), box(option.querySelector(`.sf-list-item-wrap ${PICTURE}`))],
          text: [x(input.getBoundingClientRect().left + parseFloat(getComputedStyle(input).paddingInlineStart)), firstText(option.querySelector('.sf-list-item-wrap'))],
          end: [centre(field.querySelector('button .sf-icon')), centre(option.querySelector('.sf-list-item-selected-item .sf-icon'))],
          picked: option.textContent.trim() !== '',
        };
        field.click();
        await new Promise((done) => setTimeout(done, 120));
        return result;
      }, label);
      measured += 1;
      const where = `${width}px ${label}`;
      if (r.error) { failures.push(`${where}: ${r.error}`); continue; }
      if (r.row !== r.field) failures.push(`${where}: option row ${r.row} against field ${r.field}`);
      // A checkbox list shows its ticks only in the list; the field carries text alone.
      if (!label.includes('checkbox')) {
        if (r.picture[0] !== r.picture[1]) failures.push(`${where}: picture ${r.picture[0]} in the field, ${r.picture[1]} in the list`);
        if (r.text[0] !== r.text[1]) failures.push(`${where}: label starts at ${r.text[0]} in the field, ${r.text[1]} in the list`);
      }
      if (r.end[1] && r.end[0] !== r.end[1]) failures.push(`${where}: chevron ${r.end[0]}, check ${r.end[1]}`);
    }
  }
  return { measured, failures };
}
