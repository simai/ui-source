/* global document, getComputedStyle, window */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  const [cssResponse, jsResponse] = await Promise.all([
    page.request.get('http://127.0.0.1:8886/_docara/candidate/button-group.css'),
    page.request.get('http://127.0.0.1:8886/_docara/candidate/button-group.js'),
  ]);
  if (!cssResponse.ok() || !jsResponse.ok()) {
    throw new Error(`Button Group candidates unavailable: css=${cssResponse.status()} js=${jsResponse.status()}`);
  }
  const candidateCss = await cssResponse.text();
  const candidateJs = await jsResponse.text();
  await page.route('**/docara-shell*.css', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: `${await response.text()}\n${candidateCss}`, contentType: 'text/css'});
  });
  await page.route(/\/component\/button-group\/css\/button-group(?:\.min)?\.css(?:\?.*)?$/, route => route.fulfill({status: 200, body: candidateCss, contentType: 'text/css'}));
  await page.route(/\/component\/button-group\/js\/button-group(?:\.min)?\.js(?:\?.*)?$/, route => route.fulfill({status: 200, body: candidateJs, contentType: 'text/javascript'}));

  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('http://127.0.0.1:8886/ru/components/button-group/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelectorAll('[data-docara-example-frame]').length === 2);
  await page.waitForFunction(() => window.frames.length === 2);
  await page.waitForTimeout(800);

  const exampleFrames = page.locator('[data-docara-example-frame]');
  const frames = page.frames().filter(frame => frame !== page.mainFrame());
  const byBase = async suffix => {
    for (const frame of frames) {
      if ((await frame.evaluate(() => document.baseURI)).includes(suffix)) return frame;
    }
    return null;
  };
  const overview = await byBase('/components/button-group/overview/');
  const vertical = await byBase('/components/button-group/vertical/');

  check('page publishes two runnable examples', await exampleFrames.count() === 2);
  check('overview contains named independent action groups', await overview.evaluate(() =>
    [...document.querySelectorAll('.sf-button-group')].every(group =>
      group.getAttribute('role') === 'group'
        && Boolean(group.getAttribute('aria-label'))
        && !group.querySelector('[aria-pressed], [role="radio"]'))));
  check('overview action buttons remain native tab stops', await overview.evaluate(() =>
    [...document.querySelectorAll('.sf-button-group > button')].every(button => button.tabIndex === 0)));
  check('vertical example uses concise orientation data and valid generic ARIA', await vertical.evaluate(() => {
    const group = document.querySelector('.sf-button-group');
    return group?.getAttribute('data-orientation') === 'vertical'
      && !group.hasAttribute('aria-orientation')
      && getComputedStyle(group).flexDirection === 'column';
  }));
  check('vertical group keeps one continuous perimeter', await vertical.evaluate(() => {
    const buttons = [...document.querySelectorAll('.sf-button-group > button')];
    return parseFloat(getComputedStyle(buttons[0]).borderBlockStartWidth) > 0
      && parseFloat(getComputedStyle(buttons[1]).borderBlockStartWidth) === 0
      && parseFloat(getComputedStyle(buttons.at(-1)).borderBlockEndWidth) > 0;
  }));

  const outerHeights = await exampleFrames.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const contentHeights = await Promise.all(frames.map(frame => frame.evaluate(() => document.documentElement.scrollHeight)));
  check('desktop examples own intrinsic height', outerHeights.every((height, index) => height >= contentHeights[index] && height - contentHeights[index] <= 2));

  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8886/ru/components/button-group/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.frames.length === 2);
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
