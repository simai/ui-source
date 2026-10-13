/* global document, getComputedStyle */
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
  await page.goto('http://127.0.0.1:8892/ru/components/alerts/', {waitUntil: 'networkidle'});

  const examples = page.locator('main [data-docara-example]');
  check('documentation renders four executable examples', await examples.count() === 4);
  check('safe Framework-only examples resolve inline in auto mode', await examples.evaluateAll(nodes => nodes.every(node => node.dataset.docaraExamplePreviewRequested === 'auto' && node.dataset.docaraExamplePreviewResolved === 'inline')));
  check('Alert examples create no iframe boundary', await examples.locator('iframe').count() === 0);

  const preview = index => examples.nth(index).locator('[data-docara-example-inline-preview]');
  check('overview covers all five semantic roles', await preview(1).evaluate(root => ['clear', 'info', 'warning', 'danger', 'success'].every(type => Boolean(root.querySelector(`.sf-alert--${type}`)))));
  check('all example glyphs are decorative', await examples.evaluateAll(nodes => nodes.flatMap(node => [...node.querySelectorAll('[data-docara-example-inline-preview] .sf-icon')]).every(icon => icon.getAttribute('aria-hidden') === 'true')));
  check('appearance example covers the three source-supported surfaces', await preview(2).evaluate(root => ['default', 'outlined', 'flat'].every(variant => Boolean(root.querySelector(`.sf-alert--${variant}`)))));
  check('action example uses native named controls and canonical short hooks', await preview(3).evaluate(root => {
    const actions = [...root.querySelectorAll('button[data-action]')];
    const close = root.querySelector('button[data-close]');
    return actions.length === 2
      && actions.every(button => button.type === 'button' && button.textContent.trim().length > 0)
      && close?.type === 'button'
      && Boolean(close.getAttribute('aria-label'));
  }));
  check('compact actions do not use the large-surface radius utility', await preview(3).locator('.radius-default').count() === 0);

  const initialHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'HTML'}).click();
  const sourceHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'Результат'}).click();
  const restoredHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  check('example tabs follow intrinsic active-panel height', initialHeight > 0 && sourceHeight > initialHeight && Math.abs(restoredHeight - initialHeight) < 2, {initialHeight, sourceHeight, restoredHeight});

  await page.evaluate(() => { document.documentElement.classList.remove('theme-light'); document.documentElement.classList.add('theme-dark'); });
  check('dark theme keeps every alert title readable', await examples.evaluateAll(nodes => nodes.flatMap(node => [...node.querySelectorAll('[data-docara-example-inline-preview] .sf-alert-text')]).every(title => {
    const style = getComputedStyle(title);
    return style.color !== style.backgroundColor && style.visibility !== 'hidden';
  })));

  await page.setViewportSize({width: 390, height: 844});
  check('documentation and examples fit the mobile viewport', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
