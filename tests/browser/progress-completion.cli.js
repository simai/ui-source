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
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/progress-method-lab.html');
await page.waitForFunction(() => customElements.get('sf-progress-bar') && customElements.get('sf-progress-scale'));
await page.waitForFunction(() => document.querySelector('#smart-scale .sf-progress-scale'));

check('ordinary Progress Bar exposes an exact named range', await page.evaluate(() => {
  const root = document.querySelector('#ordinary-bar');
  return root?.getAttribute('role') === 'progressbar'
    && root.getAttribute('aria-label') === 'Загрузка файлов'
    && root.getAttribute('aria-valuenow') === '37'
    && root.getAttribute('aria-valuemin') === '0'
    && root.getAttribute('aria-valuemax') === '100';
}));
check('busy state remains owned by the containing region', await page.evaluate(() => {
  return document.querySelector('#busy-region')?.getAttribute('aria-busy') === 'true'
    && !document.querySelector('#ordinary-bar')?.hasAttribute('aria-busy');
}));
check('ordinary fill matches the normalized continuous value', await page.evaluate(() => {
  const root = document.querySelector('#ordinary-bar');
  return root?.querySelector('.sf-progress-bar-progress')?.style.width === '37%'
    && root.querySelector('.sf-progress-bar-text')?.textContent === '37%';
}));
check('Progress Scale retains exact value and rounds only visual segments', await page.evaluate(() => {
  const root = document.querySelector('#ordinary-scale');
  const filled = [...root.querySelectorAll('.sf-progress-scale-block')]
    .filter(block => getComputedStyle(block).backgroundColor !== getComputedStyle(root.querySelector('.sf-progress-scale-block:last-child')).backgroundColor);
  return root.getAttribute('aria-valuenow') === '45'
    && root.classList.contains('sf-progress-scale--50')
    && root.querySelector('.sf-progress-scale-text')?.textContent === '45%'
    && filled.length === 5;
}));
check('percentage does not infer semantic tone', await page.evaluate(() => {
  const root = document.querySelector('#ordinary-scale');
  return root.classList.contains('sf-progress-scale--primary')
    && !root.classList.contains('sf-progress-scale--error')
    && !root.classList.contains('sf-progress-scale--success');
}));
check('Smart value text supplements the numeric value', await page.evaluate(() => {
  const bar = document.querySelector('#smart-bar .sf-progress-bar');
  const scale = document.querySelector('#smart-scale .sf-progress-scale');
  return bar?.getAttribute('aria-valuenow') === '62'
    && bar.getAttribute('aria-valuetext') === '31 из 50 записей'
    && scale?.getAttribute('aria-valuenow') === '63'
    && scale.getAttribute('aria-valuetext') === 'Этап 7 из 10';
}));
check('semantic tone is explicit for both presentations', await page.evaluate(() => {
  return document.querySelector('#smart-bar .sf-progress-bar')?.classList.contains('sf-progress-bar--success')
    && document.querySelector('#smart-scale .sf-progress-scale')?.classList.contains('sf-progress-scale--warning');
}));
check('invalid public values normalize to documented defaults', await page.evaluate(() => {
  const bar = document.querySelector('#normalized-bar .sf-progress-bar');
  const scale = document.querySelector('#normalized-scale .sf-progress-scale');
  return bar?.getAttribute('aria-valuenow') === '100'
    && bar.classList.contains('sf-progress-bar--size-1')
    && bar.classList.contains('sf-progress-bar--primary')
    && scale?.getAttribute('aria-valuenow') === '0'
    && scale.classList.contains('sf-progress-scale--size-1')
    && scale.classList.contains('sf-progress-scale--primary')
    && scale.querySelector('.sf-progress-scale-text')?.hidden;
}));
check('Progress indicators never enter the focus order', await page.locator('[role="progressbar"][tabindex], sf-progress-bar[tabindex], sf-progress-scale[tabindex]').count() === 0);

await page.evaluate(() => {
  window.SF.ProgressBar.setState(document.querySelector('#ordinary-bar'), {value: 58, textPosition: 'bottom'});
  window.SF.ProgressScale.setState(document.querySelector('#ordinary-scale'), {value: 71, tone: 'error'});
  document.querySelector('#smart-bar').setProgress(73);
  document.documentElement.dir = 'rtl';
});
await page.waitForTimeout(100);
check('ordinary and Smart update APIs synchronize accessible value', await page.evaluate(() => {
  return document.querySelector('#ordinary-bar')?.getAttribute('aria-valuenow') === '58'
    && document.querySelector('#ordinary-scale')?.getAttribute('aria-valuenow') === '71'
    && document.querySelector('#smart-bar .sf-progress-bar')?.getAttribute('aria-valuenow') === '73';
}));
check('RTL fill begins at logical inline start', await page.evaluate(() => {
  const track = document.querySelector('#ordinary-bar .sf-progress-bar-main').getBoundingClientRect();
  const fill = document.querySelector('#ordinary-bar .sf-progress-bar-progress').getBoundingClientRect();
  return Math.abs(track.right - fill.right) < 1;
}));

await page.locator('#add-progress').click();
await page.waitForFunction(() => document.querySelector('#dynamic-progress .sf-progress-scale'));
check('late Smart progress upgrades through Loader', await page.locator('#dynamic-progress [role="progressbar"]').count() === 1);

await page.emulateMedia({reducedMotion: 'reduce'});
check('reduced motion makes value changes immediate', await page.evaluate(() => {
  const fill = document.querySelector('#ordinary-bar .sf-progress-bar-progress');
  return getComputedStyle(fill).transitionDuration === '0s';
}));
await page.evaluate(() => document.documentElement.className = 'theme-dark');
check('dark theme retains visible track and fill', await page.evaluate(() => {
  const track = getComputedStyle(document.querySelector('#ordinary-bar .sf-progress-bar-main')).backgroundColor;
  const fill = getComputedStyle(document.querySelector('#ordinary-bar .sf-progress-bar-progress')).backgroundColor;
  return track !== fill && fill !== 'rgba(0, 0, 0, 0)';
}));
await page.setViewportSize({width: 390, height: 844});
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
