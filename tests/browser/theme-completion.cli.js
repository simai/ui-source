async page => {
  const results = [];
  const errors = [];
  const externalRequests = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8767/')) externalRequests.push(request.url());
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.context().clearCookies();
  await page.emulateMedia({colorScheme: 'dark'});
  await page.setViewportSize({width: 1024, height: 800});
  await page.goto('http://127.0.0.1:8767/ui-source/tests/fixtures/theme-method-lab.html');
  await page.waitForFunction(() => window.SF?.Loader?.themePreference === 'system' && document.querySelector('#theme-toggle')?.getAttribute('aria-pressed') === 'true');

  check('early paint follows the dark system preference', await page.evaluate(() => document.documentElement.classList.contains('theme-dark')));
  check('native controls receive the dark color scheme', await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme === 'dark'));
  check('system preference is explicit runtime state', await page.evaluate(() => window.SF.Loader.theme === 'dark' && window.SF.Loader.themePreference === 'system'));

  await page.locator('#theme-toggle').click();
  check('binary toggle persists an explicit light choice', await page.evaluate(() => document.documentElement.classList.contains('theme-light') && document.cookie.includes('sf-theme=light')));
  check('toggle pressed state follows the effective theme', await page.locator('#theme-toggle').getAttribute('aria-pressed') === 'false');
  check('theme event exposes effective and preference values', await page.evaluate(() => window.__themeEvents.some(item => item.theme === 'light' && item.preference === 'light')));

  await page.emulateMedia({colorScheme: 'dark'});
  await page.waitForTimeout(50);
  check('explicit preference ignores later system changes', await page.evaluate(() => window.SF.Loader.theme === 'light' && document.documentElement.classList.contains('theme-light')));

  check('system reset accepts the closed public value', await page.evaluate(() => window.SF.Loader.setTheme('system')));
  check('system reset clears the override and restores dark', await page.evaluate(() => window.SF.Loader.themePreference === 'system' && window.SF.Loader.theme === 'dark' && !document.cookie.includes('sf-theme=')));
  await page.emulateMedia({colorScheme: 'light'});
  await page.waitForFunction(() => window.SF.Loader.theme === 'light');
  check('live media-query changes update system mode', await page.evaluate(() => document.documentElement.classList.contains('theme-light')));

  await page.locator('#mount').click();
  check('late control synchronizes without a private bound attribute', await page.locator('#late-toggle').evaluate(button => button.getAttribute('aria-pressed') === 'false' && ![...button.attributes].some(attribute => attribute.name.includes('bound'))));
  await page.locator('#late-toggle').click();
  check('declarative late control selects dark and synchronizes all toggles', await page.evaluate(() => window.SF.Loader.theme === 'dark' && [...document.querySelectorAll('.sf-theme-button')].every(button => button.getAttribute('aria-pressed') === 'true')));
  check('invalid declarative value performs no fallback action', await page.evaluate(() => {
    const button = document.getElementById('late-toggle');
    button.dataset.theme = 'sepia';
    button.click();
    return window.SF.Loader.theme === 'dark' && window.SF.Loader.themePreference === 'dark';
  }));
  check('unsupported preference fails closed', await page.evaluate(() => window.SF.Loader.setTheme('sepia') === false && window.SF.Loader.theme === 'dark'));

  await page.evaluate(() => {
    document.getElementById('theme-toggle').setAttribute('aria-pressed', 'false');
    document.dispatchEvent(new Event('turbo:load'));
  });
  check('Turbo navigation resynchronizes controls', await page.locator('#theme-toggle').getAttribute('aria-pressed') === 'true');

  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => document.documentElement.dir = 'rtl');
  check('mobile RTL remains bounded', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && getComputedStyle(document.documentElement).direction === 'rtl'));

  await page.context().clearCookies();
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('http://127.0.0.1:8767/ui-source/tests/fixtures/theme-method-lab.html?disabled=1');
  await page.waitForFunction(() => window.SF?.Loader);
  check('disabled boot configuration preserves authored theme and rejects mutation', await page.evaluate(() => document.documentElement.classList.contains('theme-light') && window.SF.Loader.changeTheme() === false));

  await page.context().addCookies([{name: 'sf-theme', value: '%E0%A4%A', url: 'http://127.0.0.1:8767'}]);
  await page.goto('http://127.0.0.1:8767/ui-source/tests/fixtures/theme-method-lab.html');
  await page.waitForFunction(() => window.SF?.Loader?.themePreference === 'system');
  check('malformed stored preference safely falls back to the system', await page.evaluate(() => window.SF.Loader.theme === 'dark' && document.documentElement.classList.contains('theme-dark')));

  check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
  check('no runtime errors', errors.length === 0, errors.join('\n'));
  return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
