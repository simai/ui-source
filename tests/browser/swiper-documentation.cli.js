async page => {
  const results = [];
  const errors = [];
  const externalRequests = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8877/')) externalRequests.push(request.url());
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('http://127.0.0.1:8877/ru/components/swiper/');
  const examples = page.locator('[data-docara-example]');
  await examples.first().waitFor();
  const frames = examples.locator('[data-docara-example-frame]');
  await frames.nth(0).contentFrame().locator('.swiper-initialized').waitFor();
  await frames.nth(1).contentFrame().locator('.swiper-initialized').waitFor();
  await frames.nth(2).contentFrame().locator('.swiper-initialized').waitFor();
  const roots = [0, 1, 2].map(index => frames.nth(index).contentFrame().locator('.swiper-initialized'));

  check('three reusable examples are rendered', await examples.count() === 3);
  check('released Docara keeps each script example in its sandbox boundary', await frames.count() === 3);
  check('all examples initialize one named Swiper root', (await Promise.all(roots.map(async root => await root.getAttribute('role') === 'region' && Boolean(await root.getAttribute('aria-label'))))).every(Boolean));
  check('overview renders three native named pagination buttons', await frames.nth(0).contentFrame().locator('.swiper-pagination-bullet').evaluateAll(nodes => nodes.length === 3 && nodes.every(node => node.tagName === 'BUTTON' && node.getAttribute('aria-label'))));
  check('responsive example preserves all authored slides', await frames.nth(1).contentFrame().locator('.swiper-slide').count() === 4);
  await frames.nth(2).contentFrame().locator('[data-action="add"]').click();
  check('lifecycle example updates slides and pagination together', await frames.nth(2).contentFrame().locator('.swiper-slide').count() === 3 && await frames.nth(2).contentFrame().locator('.swiper-pagination-bullet').count() === 3);
  await frames.nth(2).contentFrame().locator('[data-action="remove"]').click();
  check('lifecycle example removes only the final slide', await frames.nth(2).contentFrame().locator('.swiper-slide').count() === 2);
  check('HTML and JavaScript tabs are available for every example', await examples.evaluateAll(nodes => nodes.every(node => node.querySelector('[data-docara-example-tab="html"]') && node.querySelector('[data-docara-example-tab="javascript"]'))));
  check('example frames fit their content without an internal page scrollbar', (await Promise.all([0, 1, 2].map(index => frames.nth(index).contentFrame().locator('html').evaluate(doc => doc.scrollWidth <= doc.clientWidth)))).every(Boolean));
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(200);
  check('documentation remains bounded on mobile', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
  check('no runtime errors', errors.length === 0, errors.join('\n'));
  return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
