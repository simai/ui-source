/* global document, getComputedStyle, window */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  const candidateResponse = await page.request.get('http://127.0.0.1:8884/_docara/candidate/badges.css');
  if (!candidateResponse.ok()) throw new Error(`Candidate Badge CSS is unavailable: ${candidateResponse.status()}`);
  const candidateCss = await candidateResponse.text();
  await page.route('**/docara-shell*.css', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\n${candidateCss}`,
      contentType: 'text/css',
    });
  });
  await page.route(/\/component\/badges\/css\/badges(?:\.min)?\.css(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    body: candidateCss,
    contentType: 'text/css',
  }));
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('http://127.0.0.1:8884/ru/components/badges/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelectorAll('[data-docara-example-frame]').length === 5);
  await page.waitForFunction(() => window.frames.length === 5);
  await page.waitForTimeout(1000);

  const exampleFrames = page.locator('[data-docara-example-frame]');
  const frames = page.frames().filter(frame => frame !== page.mainFrame());
  check('page publishes five focused runnable examples', await exampleFrames.count() === 5);

  const byBase = async suffix => {
    for (const frame of frames) {
      if ((await frame.evaluate(() => document.baseURI)).includes(suffix)) return frame;
    }
    return null;
  };
  const basic = await byBase('/components/badges/basic/');
  const types = await byBase('/components/badges/types/');
  const schemes = await byBase('/components/badges/overview/');
  const sizes = await byBase('/components/badges/sizes/');
  const icons = await byBase('/components/badges/icons/');

  check('basic Badge is a static inline label', await basic.evaluate(() => {
    const badge = document.querySelector('.sf-badge');
    return badge?.tagName === 'SPAN' && !badge.matches('button, a, [tabindex]');
  }));
  check('three emphasis variants are distinct and outline is visible', await types.evaluate(() => {
    const badges = document.querySelectorAll('.sf-badge');
    const outline = document.querySelector('.sf-badge--outline');
    return badges.length === 3
      && new Set([...badges].map(node => getComputedStyle(node).backgroundColor)).size >= 2
      && getComputedStyle(outline).borderStyle === 'solid'
      && parseFloat(getComputedStyle(outline).borderTopWidth) > 0;
  }));
  check('semantic matrix includes all 26 supported medium variants', await schemes.evaluate(() =>
    document.querySelectorAll('.sf-badge').length === 26
      && document.querySelectorAll('.sf-badge--on-surface').length === 2));
  check('desktop size profiles are strictly increasing', await sizes.evaluate(() => {
    const heights = [...document.querySelectorAll('.sf-badge')].map(node => node.getBoundingClientRect().height);
    return heights.length === 3 && heights.every((height, index) => index === 0 || height > heights[index - 1]);
  }));
  check('icons and abbreviated values carry explicit text alternatives', await icons.evaluate(() =>
    document.querySelectorAll('.sf-icon[aria-hidden="true"]').length === 3
      && document.querySelectorAll('.sr-only').length === 2
      && document.body.textContent.includes('непрочитанных')));

  const frameHeights = await exampleFrames.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const bodyHeights = await Promise.all(frames.map(frame => frame.evaluate(() => document.body.scrollHeight)));
  check('all examples own intrinsic height without inner scrolling',
    frameHeights.every((height, index) => height >= bodyHeights[index]));

  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8884/ru/components/badges/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.frames.length === 5);
  await page.waitForTimeout(1000);
  const mobileFrames = page.frames().filter(frame => frame !== page.mainFrame());
  let mobileSizes = null;
  for (const frame of mobileFrames) {
    if ((await frame.evaluate(() => document.baseURI)).includes('/components/badges/sizes/')) mobileSizes = frame;
  }
  check('mobile size profiles remain strictly increasing', await mobileSizes.evaluate(() => {
    const heights = [...document.querySelectorAll('.sf-badge')].map(node => node.getBoundingClientRect().height);
    return heights.length === 3 && heights.every((height, index) => index === 0 || height > heights[index - 1]);
  }));
  const mobileOuterHeights = await page.locator('[data-docara-example-frame]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const mobileBodyHeights = await Promise.all(mobileFrames.map(frame => frame.evaluate(() => document.body.scrollHeight)));
  check('mobile examples settle to content without scroll or material empty space',
    mobileOuterHeights.every((height, index) => height >= mobileBodyHeights[index] && height - mobileBodyHeights[index] <= 8));
  check('mobile documentation has no horizontal overflow', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
