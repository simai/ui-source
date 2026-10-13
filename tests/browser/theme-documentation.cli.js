async page => {
  const results = [];
  const errors = [];
  const externalRequests = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8878/')) externalRequests.push(request.url());
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('http://127.0.0.1:8878/ru/components/theme/');
  await page.waitForTimeout(500);

  const examples = page.locator('[data-docara-example]');
  check('two reusable examples are rendered', await examples.count() === 2);
  check('Theme examples explicitly isolate their independent document state', await examples.locator('iframe').count() === 2 && await examples.evaluateAll(nodes => nodes.every(node => node.dataset.docaraExamplePreviewResolved === 'sandbox')));
  const exampleFrames = page.frames().filter(frame => frame !== page.mainFrame());
  const firstFrame = exampleFrames[0];
  const preferenceFrame = exampleFrames[1];
  check('toggle example exposes a native named pressed control', await firstFrame.locator('.sf-theme-button').evaluate(button => button.tagName === 'BUTTON' && button.getAttribute('aria-label') === 'Тёмная тема' && button.hasAttribute('aria-pressed')));
  check('preference example exposes exactly three closed choices', await preferenceFrame.locator('body').evaluate(node => {
    const values = [...node.querySelectorAll('[data-theme]')].map(control => control.dataset.theme).sort();
    return JSON.stringify(values) === JSON.stringify(['dark', 'light', 'system']);
  }));
  await firstFrame.waitForFunction(() => window.SF?.Loader?.themePreference);
  const beforeToggle = await firstFrame.evaluate(() => window.SF.Loader.theme);
  await firstFrame.locator('.sf-theme-button').click();
  check('isolated toggle changes only its document theme', await firstFrame.evaluate(before => window.SF.Loader.theme !== before, beforeToggle) && await page.evaluate(() => window.SF_BOOT_CONFIG.theme === false));
  await preferenceFrame.waitForFunction(() => window.SF?.Loader?.themePreference);
  await preferenceFrame.locator('[data-theme="dark"]').click();
  check('isolated closed preference applies dark', await preferenceFrame.evaluate(() => window.SF.Loader.theme === 'dark' && document.documentElement.classList.contains('theme-dark')));
  await preferenceFrame.locator('[data-theme="system"]').click();
  check('isolated closed preference returns to system mode', await preferenceFrame.evaluate(() => window.SF.Loader.themePreference === 'system'));
  check('HTML and the required sandbox setup are both visible', await examples.evaluateAll(nodes => nodes.every(node => {
    const labels = [...node.querySelectorAll('[role="tab"]')].map(tab => tab.textContent.trim());
    return labels.includes('HTML') && labels.includes('JavaScript');
  })));

  await page.setViewportSize({width: 390, height: 844});
  check('documentation remains bounded on mobile', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
  check('no runtime errors', errors.length === 0, errors.join('\n'));
  return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
