/* global customElements, document, getComputedStyle */

async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/button-group-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => customElements.get('sf-button-group') && document.querySelectorAll('#smart button[role="radio"]').length === 3);

  check('ordinary action group keeps three native buttons and tab stops', await page.locator('#actions').evaluate(root =>
    root.getAttribute('role') === 'group'
      && root.querySelectorAll(':scope > button').length === 3
      && [...root.querySelectorAll(':scope > button')].every(button => button.tabIndex === 0 && !button.hasAttribute('aria-pressed'))));
  check('generic group publishes concise orientation data without invalid ARIA', await page.locator('#actions').evaluate(root =>
    root.getAttribute('data-orientation') === 'horizontal' && !root.hasAttribute('aria-orientation')));
  check('legacy vertical input migrates to data orientation and preserves layout', await page.locator('#legacy-vertical').evaluate(root =>
    root.getAttribute('data-orientation') === 'vertical'
      && !root.hasAttribute('aria-orientation')
      && getComputedStyle(root).flexDirection === 'column'));
  check('explicit toolbar keeps supported ARIA orientation', await page.locator('#toolbar').evaluate(root =>
    root.getAttribute('role') === 'toolbar' && root.getAttribute('aria-orientation') === 'horizontal'));
  check('each ordinary group has one continuous perimeter', await page.locator('#actions').evaluate(root => {
    const buttons = [...root.children];
    const first = getComputedStyle(buttons[0]);
    const middle = getComputedStyle(buttons[1]);
    const last = getComputedStyle(buttons[2]);
    return parseFloat(first.borderInlineStartWidth) > 0
      && parseFloat(first.borderInlineEndWidth) > 0
      && parseFloat(middle.borderInlineStartWidth) === 0
      && parseFloat(last.borderInlineStartWidth) === 0
      && parseFloat(last.borderInlineEndWidth) > 0;
  }));

  await page.locator('#dynamic').evaluate(root => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sf-button sf-button--outline sf-button--secondary sf-button--size-1';
    button.innerHTML = '<span class="sf-button-text-container">Третье</span>';
    root.append(button);
  });
  await page.waitForFunction(() => document.querySelector('#dynamic > button:last-child')?.classList.contains('segment-end'));
  check('dynamic direct children receive fresh segment ownership', await page.locator('#dynamic').evaluate(root =>
    root.children[0].classList.contains('segment-start')
      && root.children[1].classList.contains('segment-middle')
      && root.children[2].classList.contains('segment-end')));

  const action = page.locator('#actions > button').nth(1);
  await action.click();
  check('pointer focus does not leave a ring', await action.evaluate(node => getComputedStyle(node).boxShadow === 'none'));
  await page.keyboard.press('Tab');
  await page.locator('#actions > button').first().focus();
  check('keyboard focus is visible inside the joined segment', await page.locator('#actions > button').first().evaluate(node =>
    node.matches(':focus-visible') && getComputedStyle(node).boxShadow !== 'none'));

  check('Smart group exposes exactly one radio per item', await page.locator('#smart').evaluate(host =>
    host.querySelectorAll('button[role="radio"]').length === 3
      && !host.querySelector('sf-button[role="radio"]')));
  check('Smart group owns one selected radio and one enabled tab stop', await page.locator('#smart').evaluate(host =>
    host.querySelectorAll('button[aria-checked="true"]').length === 1
      && host.querySelector('button[aria-checked="true"]')?.getAttribute('data-sf-button-group-value') === 'cards'
      && host.querySelectorAll('button[tabindex="0"]:not(:disabled)').length === 1));
  await page.locator('#smart button[data-sf-button-group-value="cards"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#smart').value === 'list');
  check('Smart arrow navigation skips disabled choices and wraps', await page.locator('#smart').evaluate(host =>
    host.value === 'list' && host.querySelector('button[tabindex="0"]')?.getAttribute('data-sf-button-group-value') === 'list'));
  check('vertical Smart group projects valid orientation', await page.locator('#smart-vertical .sf-button-group').evaluate(root =>
    root.getAttribute('role') === 'radiogroup'
      && root.getAttribute('aria-orientation') === 'vertical'
      && getComputedStyle(root).flexDirection === 'column'));

  await page.evaluate(() => document.documentElement.dir = 'rtl');
  check('RTL and narrow viewport remain contained', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.evaluate(() => {
    document.documentElement.className = 'theme-dark';
    document.documentElement.style.fontSize = '32px';
  });
  check('dark theme and enlarged text preserve usable containment', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
