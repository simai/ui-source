async page => {
const results = [];
const errors = [];
const externalRequests = [];
const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
page.on('request', request => {
  if (!request.url().startsWith('http://127.0.0.1:8766/')) externalRequests.push(request.url());
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {origin: 'http://127.0.0.1:8766'});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/clipboard-method-lab.html');
await page.waitForFunction(() => document.querySelector('#target-copy')?.dataset.sfCopyBound === 'true');

await page.locator('#target-copy').focus();
await page.locator('#target-copy').click();
await page.waitForFunction(() => document.querySelector('#target-copy')?.dataset.copyState === 'success');
check('target text copies through the native API', await page.evaluate(async () => {
  return (await navigator.clipboard.readText()) === 'npm install @simai/ui'
    && copyEvents.at(-1)?.detail.method === 'native';
}));
check('success uses a separate status and preserves focus and action name', await page.evaluate(() => {
  const button = document.querySelector('#target-copy');
  return button.nextElementSibling?.getAttribute('role') === 'status'
    && button.nextElementSibling.textContent === 'Команда скопирована'
    && button.getAttribute('aria-label') === 'Копировать команду'
    && document.activeElement === button;
}));

await page.evaluate(() => {
  navigator.clipboard.writeText = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
});
await page.locator('#denied-copy').click();
check('permission rejection reports a stable typed failure', await page.evaluate(() => {
  return copyEvents.at(-1)?.type === 'error'
    && copyEvents.at(-1)?.detail.code === 'copy_denied'
    && document.querySelector('#denied-copy').nextElementSibling?.textContent === 'Браузер запретил копирование';
}));

await page.evaluate(() => {
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});
  document.execCommand = command => command === 'copy';
});
await page.locator('#direct-copy').click();
await page.waitForFunction(() => document.querySelector('#direct-copy')?.dataset.copyState === 'success');
check('legacy fallback copies the explicit exact value', await page.evaluate(() => {
  return copyEvents.at(-1)?.type === 'success'
    && copyEvents.at(-1)?.detail.method === 'legacy'
    && copyEvents.at(-1)?.detail.text === 'точное значение';
}));

await page.locator('#ambiguous-copy').click();
check('ambiguous source fails closed', await page.evaluate(() => copyEvents.at(-1)?.detail.code === 'ambiguous_source'));
await page.locator('#missing-copy').click();
check('missing target reports a typed failure', await page.evaluate(() => copyEvents.at(-1)?.detail.code === 'missing_target'));
check('failure remains a visible polite status', await page.evaluate(() => {
  const status = document.querySelector('#missing-copy').nextElementSibling;
  return status?.getAttribute('role') === 'status' && status.textContent === 'Источник не найден';
}));

await page.locator('#add-copy').click();
await page.waitForFunction(() => document.querySelector('#dynamic-copy')?.dataset.sfCopyBound === 'true');
check('late action initializes exactly once', await page.evaluate(() => {
  const button = document.querySelector('#dynamic-copy');
  return Boolean(button._sfCopyController) && button.parentElement.querySelectorAll('#dynamic-copy + .sf-clipboard-status').length === 1;
}));
await page.emulateMedia({reducedMotion: 'reduce'});
check('reduced motion removes the Clipboard surface transition', await page.evaluate(() => getComputedStyle(document.querySelector('#surface-copy')).transitionDuration === '0s'));
await page.evaluate(() => document.documentElement.className = 'theme-dark');
check('dark theme keeps the primary action visible', await page.evaluate(() => {
  const style = getComputedStyle(document.querySelector('#direct-copy'));
  return style.backgroundColor !== style.color && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
}));
await page.setViewportSize({width: 390, height: 844});
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));
return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
