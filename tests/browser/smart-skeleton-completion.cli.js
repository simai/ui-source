async page => {
const results = [];
const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const errors = [];
const externalRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error') errors.push(event.text());
});
page.on('request', request => {
  const url = request.url();
  if (!url.startsWith('http://127.0.0.1:8766/')) externalRequests.push(url);
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

await page.setViewportSize({width: 390, height: 844});
await page.emulateMedia({reducedMotion: 'reduce'});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/smart-skeleton-loader-lab.html');
await page.waitForFunction(() => customElements.get('sf-skeleton'));
await page.waitForFunction(() => [...document.querySelectorAll('sf-skeleton')].every(item => item.querySelector('.sf-skeleton')));

check('all initial Smart Skeletons upgrade', await page.locator('sf-skeleton .sf-skeleton').count() === 4);
check('placeholder geometry is hidden from accessibility tree', await page.evaluate(() =>
  [...document.querySelectorAll('sf-skeleton .sf-skeleton')].every(item => item.getAttribute('aria-hidden') === 'true')
));
check('host region owns busy state', await page.locator('#loading-region').getAttribute('aria-busy') === 'true');
check('circle and rounded variants render', await page.evaluate(() =>
  document.querySelector('#avatar .sf-skeleton-circle')
    && document.querySelector('#surface .sf-skeleton-rounded')
));
check('text widths remain relative', await page.evaluate(() => {
  const items = [...document.querySelectorAll('#lines .sf-skeleton-text')];
  return items.length === 3 && items[0].style.inlineSize === '100%'
    && items[1].style.inlineSize === '75%' && items[2].style.inlineSize === '50%';
}));
check('token height resolves', await page.evaluate(() =>
  document.querySelector('#surface .sf-skeleton-text').style.blockSize === 'var(--sf-d6)'
));
check('reduced motion disables pulse and wave', await page.evaluate(() =>
  [...document.querySelectorAll('.sf-skeleton-text')].every(item => getComputedStyle(item).animationName === 'none')
));

await page.locator('#add-skeleton').click();
await page.waitForFunction(() => document.querySelector('#dynamic .sf-skeleton-rounded'));
check('dynamic Smart Skeleton upgrades', await page.locator('#dynamic .sf-skeleton-rounded').count() === 1);

await page.evaluate(() => document.documentElement.className = 'theme-dark');
check('dark theme keeps visible placeholder paint', await page.evaluate(() => {
  const background = getComputedStyle(document.querySelector('#surface .sf-skeleton-text')).backgroundImage;
  return background && background !== 'none';
}));
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
