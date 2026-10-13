async page => {
const results = [];
const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error') errors.push(event.text());
});
page.on('response', response => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

await page.setViewportSize({width: 390, height: 844});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/drawer-loader-lab.html');
await page.waitForFunction(() => customElements.get('sf-drawer'));
await page.waitForTimeout(250);

const modal = page.locator('#settings-drawer');
const modeless = page.locator('#help-drawer');
await page.locator('#open-modal').click();
await page.waitForTimeout(350);

check('concise trigger opens modal', await modal.getAttribute('open') !== null);
check('modal locks page', await page.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden'));
check('modal focus moves inside', await page.evaluate(() => document.querySelector('[data-sf-drawer-id="settings-drawer"] [data-sf-drawer-panel]').contains(document.activeElement)));
check('modal has accessible semantics', await page.evaluate(() => {
  const panel = document.querySelector('[data-sf-drawer-id="settings-drawer"] [data-sf-drawer-panel]');
  return panel?.getAttribute('aria-modal') === 'true' && Boolean(panel?.getAttribute('aria-labelledby'));
}));

await page.locator('#live-action').click();
check('live node listener survives portal move', await page.evaluate(() => window.drawerLab.liveClicks === 1));

await page.keyboard.press('Escape');
await page.waitForTimeout(350);
check('Escape closes modal', await modal.getAttribute('open') === null);
check('focus returns to opener', await page.evaluate(() => document.activeElement?.id === 'open-modal'));
check('page unlocks', await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'));

await page.setViewportSize({width: 1024, height: 768});
await page.locator('#open-modeless').click();
await page.waitForTimeout(350);
check('concise trigger opens modeless', await modeless.getAttribute('open') !== null);
check('modeless leaves page unlocked', await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'));
check('modeless has no scrim or aria-modal', await page.evaluate(() => {
  const root = document.querySelector('[data-sf-drawer-id="help-drawer"]');
  return root?.querySelector('[data-sf-drawer-overlay]')?.hidden === true
    && !root?.querySelector('[data-sf-drawer-panel]')?.hasAttribute('aria-modal');
}));
await page.locator('#page-action').click();
check('page remains pointer-accessible', await page.evaluate(() => document.activeElement?.id === 'page-action'));

await page.evaluate(() => {
  document.documentElement.dir = 'rtl';
  document.documentElement.className = 'theme-dark';
});
await page.setViewportSize({width: 390, height: 844});
await page.waitForTimeout(100);
check('logical end mirrors in RTL', await page.evaluate(() => {
  const panel = document.querySelector('[data-sf-drawer-id="help-drawer"] [data-sf-drawer-panel]');
  const rect = panel?.getBoundingClientRect();
  return rect && rect.left <= 1;
}));
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass)};
}
