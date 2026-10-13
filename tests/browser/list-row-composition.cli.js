// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr, the published Smart
// runtime in ../ui-smart and the local fixture server.
//
// A list row of one size stands as tall as a control of that size, divider
// included: the bottom padding gives the border back. Its content sits on the
// centre of the row, the divider counted in the bottom space. Text, checkbox
// and icon rows, standalone and in a list, at sizes 1/2, 1 and 2. Tolerance
// is zero pixels, at a desktop and a mobile width.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/list-row-composition-lab.html';
  const failures = [];
  let measured = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-size]')].flatMap((group) => {
      const size = group.dataset.size;
      const control = document.querySelector(`[data-height="${size}"]`).getBoundingClientRect().height;
      return [...group.querySelectorAll('.sf-list-item')].map((row) => {
        const box = row.getBoundingClientRect();
        const wrap = row.querySelector('.sf-list-item-wrap').getBoundingClientRect();
        return {
          size, control, label: row.textContent.trim(),
          height: box.height,
          above: wrap.top - box.top,
          below: box.bottom - wrap.bottom,
        };
      });
    }));
    measured += rows.length;
    for (const row of rows) {
      const where = `${width}px ${row.label}`;
      if (row.height !== row.control) failures.push(`${where}: row ${row.height}, control height ${row.control}`);
      if (row.above !== row.below) failures.push(`${where}: content ${row.above} from the top, ${row.below} from the bottom`);
    }
  }
  return { measured, failures };
}
