/* global document, getComputedStyle, window */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('http://127.0.0.1:8882/ru/components/avatars/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelectorAll('[data-docara-example-frame]').length === 7);
  await page.waitForFunction(() => window.frames.length === 7);

  const exampleFrames = page.locator('[data-docara-example-frame]');
  check('page publishes all seven documented variants', await exampleFrames.count() === 7);

  const frames = page.frames().filter(frame => frame !== page.mainFrame());
  for (const frame of frames) {
    await frame.addStyleTag({url: 'http://127.0.0.1:8882/_docara/candidate/avatars.css'});
  }
  await page.waitForTimeout(500);
  const frameHeights = await exampleFrames.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  const bodyHeights = await Promise.all(frames.map(frame => frame.evaluate(() => document.body.scrollHeight)));
  check('all examples own intrinsic height without an inner scrollbar',
    frameHeights.length === bodyHeights.length
    && frameHeights.every((height, index) => height >= bodyHeights[index]));
  const byBase = async suffix => {
    for (const frame of frames) {
      const base = await frame.evaluate(() => document.baseURI);
      if (base.includes(suffix)) return frame;
    }
    return null;
  };
  const overview = await byBase('/components/avatars/overview/');
  const sizes = await byBase('/components/avatars/sizes/');
  const shapes = await byBase('/components/avatars/shapes/');
  const status = await byBase('/components/avatars/status/');
  const group = await byBase('/components/avatars/group/');
  const cards = await byBase('/components/avatars/cards/');

  check('overview separates static identity from a native action', await overview.evaluate(() => {
    const avatars = document.querySelectorAll('.sf-avatar');
    return avatars.length === 3
      && !document.querySelector('button.sf-avatar')
      && document.querySelector('a.sf-avatar')?.getAttribute('aria-label')?.startsWith('Открыть профиль');
  }));
  check('local image is loaded and decorative beside visible identity', await overview.evaluate(() => {
    const image = document.querySelector('.sf-avatar-image');
    return image?.complete && image.naturalWidth > 0 && image.getAttribute('alt') === '';
  }));
  check('documentation renders a distinct complete size scale', await sizes.evaluate(() => {
    const widths = [...document.querySelectorAll('.sf-avatar')].map(node => node.getBoundingClientRect().width);
    return widths.length === 6 && widths.every((width, index) => index === 0 || width > widths[index - 1]);
  }));
  check('shape example distinguishes person and organization geometry', await shapes.evaluate(() => {
    const circle = getComputedStyle(document.querySelector('.sf-avatar:not(.sf-avatar--square)')).borderStartStartRadius;
    const square = getComputedStyle(document.querySelector('.sf-avatar--square')).borderStartStartRadius;
    return parseFloat(circle) > parseFloat(square);
  }));
  check('status example provides visible text equivalents', await status.evaluate(() => document.body.textContent.includes('в сети') && document.body.textContent.includes('не в сети') && document.body.textContent.includes('организация')));
  check('group exposes list semantics and only the add action is a button', await group.evaluate(() => document.querySelector('[role="list"]') && document.querySelectorAll('[role="listitem"]').length === 3 && document.querySelectorAll('button').length === 1));
  check('cards use canonical BEM variants and surface utilities', await cards.evaluate(() => document.querySelector('.sf-avatar-card--square.radius-default') && document.querySelector('.sf-avatar-card--portrait.radius-default')));

  await page.setViewportSize({width: 390, height: 844});
  check('mobile documentation has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);
  if (results.some(result => !result.pass)) throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  return {results, errors};
}
