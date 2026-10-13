/* global document, getComputedStyle, window */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  const [cssResponse, jsResponse] = await Promise.all([
    page.request.get('http://127.0.0.1:8885/_docara/candidate/breadcrumbs.css'),
    page.request.get('http://127.0.0.1:8885/_docara/candidate/breadcrumbs.js'),
  ]);
  if (!cssResponse.ok() || !jsResponse.ok()) {
    throw new Error(`Breadcrumb candidates unavailable: css=${cssResponse.status()} js=${jsResponse.status()}`);
  }
  const candidateCss = await cssResponse.text();
  const candidateJs = await jsResponse.text();
  await page.route('**/docara-shell*.css', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: `${await response.text()}\n${candidateCss}`, contentType: 'text/css'});
  });
  await page.route(/\/component\/breadcrumbs\/css\/breadcrumbs(?:\.min)?\.css(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    body: candidateCss,
    contentType: 'text/css',
  }));
  await page.route(/\/component\/breadcrumbs\/js\/breadcrumbs(?:\.min)?\.js(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    body: candidateJs,
    contentType: 'text/javascript',
  }));

  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('http://127.0.0.1:8885/ru/components/breadcrumbs/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelectorAll('[data-docara-example-frame]').length === 3);
  await page.waitForFunction(() => window.frames.length === 3);
  await page.waitForTimeout(800);

  const exampleFrames = page.locator('[data-docara-example-frame]');
  const frames = page.frames().filter(frame => frame !== page.mainFrame());
  const byBase = async suffix => {
    for (const frame of frames) {
      if ((await frame.evaluate(() => document.baseURI)).includes(suffix)) return frame;
    }
    return null;
  };
  const overview = await byBase('/components/breadcrumbs/overview/');
  const longPath = await byBase('/components/breadcrumbs/long-path/');
  const longLabels = await byBase('/components/breadcrumbs/long-labels/');

  check('page publishes three focused runnable examples', await exampleFrames.count() === 3);
  check('overview is a named navigation landmark with native ancestors', await overview.evaluate(() => {
    const nav = document.querySelector('nav.sf-breadcrumbs');
    return Boolean(nav?.getAttribute('aria-label'))
      && nav.querySelectorAll('a[href]').length === 2
      && nav.querySelectorAll('[aria-current="page"]').length === 1;
  }));
  check('overview separators are hidden from assistive technology', await overview.evaluate(() =>
    [...document.querySelectorAll('.sf-breadcrumbs-item--separator')].every(node =>
      node.getAttribute('aria-hidden') === 'true' && node.querySelector('.sf-icon')?.getAttribute('aria-hidden') === 'true')));
  check('long path collapses to one localized ellipsis action', await longPath.evaluate(() => {
    const button = document.querySelector('button[data-sf-breadcrumbs-generated="ellipsis"]');
    return button?.getAttribute('aria-label') === 'Показать скрытые уровни'
      && document.querySelectorAll('[hidden]').length > 0;
  }));
  await longPath.locator('button[data-sf-breadcrumbs-generated="ellipsis"]').click();
  check('long path expands without stale controls', await longPath.evaluate(() =>
    document.querySelectorAll('[hidden]').length === 0
      && !document.querySelector('[data-sf-breadcrumbs-generated="ellipsis"]')));
  check('long labels wrap within their example viewport', await longLabels.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      && getComputedStyle(document.querySelector('.sf-breadcrumbs-item-container')).overflowWrap === 'anywhere'));

  const outerHeights = await exampleFrames.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const contentHeights = await Promise.all(frames.map(frame => frame.evaluate(() => document.documentElement.scrollHeight)));
  check('desktop examples own intrinsic height without inner scrolling',
    outerHeights.every((height, index) => height >= contentHeights[index] && height - contentHeights[index] <= 2));

  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8885/ru/components/breadcrumbs/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.frames.length === 3);
  await page.waitForTimeout(800);
  const mobileFrames = page.frames().filter(frame => frame !== page.mainFrame());
  const mobileOuterHeights = await page.locator('[data-docara-example-frame]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const mobileContentHeights = await Promise.all(mobileFrames.map(frame => frame.evaluate(() => document.documentElement.scrollHeight)));
  check('mobile examples settle to content without scroll or material empty space',
    mobileOuterHeights.every((height, index) => height >= mobileContentHeights[index] && height - mobileContentHeights[index] <= 2));
  check('mobile page has no horizontal overflow', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
