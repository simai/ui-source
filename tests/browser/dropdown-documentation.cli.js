/* global document */
// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });

  await page.setViewportSize({width: 1440, height: 1000});
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce', colorScheme: 'light'});
  await page.goto('http://127.0.0.1:8892/ru/components/dropdown/', {waitUntil: 'networkidle'});
  const examples = page.locator('main [data-docara-example]');
  const preview = async index => {
    const example = examples.nth(index);
    const frame = example.locator('[data-docara-example-frame]');
    return await frame.count()
      ? frame.contentFrame().locator('body')
      : example.locator('[data-docara-example-inline-preview]');
  };
  check('documentation renders ten executable examples', await examples.count() === 10);
  check('auto mode isolates form and portal side effects', await examples.evaluateAll(nodes => nodes.map(node => node.dataset.docaraExamplePreviewResolved).slice(0, 8).join(',') === 'inline,inline,inline,inline,inline,sandbox,inline,sandbox'));

  const overview = await preview(0);
  check('ordinary example separates machine value and visible label', await overview.locator('.sf-list-item.selected').evaluate(item => item.dataset.value === 'kazan' && item.querySelector('.sf-list-item-container')?.textContent.trim() === 'Казань'));

  const tags = await preview(2);
  check('multiple examples use the short behavior attribute', await tags.locator('.sf-dropdown[multiple]').count() === 2);
  check('tag presentation renders the two initial values', await tags.locator('.sf-dropdown--tag .sf-tag').count() === 2);

  const options = await preview(3);
  for (const type of ['text', 'icon', 'checkbox', 'avatar', 'color']) {
    check(`option type ${type} is rendered`, await options.locator(`.sf-list-item--${type}`).count() > 0);
  }
  check('authored decorative option icons are hidden', await options.locator('.sf-list-item-wrap > .sf-icon:not([aria-hidden="true"]), .sf-checkbox .sf-icon:not([aria-hidden="true"])').count() === 0);

  const sizes = (await preview(4)).locator('.sf-dropdown-field');
  const heights = await sizes.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  check('all five semantic size profiles render', heights.length === 5, heights);
  check('size profile heights are monotonic', heights.every((height, index) => index === 0 || height >= heights[index - 1]), heights);

  const states = await preview(5);
  const stateDropdown = states.locator('.sf-dropdown').first();
  check('state example declares initial and disabled options', await stateDropdown.locator('.sf-list-item.selected[data-value="ready"]').count() === 1 && await stateDropdown.locator('.sf-list-item.disabled[data-value="archive"]').count() === 1);
  check('state example uses native form reset', await states.locator('form button[type="reset"]').count() === 1);
  check('disabled state is native and unfocusable', await states.locator('.sf-dropdown[disabled] .sf-dropdown-field > button').isDisabled());

  const search = await preview(6);
  const searchHost = search.locator('.sf-dropdown');
  await searchHost.locator('.sf-dropdown-field > button').click();
  const searchbox = searchHost.locator('.sf-list .sf-input input');
  check('search control is visible in the opened popup', await searchbox.isVisible());
  check('search starts enabled', !await searchbox.isDisabled());
  await searchHost.locator('.sf-dropdown-field > button').click();

  const portal = await preview(7);
  const portalHost = portal.locator('.sf-dropdown');
  check('portal example declares projection inside a clipped ancestor', await portalHost.getAttribute('portal') === '' && await portal.locator('.overflow-hidden').count() === 1);

  const frameFit = await Promise.all([5, 7].map(async index => {
    const frame = examples.nth(index).locator('[data-docara-example-frame]');
    const iframeHeight = await frame.evaluate(node => node.getBoundingClientRect().height);
    const contentHeight = await frame.contentFrame().locator('html').evaluate(node => node.scrollHeight);
    return {index, iframeHeight, contentHeight, delta: Math.abs(iframeHeight - contentHeight)};
  }));
  check('sandbox previews synchronize intrinsic height', frameFit.every(item => item.delta <= 3), frameFit);

  const initialHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'HTML'}).click();
  const sourceHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  await examples.first().getByRole('tab', {name: 'Результат'}).click();
  const restoredHeight = await examples.first().evaluate(node => node.getBoundingClientRect().height);
  check('example tabs use intrinsic active-panel height', initialHeight > 0 && sourceHeight > initialHeight && Math.abs(restoredHeight - initialHeight) < 2, {initialHeight, sourceHeight, restoredHeight});

  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => { document.documentElement.classList.remove('theme-light'); document.documentElement.classList.add('theme-dark'); });
  check('documentation fits mobile viewport', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  // A long list is read by its stretches, and a list behind something that is
  // not a field is still a list: both are shown on the page rather than only
  // described.
  const groups = await preview(8);
  check('a grouped list draws a heading over each stretch', await groups.locator('.sf-list-heading').count() >= 3);
  check('a grouped option keeps the row it would have anyway', await groups.locator('.sf-list-item--checkbox').count() >= 4);

  const trigger = await preview(9);
  check('a consumer trigger replaces the field entirely', await trigger.locator('.sf-dropdown-trigger').count() === 1 && await trigger.locator('.sf-dropdown-field').count() === 0);
  check('a grid lays its options out in rows', await trigger.locator('.sf-list-container--grid').evaluate(node => getComputedStyle(node).display === 'grid'));

  return {results, errors};
}
