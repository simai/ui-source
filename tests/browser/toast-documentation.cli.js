/* global document */
// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  await page.setViewportSize({width: 1440, height: 1000});
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce', colorScheme: 'light'});
  await page.goto('http://127.0.0.1:8892/ru/components/toast/', {waitUntil: 'networkidle'});

  const examples = page.locator('main [data-docara-example]');
  check('documentation renders four executable examples', await examples.count() === 4);
  check('safe Framework-only examples resolve inline in auto mode', await examples.evaluateAll(nodes => nodes.every(node => node.dataset.docaraExamplePreviewRequested === 'auto' && node.dataset.docaraExamplePreviewResolved === 'inline')));
  check('Toast examples create no iframe boundary', await examples.locator('iframe').count() === 0);

  const preview = index => examples.nth(index).locator('[data-docara-example-inline-preview]');
  check('basic example has one explicitly named native close action', await preview(0).evaluate(root => {
    const close = root.querySelector('button[data-close]');
    return close?.type === 'button' && Boolean(close.getAttribute('aria-label'));
  }));
  check('semantic example covers all five supported types', await preview(1).evaluate(root => ['default', 'primary', 'success', 'warning', 'error'].every(type => Boolean(root.querySelector(`.sf-toast--${type}`)))));
  check('every example icon is decorative', await examples.evaluateAll(nodes => nodes.flatMap(node => [...node.querySelectorAll('[data-docara-example-inline-preview] .sf-icon')]).every(icon => icon.getAttribute('aria-hidden') === 'true')));
  check('lifetime example distinguishes persistent and explicit timed messages', await preview(2).evaluate(root => root.querySelectorAll('.sf-toast').length === 2 && root.querySelectorAll('[data-duration="6000"]').length === 1));
  check('static examples do not falsely announce live regions', await examples.locator('[data-docara-example-inline-preview] [role="status"], [data-docara-example-inline-preview] [role="alert"]').count() === 0);
  check('action example exposes one optional action and one named close action', await preview(3).evaluate(root => root.querySelectorAll('button[data-action="undo"]').length === 1 && Boolean(root.querySelector('button[data-close][aria-label]'))));
  check('compact actions do not use the large-surface radius utility', await examples.locator('[data-docara-example-inline-preview] .radius-default').count() === 0);

  const initialHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'HTML'}).click();
  const sourceHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'Результат'}).click();
  const restoredHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  check('example tabs follow intrinsic active-panel height', initialHeight > 0 && sourceHeight > initialHeight && Math.abs(restoredHeight - initialHeight) < 2, {initialHeight, sourceHeight, restoredHeight});

  await page.evaluate(() => { document.documentElement.classList.remove('theme-light'); document.documentElement.classList.add('theme-dark'); });
  await page.setViewportSize({width: 390, height: 844});
  check('documentation and examples fit the mobile viewport', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  return {results, errors};
}
