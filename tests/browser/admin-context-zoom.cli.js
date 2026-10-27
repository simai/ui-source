async page => {
  const base = 'http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const errors = [], failures = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => {
    if (event.type() === 'error') errors.push(event.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  const cdp = await page.context().newCDPSession(page);

  for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
    await cdp.send('Emulation.setPageScaleFactor', {pageScaleFactor: 1});
    await page.setViewportSize({width: 1280, height: 900});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for (const name of ['buttons', 'context-menu', 'admin-menu', 'icons', 'icon-buttons', 'inputs', 'badges']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['buttons', 'context-menu', 'icons', 'icon-buttons', 'input', 'badges', 'admin-menu']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(async ({base, theme, dir}) => {
      document.documentElement.className = `theme-${theme}`;
      document.documentElement.dir = dir;
      document.querySelector('main').innerHTML = await (await fetch(`${base}/examples/admin-context-menu/index.html`)).text();
    }, {base, theme, dir});
    await page.getByRole('button', {name: 'Настройки меню', exact: true}).click();
    await page.getByRole('button', {name: 'Личные настройки', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('sf-context-menu')?.contains(document.activeElement));

    await cdp.send('Emulation.setPageScaleFactor', {pageScaleFactor: 2});
    await page.waitForFunction(() => visualViewport?.scale === 2);
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => {
      const viewport = visualViewport;
      const root = document.querySelector('sf-context-menu .sf-context-menu');
      const rect = root.getBoundingClientRect();
      const ruler = document.createElement('i');
      ruler.style.cssText = 'position:fixed;inline-size:var(--sf-context-menu-viewport-space);block-size:0';
      root.append(ruler);
      const viewportSpace = ruler.getBoundingClientRect().width;
      ruler.remove();
      return {
        scale: viewport.scale,
        narrowed: viewport.width < innerWidth && viewport.height < innerHeight,
        fitsInline: rect.left >= viewport.offsetLeft + viewportSpace - 1 && rect.right <= viewport.offsetLeft + viewport.width - viewportSpace + 1,
        fitsBlock: rect.top >= viewport.offsetTop + viewportSpace - 1 && rect.bottom <= viewport.offsetTop + viewport.height - viewportSpace + 1,
        focusPreserved: document.querySelector('sf-context-menu').contains(document.activeElement)
      };
    });
    const row = {theme, dir, ...state};
    if (state.scale !== 2 || Object.entries(state).some(([key, value]) => key !== 'scale' && value !== true)) failures.push(row);
    results.push(row);
  }

  await cdp.send('Emulation.setPageScaleFactor', {pageScaleFactor: 1});
  return {status: errors.length || failures.length ? 'failed' : 'passed', cases: results.length, errors, failures, results};
}
