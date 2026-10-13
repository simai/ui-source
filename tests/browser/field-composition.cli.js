// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr and the local fixture server.
//
// Form fields stand in one column of a form. For each look and size, at a
// desktop and a mobile width, every field must have the same height, stand at
// the same distance under its label, start its text on one axis, and draw a
// picture at the same size and place, with its label after it on one axis.
// The phone's country list must match its field like a dropdown list does.
// Tolerance is zero pixels.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/field-composition-lab.html';
  const failures = [];
  let measured = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Every stylesheet and the component scripts that bind the fields have to
    // be in before anything is measured: a cold first load measured some
    // fields unstyled.
    await page.goto(base, { waitUntil: 'networkidle' });
    if (width < 600) await page.addStyleTag({ content: '.row{grid-template-columns:1fr!important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-lab]')].map((el) => {
      const field = el.querySelector('.sf-input-field, .sf-textarea-field, .sf-country-code-field, .sf-dropdown-field');
      const fr = field.getBoundingClientRect();
      const x = (v) => Math.round(v - fr.left);
      const control = field.querySelector('input:not([type=hidden]), textarea');
      const cs = getComputedStyle(control);
      const own = control.tagName === 'TEXTAREA' ? parseFloat(cs.borderInlineStartWidth) : 0;
      const picture = field.querySelector(':scope > .sf-icon, :scope > .sf-input-left .sf-icon, .sf-dropdown-field-visual, .sf-country-code-flag-icon');
      const pr = picture && picture.getBoundingClientRect();
      const label = el.querySelector('.sf-input-text, .sf-textarea-text, .sf-country-code-text, .sf-dropdown-text');
      return {
        lab: el.dataset.lab,
        height: Math.round(fr.height),
        under: Math.round(fr.top - label.getBoundingClientRect().bottom),
        text: x(control.getBoundingClientRect().left + own + parseFloat(cs.paddingInlineStart)),
        picture: pr ? `${Math.round(pr.width)}x${Math.round(pr.height)}@${x(pr.left)}` : null,
        kind: picture ? (picture.classList.contains('sf-country-code-flag-icon') ? 'flag' : 'icon') : 'none',
      };
    }));
    measured += rows.length;
    for (const size of ['1/2', '1', '2']) {
      const trigger = page.locator(`[data-lab="phone ${size}"] .sf-country-code-left`);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await page.waitForTimeout(400);
      const list = await page.evaluate(async (size) => {
        const root = document.querySelector(`[data-lab="phone ${size}"]`);
        const field = root.querySelector('.sf-country-code-field');
        const fr = field.getBoundingClientRect();
        const item = root.querySelector('.sf-country-code-item');
        const box = (e) => { const b = e.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.left - fr.left)}`; };
        const result = item && item.getBoundingClientRect().height
          ? { field: Math.round(fr.height), row: Math.round(item.getBoundingClientRect().height), flags: [box(field.querySelector('.sf-country-code-flag-icon')), box(item.querySelector('.sf-country-code-flag'))] }
          : null;
        return result;
      }, size);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      measured += 1;
      const where = `${width}px phone ${size}`;
      if (!list) { failures.push(`${where}: the country list did not open`); continue; }
      if (list.row !== list.field) failures.push(`${where}: country row ${list.row} against field ${list.field}`);
      if (list.flags[0] !== list.flags[1]) failures.push(`${where}: flag ${list.flags[0]} in the field, ${list.flags[1]} in the list`);
    }
    const groups = {};
    for (const r of rows) {
      const parts = r.lab.split(' ');
      const size = parts[parts.length - 1];
      const look = r.lab.startsWith('phone') ? 'bordered' : parts[parts.length - 2];
      (groups[`${look} ${size}`] ||= []).push(r);
    }
    for (const [key, list] of Object.entries(groups)) {
      const where = `${width}px ${key}`;
      const same = (name, pick, filter = () => true) => {
        const values = list.filter(filter).map((r) => [r.lab, pick(r)]);
        const distinct = [...new Set(values.map(([, v]) => v))];
        if (distinct.length > 1) failures.push(`${where}: ${name} differs — ${values.map(([l, v]) => `${l}=${v}`).join(', ')}`);
      };
      same('height', (r) => r.height);
      same('distance under the label', (r) => r.under);
      same('text start without a picture', (r) => r.text, (r) => r.kind === 'none');
      same('icon box', (r) => r.picture, (r) => r.kind === 'icon');
      same('text start after an icon', (r) => r.text, (r) => r.kind === 'icon');
    }
  }
  return { measured, failures };
}
