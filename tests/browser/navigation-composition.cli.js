// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr and the local fixture server.
//
// Tabs and pagination are rows of size 1 controls. Every tab of every variant
// is a size 1 control, its indicator inside that height; a page number is as
// tall as the arrows beside it and shares their centre. Tolerance is zero
// pixels, at a desktop and a mobile width.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/navigation-composition-lab.html';
  const failures = [];
  let measured = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const control = width < 600 ? 36 : 40;
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-lab]')].map((section) => ({
      lab: section.dataset.lab,
      items: [...section.querySelectorAll('.sf-tabs-top > *, .sf-page-number, .sf-pagination-direction')].map((el) => {
        const r = el.getBoundingClientRect();
        return { kind: el.className.split(' ')[0], height: Math.round(r.height), centre: Math.round(r.top + r.height / 2) };
      }),
    })));
    for (const { lab, items } of rows) {
      measured += items.length;
      for (const i of items) {
        if (i.height !== control) failures.push(`${width}px ${lab} ${i.kind}: ${i.height}, a size 1 control is ${control}`);
      }
      const centres = new Set(items.map((i) => i.centre));
      if (centres.size > 1) failures.push(`${width}px ${lab}: centres differ — ${[...centres].join(', ')}`);
    }
  }
  return { measured, failures };
}
