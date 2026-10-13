// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });

  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('http://127.0.0.1:8890/ru/components/context-menu/', {waitUntil: 'networkidle'});
  const examples = page.locator('main [data-docara-example]');
  check('documentation renders three executable examples', await examples.count() === 3);
  check('Framework-only examples resolve inline', await examples.evaluateAll(nodes => nodes.every(node => node.dataset.docaraExamplePreviewResolved === 'inline')));
  check('ordinary component page has no iframe boundary', await examples.locator('iframe').count() === 0);

  const overview = examples.nth(0).locator('[data-docara-example-inline-preview]');
  const positions = examples.nth(1).locator('[data-docara-example-inline-preview]');
  check('static overview does not claim composite menu semantics', await overview.locator('[role="menu"], [role="menuitem"]').count() === 0);
  check('every ordinary surface keeps the required relative wrapper', await examples.evaluateAll(nodes => [...nodes].every(node => [...node.querySelectorAll('.sf-context-menu')].every(menu => menu.firstElementChild?.classList.contains('relative')))));
  check('position example covers all twelve preferred logical positions', await positions.locator('.sf-context-menu[class*="sf-context-menu--position-"]').count() === 12);
  check('no example draws a visible tail', await examples.evaluateAll(nodes => [...nodes].every(node => [...node.querySelectorAll('.sf-context-menu-tooltip')].every(tail => getComputedStyle(tail).display === 'none' && tail.getClientRects().length === 0))));

  const initialHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'HTML'}).click();
  const sourceHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'Результат'}).click();
  const restoredHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  check('example tabs use intrinsic active-panel height', initialHeight > 0 && sourceHeight > initialHeight && Math.abs(restoredHeight - initialHeight) < 2, {initialHeight, sourceHeight, restoredHeight});

  await page.setViewportSize({width: 390, height: 844});
  check('documentation fits a mobile viewport', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
