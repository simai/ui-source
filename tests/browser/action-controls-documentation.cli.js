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

  await page.goto('http://127.0.0.1:8892/ru/components/icon-buttons/', {waitUntil: 'networkidle'});
  const iconExamples = page.locator('main [data-docara-example]');
  check('icon button page renders six executable examples', await iconExamples.count() === 6);
  check('safe icon button examples resolve inline in auto mode', await iconExamples.evaluateAll(nodes => nodes.every(node => node.dataset.docaraExamplePreviewRequested === 'auto' && node.dataset.docaraExamplePreviewResolved === 'inline')));
  check('icon button page creates no iframe boundary', await iconExamples.locator('iframe').count() === 0);

  const iconPreview = index => iconExamples.nth(index).locator('[data-docara-example-inline-preview]');
  const overview = iconPreview(0);
  check('overview has one named native action and decorative glyph', await overview.evaluate(root => {
    const button = root.querySelector('button.sf-icon-button');
    return root.querySelectorAll('button').length === 1
      && button?.type === 'button'
      && Boolean(button.getAttribute('aria-label'))
      && button.querySelector('.sf-icon')?.getAttribute('aria-hidden') === 'true';
  }));
  const variants = iconPreview(1);
  check('variants cover exactly the eight supported visual pairings', await variants.locator('button.sf-icon-button').count() === 8);
  const sizes = iconPreview(2).locator('button.sf-icon-button');
  const dimensions = await sizes.evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return {width: rect.width, height: rect.height};
  }));
  check('all five semantic icon sizes are square and monotonic', dimensions.length === 5
    && dimensions.every(item => item.width > 0 && Math.abs(item.width - item.height) < 0.2)
    && dimensions.every((item, index) => index === 0 || item.width > dimensions[index - 1].width), dimensions);
  const states = iconPreview(3);
  check('loading icon action is natively blocked and busy', await states.locator('button.loading[aria-busy="true"]').evaluate(button => button.disabled));
  check('every preview icon action has a name and decorative glyph', await iconExamples.evaluateAll(nodes => nodes
    .flatMap(node => [...node.querySelectorAll('[data-docara-example-inline-preview] button.sf-icon-button')])
    .every(button => Boolean(button.getAttribute('aria-label')) && button.querySelector('.sf-icon')?.getAttribute('aria-hidden') === 'true')));
  check('radius example omits large-surface radius utility', await iconPreview(5).locator('.radius-default').count() === 0);

  const initialHeight = await iconExamples.first().evaluate(node => node.getBoundingClientRect().height);
  await iconExamples.first().getByRole('tab', {name: 'HTML'}).click();
  const sourceHeight = await iconExamples.first().evaluate(node => node.getBoundingClientRect().height);
  await iconExamples.first().getByRole('tab', {name: 'Результат'}).click();
  const restoredHeight = await iconExamples.first().evaluate(node => node.getBoundingClientRect().height);
  check('icon example tabs follow intrinsic active-panel height', initialHeight > 0 && sourceHeight > initialHeight && Math.abs(restoredHeight - initialHeight) < 2, {initialHeight, sourceHeight, restoredHeight});

  await page.goto('http://127.0.0.1:8892/ru/components/fab/', {waitUntil: 'networkidle'});
  const fabExamples = page.locator('main [data-docara-example]');
  check('FAB page renders four executable examples', await fabExamples.count() === 4);
  check('safe FAB examples resolve inline in auto mode', await fabExamples.evaluateAll(nodes => nodes.every(node => node.dataset.docaraExamplePreviewRequested === 'auto' && node.dataset.docaraExamplePreviewResolved === 'inline')));
  check('FAB page creates no iframe boundary', await fabExamples.locator('iframe').count() === 0);
  const fabPreview = index => fabExamples.nth(index).locator('[data-docara-example-inline-preview]');
  check('FAB overview is one named native action with decorative glyph', await fabPreview(0).evaluate(root => {
    const button = root.querySelector('button.sf-fab');
    return root.querySelectorAll('button').length === 1
      && button?.type === 'button'
      && Boolean(button.getAttribute('aria-label'))
      && button.querySelector('.sf-icon')?.getAttribute('aria-hidden') === 'true';
  }));
  check('FAB variants cover the four source-supported pairings', await fabPreview(1).locator('button.sf-fab').count() === 4);
  const fabDimensions = await fabPreview(2).locator('button.sf-fab').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return {width: rect.width, height: rect.height};
  }));
  check('all three FAB sizes are square and monotonic', fabDimensions.length === 3
    && fabDimensions.every(item => item.width > 0 && Math.abs(item.width - item.height) < 0.2)
    && fabDimensions.every((item, index) => index === 0 || item.width > fabDimensions[index - 1].width), fabDimensions);
  check('FAB states pair active with pressed semantics and disabled with native state', await fabPreview(3).evaluate(root => Boolean(root.querySelector('.sf-fab.active[aria-pressed="true"]')) && Boolean(root.querySelector('.sf-fab:disabled'))));

  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => { document.documentElement.classList.remove('theme-light'); document.documentElement.classList.add('theme-dark'); });
  check('documentation and examples fit the mobile viewport', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
