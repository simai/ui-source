/* global customElements, document, getComputedStyle, KeyboardEvent, window */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/breadcrumbs-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => customElements.get('sf-breadcrumbs') && document.querySelector('#smart nav'));

  check('ordinary Breadcrumbs is a named navigation landmark', await page.locator('#ordinary').evaluate(node =>
    node.tagName === 'NAV' && Boolean(node.getAttribute('aria-label'))));
  check('ordinary ancestors are links and current page is unique', await page.locator('#ordinary').evaluate(node =>
    node.querySelectorAll('a[href]').length === 2 && node.querySelectorAll('[aria-current="page"]').length === 1));
  check('separators and their icons are decorative', await page.locator('#ordinary').evaluate(node =>
    [...node.querySelectorAll('.sf-breadcrumbs-item--separator')].every(separator =>
      separator.getAttribute('aria-hidden') === 'true'
        && separator.querySelector('.sf-icon')?.getAttribute('aria-hidden') === 'true')));
  check('long labels wrap without page overflow', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      && getComputedStyle(document.querySelector('#long-labels .sf-breadcrumbs-item-container')).overflowWrap === 'anywhere'));

  const ellipsis = page.locator('#collapsed [data-sf-breadcrumbs-generated="ellipsis"]:is(button)');
  check('collapsed path owns one localized ellipsis action', await ellipsis.count() === 1
    && await ellipsis.getAttribute('aria-label') === 'Показать скрытые уровни');
  let eventCount = 0;
  await page.locator('#collapsed').evaluate(node => node.addEventListener('sf-breadcrumb-click', () => { window.__breadcrumbEvents = (window.__breadcrumbEvents || 0) + 1; }));
  await ellipsis.click();
  eventCount = await page.evaluate(() => window.__breadcrumbEvents || 0);
  check('ellipsis expands once and emits one cancellable component event', eventCount === 1
    && await page.locator('#collapsed [hidden]').count() === 0
    && await page.locator('#collapsed [data-sf-breadcrumbs-generated="ellipsis"]').count() === 0);

  await page.locator('#dynamic').evaluate(node => {
    node.setAttribute('data-expand-label', 'Обновлённая подпись');
    node.setAttribute('data-max-items', '4');
    node.querySelector('a[href="#d2"]')?.remove();
  });
  await page.waitForTimeout(100);
  check('dynamic attribute and child changes recalculate without stale generated nodes', await page.locator('#dynamic').evaluate(node =>
    node.querySelectorAll('[data-sf-breadcrumbs-generated="ellipsis"]').length <= 2
      && !node.textContent.includes('Второй')));

  const ordinaryLink = page.locator('#ordinary a[href="#catalog"]');
  await ordinaryLink.click();
  check('pointer activation does not leave a focus ring', await ordinaryLink.evaluate(node => getComputedStyle(node).boxShadow === 'none'));
  await page.keyboard.press('Tab');
  await page.locator('#ordinary a[href="#home"]').focus();
  await page.locator('#ordinary a[href="#home"]').evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true})));
  check('keyboard focus uses the Framework focus-visible treatment', await page.locator('#ordinary a[href="#home"]').evaluate(node =>
    node.matches(':focus-visible') && getComputedStyle(node).boxShadow !== 'none'));

  check('Smart Breadcrumbs is a named navigation landmark', await page.locator('#smart nav').evaluate(node =>
    node.getAttribute('aria-label') === 'Smart путь'));
  check('Smart ancestors are native links and current page is unique', await page.locator('#smart nav').evaluate(node =>
    node.querySelectorAll('a[href]').length >= 2 && node.querySelectorAll('[aria-current="page"]').length === 1));
  check('Smart collapsed action is localized', await page.locator('#smart button[aria-label="Показать скрытые Smart-уровни"]').count() === 1);
  check('Smart home fallback is explicit and accessible', await page.locator('#smart-home').evaluate(host => {
    const first = host.querySelector('a');
    return first?.textContent.includes('Главная') && first.querySelector('sf-icon')?.getAttribute('aria-hidden') === 'true';
  }));

  await page.evaluate(() => document.documentElement.dir = 'rtl');
  check('RTL mirrors separator direction', await page.locator('#ordinary .sf-breadcrumbs-item--separator .sf-icon').first().evaluate(node =>
    getComputedStyle(node).transform !== 'none'));
  await page.evaluate(() => {
    document.documentElement.className = 'theme-dark';
    document.documentElement.style.fontSize = '32px';
  });
  check('dark theme and 200% text preserve viewport containment', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
