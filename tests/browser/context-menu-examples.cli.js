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

  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for (const name of ['buttons', 'context-menu']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['buttons', 'context-menu']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(async ({base, theme, dir}) => {
      document.documentElement.className = `theme-${theme}`;
      document.documentElement.dir = dir;
      const [positions, plain] = await Promise.all([
        fetch(`${base}/examples/context-menu-positions/index.html`).then(response => response.text()),
        fetch(`${base}/examples/context-menu-without-tail/index.html`).then(response => response.text())
      ]);
      document.querySelector('main').innerHTML = `${positions}<div class="p-4">${plain}</div>`;
    }, {base, theme, dir});
    await page.waitForFunction(() => document.querySelectorAll('sf-context-menu > .sf-context-menu').length === 13);
    const state = await page.evaluate(() => {
      const menus = [...document.querySelectorAll('sf-context-menu')];
      const rects = menus.map(menu => menu.getBoundingClientRect());
      return {
        count: menus.length,
        names: menus.every(menu => menu.getAttribute('aria-label')),
        noTail: menus.every(menu => [...menu.querySelectorAll('.sf-context-menu-tooltip')].every(tail => getComputedStyle(tail).display === 'none' && tail.getClientRects().length === 0)),
        horizontalFit: document.documentElement.scrollWidth <= innerWidth && rects.every(rect => rect.left >= -1 && rect.right <= innerWidth + 1),
        readable: menus.every(menu => getComputedStyle(menu.querySelector('.sf-context-menu-content')).color !== 'rgba(0, 0, 0, 0)')
      };
    });
    const row = {width, theme, dir, ...state};
    if (state.count !== 13 || Object.entries(state).some(([key, value]) => key !== 'count' && value !== true)) failures.push(row);
    results.push(row);
    if (dir === 'ltr') await page.screenshot({path: `output/playwright/context-menu-example-${width}-${theme}.png`, fullPage: true});
  }

  return {status: errors.length || failures.length ? 'failed' : 'passed', cases: results.length, errors, failures, results};
}
