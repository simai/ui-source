// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/modal-loader-lab.html');
  for (const name of ['buttons', 'context-menu']) {
    await page.addStyleTag({url: `http://127.0.0.1:8891/component/component/${name}/css/${name}.css`});
  }
  for (const name of ['button', 'context-menu']) {
    await page.addScriptTag({url: `http://127.0.0.1:8891/smart/smart/${name}/js/${name}.js`});
  }
  await page.evaluate(() => {
    const main = document.querySelector('main');
    main.innerHTML = '<button id="before">До меню</button><sf-context-menu position="bottom-inline-start" aria-label="Действия с документом"></sf-context-menu><button id="after">После меню</button>';
    window.contextActions = 0;
    main.querySelector('sf-context-menu').items = ['Открыть', 'Недоступно', 'Сохранить'].map((text, index) => ({
      component: 'sf-button',
      props: {text, type: 'link', scheme: 'on-surface', disabled: index === 1, '@click': () => window.contextActions++}
    }));
  });
  await page.waitForFunction(() => document.querySelectorAll('sf-context-menu sf-button button').length === 3);
  const menu = page.locator('sf-context-menu');
  const buttons = menu.locator('sf-button button');
  check('Smart root has required accessible menu name', await page.getByRole('menu', {name: 'Действия с документом', exact: true}).count() === 1);
  check('native actions receive menuitem semantics and one roving tab stop', await buttons.evaluateAll(nodes => nodes.every(node => node.getAttribute('role') === 'menuitem') && nodes.filter(node => node.tabIndex === 0).length === 1));
  await buttons.first().focus();
  await page.keyboard.press('ArrowDown');
  check('ArrowDown skips disabled item', await buttons.nth(2).evaluate(node => node === document.activeElement));
  await page.keyboard.press('ArrowDown');
  check('ArrowDown wraps', await buttons.first().evaluate(node => node === document.activeElement));
  await page.keyboard.press('End');
  check('End moves to last available item', await buttons.nth(2).evaluate(node => node === document.activeElement));
  await page.keyboard.press('Home');
  check('Home moves to first available item', await buttons.first().evaluate(node => node === document.activeElement));
  await page.keyboard.press('Enter');
  check('native activation remains owned by the action', await page.evaluate(() => window.contextActions === 1));
  await page.keyboard.press('Tab');
  check('Tab leaves the composite menu for host-owned dismissal', await page.locator('#after').evaluate(node => node === document.activeElement));
  check('surface keeps the required relative wrapper and renders no tail', await menu.evaluate(host => Boolean(host.querySelector(':scope > .sf-context-menu > .relative > .sf-context-menu-content')) && !host.querySelector('.sf-context-menu-tooltip')));

  await page.evaluate(() => document.documentElement.dir = 'rtl');
  check('preferred logical position remains direction-neutral in RTL', await menu.evaluate(host => host.position === 'bottom-inline-start'));
  check('menu fits the viewport', await menu.evaluate(host => {
    const rect = host.querySelector('.sf-context-menu').getBoundingClientRect();
    // Root overflow sub-check dropped: it guarded tail clipping, no tail since 2026-10-12.
    return rect.left >= 0 && rect.right <= innerWidth;
  }));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
