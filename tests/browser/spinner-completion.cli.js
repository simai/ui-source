async page => {
const results = [];
const errors = [];
const externalRequests = [];
const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});

page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error') errors.push(event.text());
});
page.on('request', request => {
  const url = request.url();
  if (!url.startsWith('http://127.0.0.1:8766/')) externalRequests.push(url);
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

await page.emulateMedia({reducedMotion: 'no-preference'});
await page.setViewportSize({width: 1024, height: 768});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/spinner-method-lab.html');
await page.waitForFunction(() => customElements.get('sf-spinner'));
await page.waitForFunction(() => document.querySelectorAll('sf-spinner .sf-loader-svg').length === 2);

check('announced ordinary spinner exposes a polite status', await page.evaluate(() => {
  const root = document.querySelector('#ordinary-status');
  return root?.getAttribute('role') === 'status'
    && root?.getAttribute('aria-live') === 'polite'
    && root?.getAttribute('aria-atomic') === 'true'
    && !root.hasAttribute('aria-hidden');
}));
check('busy state remains owned by the containing region', await page.evaluate(() => {
  return document.querySelector('#busy-region')?.getAttribute('aria-busy') === 'true'
    && !document.querySelector('#ordinary-status')?.hasAttribute('aria-busy');
}));
check('empty-label spinner is decorative', await page.evaluate(() => {
  const root = document.querySelector('#ordinary-decorative');
  return root?.hasAttribute('aria-hidden') && !root.hasAttribute('role');
}));
check('spinner never enters the focus order', await page.locator('.sf-loader-container[tabindex], sf-spinner[tabindex]').count() === 0);
check('arc and dots SVGs remain decorative', await page.evaluate(() => {
  return [...document.querySelectorAll('.sf-loader-svg')].every(svg => svg.getAttribute('aria-hidden') === 'true');
}));
check('filled dots are represented explicitly', await page.evaluate(() => {
  return document.querySelectorAll('#finite-dots .sf-loader-dot').length === 12
    && document.querySelectorAll('#finite-dots .sf-loader-dot--active').length === 4;
}));
check('finite dots do not repeat', await page.evaluate(() => {
  const dot = document.querySelector('#finite-dots .sf-loader-dot');
  return getComputedStyle(dot).animationIterationCount === '1';
}));
check('infinite Smart dots repeat', await page.evaluate(() => {
  const dot = document.querySelector('#smart-status .sf-loader-dot');
  return getComputedStyle(dot).animationIterationCount === 'infinite';
}));
check('Smart status uses the same accessibility contract', await page.evaluate(() => {
  const root = document.querySelector('#smart-status .sf-loader-container');
  return root?.getAttribute('role') === 'status'
    && root?.textContent?.includes('Синхронизация');
}));
check('invalid Smart size falls back to the normal size', await page.evaluate(() => {
  const root = document.querySelector('#smart-normalized .sf-loader-container');
  return root?.classList.contains('sf-loader--size-1')
    && !root?.classList.contains('sf-loader--size-huge');
}));
check('invalid visual inputs are normalized', await page.evaluate(() => {
  const root = document.querySelector('#smart-normalized .sf-loader-container');
  return root?.querySelector('.sf-loader--loading-indicator')
    && !root.querySelector('.sf-loader--circles');
}));

await page.locator('#add-spinner').click();
await page.waitForFunction(() => document.querySelector('#dynamic-spinner .sf-loader-svg'));
check('late Smart spinner upgrades through Loader', await page.locator('#dynamic-spinner .sf-loader-svg').count() === 1);

await page.emulateMedia({reducedMotion: 'reduce'});
check('reduced motion keeps a static visible indicator', await page.evaluate(() => {
  const accent = document.querySelector('#ordinary-status .sf-loader-ring-accent');
  const style = getComputedStyle(accent);
  return style.animationName === 'none' && style.strokeDasharray !== '0px, 100px';
}));

await page.evaluate(() => document.documentElement.className = 'theme-dark');
check('dark theme retains semantic indicator paint', await page.evaluate(() => {
  const accent = document.querySelector('#ordinary-status .sf-loader-ring-accent');
  return getComputedStyle(accent).stroke !== 'none';
}));
await page.setViewportSize({width: 390, height: 844});
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
