/* global customElements, document, getComputedStyle */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/badges-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => customElements.get('sf-badge') && document.querySelector('#smart-icon .sf-badge'));

  check('Badge roots do not add interactive semantics or tab stops', await page.evaluate(() =>
    !document.querySelector('.sf-badge:is(button, a), .sf-badge[tabindex]')));
  check('outline owns a visible solid Framework border', await page.locator('#outline').evaluate(node => {
    const style = getComputedStyle(node);
    return style.borderStyle === 'solid' && parseFloat(style.borderTopWidth) > 0;
  }));
  check('three mobile size profiles are strictly increasing', await page.locator('#sizes').evaluate(root => {
    const heights = [...root.querySelectorAll('.sf-badge')].map(node => node.getBoundingClientRect().height);
    return heights.length === 3 && heights.every((height, index) => index === 0 || height > heights[index - 1]);
  }));
  check('visible status is not communicated by colour alone', await page.locator('#status-badge').evaluate(node => node.textContent.includes('Готово')));
  check('abbreviated count exposes its full text equivalent', await page.locator('#count-badge').evaluate(node => node.querySelector('.sr-only')?.textContent.includes('непрочитанных')));
  check('decorative icon is hidden from assistive technology', await page.locator('#status-badge .sf-icon').getAttribute('aria-hidden') === 'true');

  check('Smart Badge renders an inline span root', await page.locator('#smart-text').evaluate(host => host.firstElementChild?.tagName === 'SPAN'));
  check('Smart generated icon is decorative', await page.locator('#smart-text .sf-icon').getAttribute('aria-hidden') === 'true');
  check('Smart abbreviated value uses sr-only full text and hides duplicate visible text', await page.locator('#smart-count').evaluate(host =>
    host.querySelector('.sr-only')?.textContent.includes('непрочитанных')
      && host.querySelector('.sf-badge-text-container')?.getAttribute('aria-hidden') === 'true'));
  check('Smart icon-only badge has a text equivalent', await page.locator('#smart-icon').evaluate(host =>
    host.querySelector('.sr-only')?.textContent === 'Подтверждено'
      && host.querySelector('.sf-icon')?.getAttribute('aria-hidden') === 'true'));
  check('invalid Smart values normalize to safe defaults', await page.locator('#smart-fallback .sf-badge').evaluate(node =>
    node.classList.contains('sf-badge--main')
      && node.classList.contains('sf-badge--neutral')
      && node.classList.contains('sf-badge--size-1/3')));

  await page.setViewportSize({width: 1280, height: 900});
  check('three desktop size profiles remain strictly increasing', await page.locator('#sizes').evaluate(root => {
    const heights = [...root.querySelectorAll('.sf-badge')].map(node => node.getBoundingClientRect().height);
    return heights.length === 3 && heights.every((height, index) => index === 0 || height > heights[index - 1]);
  }));
  await page.evaluate(() => document.documentElement.className = 'theme-dark');
  check('dark theme preserves visible semantic text', await page.locator('#status-badge').evaluate(node => getComputedStyle(node).color !== 'rgba(0, 0, 0, 0)'));
  await page.evaluate(() => document.documentElement.dir = 'rtl');
  check('RTL keeps the compact badge inside the viewport', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
