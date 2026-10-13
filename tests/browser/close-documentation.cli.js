// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });

  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('http://127.0.0.1:8889/ru/components/close/', {waitUntil: 'networkidle'});
  const examples = page.locator('main [data-docara-example]');
  check('documentation renders exactly three examples', await examples.count() === 3);
  check('safe Framework-only examples resolve inline in auto mode', await examples.evaluateAll(nodes => nodes.every(node => node.dataset.docaraExamplePreviewRequested === 'auto' && node.dataset.docaraExamplePreviewResolved === 'inline')));
  check('inline mode creates no iframe boundary', await examples.locator('iframe').count() === 0);

  const overview = examples.nth(0).locator('[data-docara-example-inline-preview]');
  const actionSizes = examples.nth(1).locator('[data-docara-example-inline-preview]');
  const glyphSizes = examples.nth(2).locator('[data-docara-example-inline-preview]');
  check('overview contains one named native close action', await overview.evaluate(root => {
    const button = root.querySelector('button.sf-icon-button.sf-icon-button--close');
    return root.querySelectorAll('button').length === 1 && button?.getAttribute('aria-label') === 'Закрыть окно' && button.querySelector('.sf-close')?.getAttribute('aria-hidden') === 'true';
  }));
  check('action-size example contains five named native controls', await actionSizes.evaluate(root => root.querySelectorAll('button.sf-icon-button.sf-icon-button--close[aria-label]').length === 5));
  check('glyph-size example contains ten decorative glyphs and visible labels', await glyphSizes.evaluate(root => root.querySelectorAll('.sf-close[aria-hidden="true"]').length === 10 && /1\/4/.test(root.textContent) && /7/.test(root.textContent)));

  const renderedGlyph = overview.locator('.sf-close-icon');
  check('rendered documentation glyph is visible', await renderedGlyph.evaluate(glyph => {
    const rect = glyph.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(glyph).backgroundColor !== 'rgba(0, 0, 0, 0)';
  }));

  const firstExampleHeight = await examples.nth(0).evaluate(node => node.getBoundingClientRect().height);
  await examples.nth(0).getByRole('tab', {name: 'HTML'}).click();
  const sourceHeight = await examples.nth(0).evaluate(node => node.getBoundingClientRect().height);
  await examples.nth(0).getByRole('tab', {name: 'Результат'}).click();
  const restoredHeight = await examples.nth(0).evaluate(node => node.getBoundingClientRect().height);
  check('tab panels size from their active content without fixed blank area', firstExampleHeight > 0 && sourceHeight > firstExampleHeight && Math.abs(restoredHeight - firstExampleHeight) < 2, {firstExampleHeight, sourceHeight, restoredHeight});

  await page.setViewportSize({width: 390, height: 844});
  check('documentation and examples fit the mobile viewport', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
