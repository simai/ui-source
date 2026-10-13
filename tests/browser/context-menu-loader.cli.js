async page => {
  const url = 'http://127.0.0.1:8766/ui-source/tests/fixtures/context-menu-loader-lab.html';
  const errors = [], failures = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => {
    if (event.type() === 'error') errors.push(event.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => localStorage.clear());
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 800});
    await page.goto(url);
    await page.evaluate(themeName => {
      document.documentElement.className = `theme-${themeName}`;
    }, theme);
    await page.waitForFunction(() => customElements.get('sf-context-menu') && customElements.get('sf-button'));
    await page.waitForFunction(() => document.querySelectorAll('sf-context-menu sf-button button').length === 2);

    const state = await page.evaluate(async () => {
      const host = document.querySelector('sf-context-menu');
      const root = host.querySelector(':scope > .sf-context-menu');
      const buttons = [...host.querySelectorAll('sf-button button')];
      const late = document.createElement('sf-context-menu');
      late.setAttribute('aria-label', 'Поздние действия');
      late.innerHTML = '<button slot="content" type="button">Позднее действие</button>';
      document.querySelector('main').append(late);
      await customElements.whenDefined('sf-context-menu');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const lateButton = late.querySelector('.sf-context-menu-content > button');
      return {
        loader: Boolean(window.SF?.Loader),
        contextDefined: Boolean(customElements.get('sf-context-menu')),
        buttonDefined: Boolean(customElements.get('sf-button')),
        rootPainted: Boolean(root) && getComputedStyle(root).display !== 'inline',
        buttonPainted: buttons.length === 2 && buttons.every(button => getComputedStyle(button).display !== 'inline'),
        menuSemantics: buttons.every(button => button.getAttribute('role') === 'menuitem') && buttons.filter(button => button.tabIndex === 0).length === 1,
        lateUpgrade: Boolean(late.querySelector(':scope > .sf-context-menu')) && lateButton?.getAttribute('role') === 'menuitem',
        localAssetsOnly: performance.getEntriesByType('resource').every(entry => new URL(entry.name).origin === location.origin),
        resources: performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
      };
    });
    const requiredAssets = [
      '/component/context-menu/css/context-menu.css',
      '/smart/context-menu/js/context-menu.js',
      '/component/buttons/css/buttons.css',
      '/smart/buttons/js/buttons.js'
    ];
    state.requiredAssets = requiredAssets.every(fragment => state.resources.some(path => path.endsWith(fragment)));
    const row = {width, theme, ...state};
    if (Object.entries(row).some(([key, value]) => !['width', 'theme', 'resources'].includes(key) && value !== true)) failures.push(row);
    results.push(row);
  }

  return {status: errors.length || failures.length ? 'failed' : 'passed', cases: results.length, errors, failures, results};
}
