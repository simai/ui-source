/* global document, getComputedStyle, window */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  const cssResponse = await page.request.get('http://127.0.0.1:8887/_docara/candidate/buttons.css');
  if (!cssResponse.ok()) throw new Error(`Button candidate CSS unavailable: ${cssResponse.status()}`);
  const candidateCss = await cssResponse.text();
  await page.route('**/docara-shell*.css', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: `${await response.text()}\n${candidateCss}`, contentType: 'text/css'});
  });
  await page.route(/\/component\/buttons\/css\/buttons(?:\.min)?\.css(?:\?.*)?$/, route => route.fulfill({status: 200, body: candidateCss, contentType: 'text/css'}));

  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('http://127.0.0.1:8887/ru/components/buttons/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelectorAll('[data-docara-example-frame]').length === 7);
  await page.waitForFunction(() => window.frames.length === 7);
  await page.waitForTimeout(800);

  const exampleFrames = page.locator('[data-docara-example-frame]');
  const frames = page.frames().filter(frame => frame !== page.mainFrame());
  const byBase = async suffix => {
    for (const frame of frames) {
      if ((await frame.evaluate(() => document.baseURI)).includes(suffix)) return frame;
    }
    return null;
  };
  const basic = await byBase('/components/buttons/basic/');
  const variants = await byBase('/components/buttons/variants/');
  const sizes = await byBase('/components/buttons/sizes/');
  const icons = await byBase('/components/buttons/icons/');
  const states = await byBase('/components/buttons/states/');
  const tightness = await byBase('/components/buttons/tightness/');
  const radius = await byBase('/components/buttons/radius/');

  check('page publishes seven focused runnable examples', await exampleFrames.count() === 7);
  check('basic example is one safe native action', await basic.evaluate(() => {
    const button = document.querySelector('button.sf-button');
    return button?.type === 'button' && Boolean(button.textContent.trim());
  }));
  check('four emphasis variants render distinct visual roles', await variants.evaluate(() => {
    const buttons = document.querySelectorAll('.sf-button');
    return buttons.length === 8
      && document.querySelectorAll('.sf-button--default').length === 2
      && document.querySelectorAll('.sf-button--tonal').length === 2
      && document.querySelectorAll('.sf-button--outline').length === 2
      && document.querySelectorAll('.sf-button--link').length === 2;
  }));
  check('five size profiles are strictly increasing', await sizes.evaluate(() => {
    const heights = [...document.querySelectorAll('.sf-button')].map(button => button.getBoundingClientRect().height);
    return heights.length === 5 && heights.every((height, index) => index === 0 || height > heights[index - 1]);
  }));
  check('icon examples retain visible labels and decorative icon semantics', await icons.evaluate(() =>
    [...document.querySelectorAll('.sf-button')].every(button =>
      Boolean(button.querySelector('.sf-button-text-container')?.textContent.trim())
        && button.querySelector('.sf-icon')?.getAttribute('aria-hidden') === 'true')));
  check('state example owns toggle, disabled and blocked loading semantics', await states.evaluate(() => {
    const loading = document.querySelector('[aria-busy="true"]');
    return document.querySelector('[aria-pressed="true"].active')
      && document.querySelectorAll('button:disabled').length === 2
      && loading?.disabled;
  }));
  check('density changes height without changing text size', await tightness.evaluate(() => {
    const buttons = [...document.querySelectorAll('.sf-button')];
    const heights = buttons.map(button => button.getBoundingClientRect().height);
    const sizes = buttons.map(button => getComputedStyle(button.querySelector('.sf-button-text-container')).fontSize);
    return new Set(heights).size > 1 && new Set(sizes).size === 1;
  }));
  check('radius example uses system UI, square and rounded only', await radius.evaluate(() => {
    const buttons = [...document.querySelectorAll('.sf-button')];
    return buttons.length === 3
      && buttons.some(button => button.classList.contains('radius-square'))
      && buttons.some(button => button.classList.contains('radius-rounded'))
      && !buttons.some(button => button.classList.contains('radius-default'));
  }));

  const outerHeights = await exampleFrames.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const contentHeights = await Promise.all(frames.map(frame => frame.evaluate(() => document.documentElement.scrollHeight)));
  check('desktop examples own intrinsic height', outerHeights.every((height, index) => height >= contentHeights[index] && height - contentHeights[index] <= 2));

  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8887/ru/components/buttons/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.frames.length === 7);
  await page.waitForTimeout(800);
  const mobileFrames = page.frames().filter(frame => frame !== page.mainFrame());
  const mobileOuter = await page.locator('[data-docara-example-frame]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const mobileContent = await Promise.all(mobileFrames.map(frame => frame.evaluate(() => document.documentElement.scrollHeight)));
  check('mobile examples own intrinsic height without nested scroll', mobileOuter.every((height, index) => height >= mobileContent[index] && height - mobileContent[index] <= 2));
  check('mobile page has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
