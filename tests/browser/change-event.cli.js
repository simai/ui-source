// Run with playwright-cli run-code using this file's contents as the argument.
// Requires the published Core runtime in ../ui/distr, the published Smart
// runtime in ../ui-smart and the local fixture server.
//
// Every form value control reports a committed change as `change` on its host,
// exactly once per change the user makes, and the older names it still emits
// carry the same change once. A value set from code is not a change for a
// range slider, as for a native control.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/change-event-lab.html';
  const failures = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const steps = [
    ['dropdown select', { 'dd:change': 1, 'dd:sf-dropdown:change': 1 }, async () => { await page.locator('#dd .sf-dropdown-field').click(); await page.waitForTimeout(200); await page.locator('#dd [role=option]').nth(1).click(); }],
    ['datepicker pick day', { 'dp:change': 1, 'dp:sf-datepicker-change': 1, 'dp:sf-change': 1 }, async () => { await page.locator('#dp .sf-input-field').click(); await page.waitForTimeout(300); await page.locator('.sf-datepicker-day:not([disabled])').nth(10).click(); }],
    ['button-group click', { 'bg:change': 1, 'bg:sf-button-group-change': 1 }, async () => { await page.locator('#bg button').nth(1).click(); }],
    ['tag kind=checkbox', { 'tg:change': 1 }, async () => { await page.locator('#tg .sf-tag').click(); }],
    ['tag type=checkbox', { 'tg2:change': 1 }, async () => { await page.locator('#tg2 .sf-tag').click(); }],
    ['radio check', { 'rd:change': 1, 'rd:input': 1 }, async () => { await page.locator('#rd input').check({ force: true }); }],
    ['range key', { 'rs:change': 1, 'rs:sf-range-slider-change': 1 }, async () => { const handle = page.locator('#rs [role=slider]').first(); await handle.focus(); await handle.press('ArrowRight'); }],
    ['toggle click', { 'tq:change': 1, 'tq:input': 1 }, async () => { await page.locator('#tq input').check({ force: true }); }],
    ['country type', { 'cc:change': 1, 'cc:input': 1 }, async () => { const input = page.locator('#cc input[type=tel]'); await input.fill('9031234567'); await input.press('Tab'); }],
    ['range set from code', { 'rs:sf-range-slider-change': 1 }, async () => { await page.evaluate(() => document.getElementById('rs').setAttribute('value', '7')); }],
    ['button-group select()', { 'bg:change': 1, 'bg:sf-button-group-change': 1 }, async () => { await page.evaluate(() => document.getElementById('bg').select('a')); }],
  ];
  for (const [name, expected, act] of steps) {
    await page.evaluate(() => { window.__ev = {}; });
    try { await act(); } catch (error) { failures.push(`${name}: action failed — ${error.message.split('\n')[0]}`); continue; }
    await page.waitForTimeout(300);
    const seen = await page.evaluate(() => window.__ev);
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(seen)])].sort();
    for (const key of keys) {
      if ((seen[key] || 0) !== (expected[key] || 0)) failures.push(`${name}: ${key} ${seen[key] || 0}, expected ${expected[key] || 0}`);
    }
  }
  if (errors.length) failures.push(`page errors: ${errors.slice(0, 3).join(' | ')}`);
  return { measured: steps.length, failures };
}
