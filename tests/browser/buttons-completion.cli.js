/* global customElements, document, getComputedStyle, window */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/buttons-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => customElements.get('sf-button') && document.querySelector('#smart-loading button'));

  check('all ordinary variants remain native buttons', await page.locator('#variants').evaluate(root =>
    root.querySelectorAll(':scope > button.sf-button').length === 4));
  check('five size profiles are strictly increasing', await page.locator('#sizes').evaluate(root => {
    const heights = [...root.querySelectorAll('button')].map(button => button.getBoundingClientRect().height);
    return heights.length === 5 && heights.every((height, index) => index === 0 || height > heights[index - 1]);
  }));
  check('decorative ordinary icons are hidden from assistive technology', await page.locator('#icons').evaluate(root =>
    [...root.querySelectorAll('.sf-icon')].every(icon => icon.getAttribute('aria-hidden') === 'true')));
  check('ordinary loading action is busy and natively disabled', await page.locator('#loading-ordinary').evaluate(button =>
    button.disabled && button.getAttribute('aria-busy') === 'true'));

  check('Smart default action uses safe native button type', await page.locator('#smart-default button').getAttribute('type') === 'button');
  await page.locator('#smart-default button').click();
  check('Smart default action does not submit its containing form', await page.evaluate(() => (window.__submitCount || 0) === 0));
  await page.locator('#smart-submit button').click();
  check('Smart explicit submit keeps native form behavior', await page.evaluate(() => window.__submitCount === 1));
  await page.locator('#form-value').fill('Изменено');
  await page.locator('#smart-reset button').click();
  check('Smart explicit reset keeps native form behavior', await page.locator('#form-value').inputValue() === 'Начальное значение');
  check('Smart generated decorative icon is hidden', await page.locator('#smart-default sf-icon').getAttribute('aria-hidden') === 'true');
  check('Smart loading action is busy and natively disabled', await page.locator('#smart-loading button').evaluate(button =>
    button.disabled && button.getAttribute('aria-busy') === 'true'));

  const ordinary = page.locator('#variants > button').first();
  await ordinary.click();
  check('pointer activation does not leave a focus ring', await ordinary.evaluate(node => getComputedStyle(node).boxShadow === 'none'));
  await page.keyboard.press('Tab');
  await ordinary.focus();
  check('keyboard focus exposes the Framework focus ring', await ordinary.evaluate(node =>
    node.matches(':focus-visible') && getComputedStyle(node).boxShadow !== 'none'));

  await page.evaluate(() => document.documentElement.dir = 'rtl');
  check('RTL keeps icon and text controls inside the viewport', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.evaluate(() => {
    document.documentElement.className = 'theme-dark';
    document.documentElement.style.fontSize = '32px';
  });
  check('dark theme and enlarged text preserve containment', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
