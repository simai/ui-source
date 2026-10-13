// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr and the local fixture server.
//
// Lists in a panel share one geometry: a context menu's items and a dropdown's
// options of the same size have the same row height, start their content and
// their label on the same axes and draw a picture at the same size and place,
// measured from the panel's outer edge at both ends. A navigation menu row is a
// size 1 control. Tolerance is zero pixels, at a desktop and a mobile width.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/panel-composition-lab.html';
  const failures = [];
  let measured = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle' });
    if (width < 600) await page.addStyleTag({ content: '.row{grid-template-columns:1fr!important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-lab]')].map((el) => {
      const panel = el.querySelector('.sf-context-menu-content, .sf-list, .sf-menu');
      const pr = panel.getBoundingClientRect();
      const row = el.querySelector('.sf-button, .sf-list-item, .sf-menu-element');
      const rr = row.getBoundingClientRect();
      const icon = row.querySelector('.sf-icon');
      const ir = icon && icon.getBoundingClientRect();
      let text = null;
      const walk = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (!t.textContent.trim() || t.parentElement.closest('.sf-icon')) continue;
        const range = document.createRange(); range.selectNodeContents(t);
        text = Math.round(range.getBoundingClientRect().left - pr.left);
        break;
      }
      const cs = getComputedStyle(row);
      return {
        lab: el.dataset.lab,
        row: Math.round(rr.height),
        start: Math.round(rr.left - pr.left + parseFloat(cs.paddingInlineStart)),
        end: Math.round(pr.right - rr.right + parseFloat(cs.paddingInlineEnd)),
        icon: ir ? `${Math.round(ir.width)}x${Math.round(ir.height)}@${Math.round(ir.left - pr.left)}` : null,
        text,
      };
    }));
    measured += rows.length;
    // Every item in a menu starts its label on one axis, short or long.
    const ragged = await page.evaluate(() => [...document.querySelectorAll('[data-lab^="context"]')].map((el) => {
      const panel = el.querySelector('.sf-context-menu-content').getBoundingClientRect();
      const starts = [...el.querySelectorAll('.sf-button-text-container')].map((t) => {
        const range = document.createRange(); range.selectNodeContents(t);
        return Math.round(range.getBoundingClientRect().left - panel.left);
      });
      return [el.dataset.lab, starts];
    }).filter(([, starts]) => new Set(starts).size > 1));
    for (const [lab, starts] of ragged) failures.push(`${width}px ${lab}: item labels start at ${starts.join(', ')}`);
    const by = Object.fromEntries(rows.map((r) => [r.lab, r]));
    for (const size of ['1/2', '1', '2']) {
      for (const kind of ['text', 'icon']) {
        const a = by[`context ${kind} ${size}`], b = by[`list ${kind} ${size}`];
        const where = `${width}px ${kind} ${size}`;
        for (const key of ['row', 'start', 'end', 'icon', 'text']) {
          if (a[key] !== b[key]) failures.push(`${where}: ${key} ${a[key]} in the context menu, ${b[key]} in the list`);
        }
      }
    }
    const menu = by['menu text 1'];
    const control = width < 600 ? 36 : 40;
    if (menu.row !== control) failures.push(`${width}px menu: row ${menu.row}, a size 1 control is ${control}`);
  }
  return { measured, failures };
}
