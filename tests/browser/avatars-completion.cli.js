/* global customElements, document, getComputedStyle */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/avatars-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => customElements.get('sf-avatar') && document.querySelector('#smart-image .sf-avatar-image'));

  const staticAvatar = page.locator('#static-avatar');
  const staticBefore = await staticAvatar.evaluate(node => getComputedStyle(node).borderColor);
  await staticAvatar.hover();
  check('static identity has no interactive hover affordance', await staticAvatar.evaluate((node, before) => getComputedStyle(node).borderColor === before, staticBefore));

  await page.locator('body').click({position: {x: 1, y: 1}});
  await page.locator('#action-avatar').click();
  check('pointer focus does not paint keyboard focus ring', await page.locator('#action-avatar').evaluate(node => getComputedStyle(node).boxShadow === 'none'));
  await page.goto('http://127.0.0.1:8768/tests/fixtures/avatars-method-lab.html', {waitUntil: 'networkidle'});
  await page.keyboard.press('Tab');
  await page.waitForTimeout(250);
  check('keyboard focus paints a stable focus ring', await page.locator('#action-avatar').evaluate(node => document.activeElement === node && getComputedStyle(node).boxShadow !== 'none'));

  check('circle and square use different semantic radii', await page.evaluate(() => {
    const circle = getComputedStyle(document.querySelector('#static-avatar')).borderStartStartRadius;
    const square = getComputedStyle(document.querySelector('#square-avatar')).borderStartStartRadius;
    return circle !== square && parseFloat(circle) > parseFloat(square);
  }));
  check('real image fills and crops inside the avatar', await page.locator('#image-avatar').evaluate(root => {
    const image = root.querySelector('img');
    const rootRect = root.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const style = getComputedStyle(root);
    const borderX = parseFloat(style.borderInlineStartWidth) + parseFloat(style.borderInlineEndWidth);
    const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    return getComputedStyle(image).objectFit === 'cover'
      && Math.abs(rootRect.width - borderX - imageRect.width) < 0.5
      && Math.abs(rootRect.height - borderY - imageRect.height) < 0.5;
  }));
  check('complete size scale is monotonic and nonzero', await page.locator('#sizes').evaluate(root => {
    const widths = [...root.querySelectorAll('.sf-avatar')].map(node => node.getBoundingClientRect().width);
    return widths.length === 6 && widths.every(width => width > 0)
      && widths.every((width, index) => index === 0 || width > widths[index - 1]);
  }));
  check('status has a visible text equivalent', await page.locator('#status').evaluate(root => root.textContent.includes('в сети') && root.querySelector('.sf-online-indicator').closest('[aria-hidden="true"]')));
  check('RTL group overlap follows logical inline direction', await page.locator('#group').evaluate(root => {
    const items = root.querySelectorAll('[role="listitem"]');
    return getComputedStyle(root).direction === 'rtl'
      && parseFloat(getComputedStyle(items[1]).marginInlineStart) < 0;
  }));

  check('Smart image uses a real decorative img and square shape', await page.locator('#smart-image').evaluate(host => {
    const root = host.querySelector('.sf-avatar');
    const image = host.querySelector('.sf-avatar-image');
    return root?.classList.contains('sf-avatar--square') && image?.getAttribute('alt') === '';
  }));
  check('Smart label action owns status in its accessible name', await page.locator('#smart-label').evaluate(host => {
    const button = host.querySelector('button');
    return button?.getAttribute('aria-label')?.includes('в сети')
      && host.querySelector('.sf-online-indicator')?.getAttribute('aria-hidden') === 'true';
  }));
  check('Smart card uses canonical variant and avoids duplicate image name', await page.locator('#smart-card').evaluate(host => {
    const card = host.querySelector('.sf-avatar-card');
    return card?.classList.contains('sf-avatar-card--portrait')
      && host.querySelector('img')?.getAttribute('alt') === '';
  }));

  await page.evaluate(() => document.documentElement.className = 'theme-dark');
  check('dark theme keeps semantic content visible', await page.locator('#static-avatar').evaluate(node => getComputedStyle(node).color !== 'rgba(0, 0, 0, 0)'));
  check('mobile layout has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);
  if (results.some(result => !result.pass)) throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  return {results, errors};
}
