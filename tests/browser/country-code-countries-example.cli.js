async page => {
  await page.route('**/*', route => route.continue());
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const results = [], failures = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const mode of ['base', 'smart']) for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 850});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url: `${base}/component/country-code/css/country-code.css`});
    await page.addScriptTag({url: 'http://127.0.0.1:8765/ui-source/node_modules/imask/dist/imask.min.js'});
    await page.evaluate(() => {window.SF = {Mask: {create: async (e, o) => IMask(e, o), destroy: m => m?.destroy()}};});
    for (const layer of ['component', 'smart']) await page.addScriptTag({url: `${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(async ({base, theme, mode}) => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch(`${base}/examples/country-code-countries-${mode}.html`);
      if (!response.ok) throw Error('Missing actual draft example');
      const main = document.querySelector('main'); main.innerHTML = await response.text();
      for (const script of [...main.querySelectorAll('script')]) {const live = document.createElement('script'); live.textContent = script.textContent; script.replaceWith(live);}
    }, {base, theme, mode});
    await page.waitForFunction(() => {
      const root = document.querySelector('.sf-country-code');
      return root?.__sfCountryMask?.masked.mask === '+49 000 0000000' && root.querySelectorAll('.sf-country-code-item').length === 2;
    });
    const initial = await page.locator('input').inputValue();
    await page.locator('.sf-country-code-left').click();
    await page.locator('.sf-country-code-item[data-iso2="RU"]').click();
    await page.waitForFunction(() => document.querySelector('.sf-country-code').__sfCountryMask?.masked.mask === '+7 000 000-00-00');
    const row = await page.locator('.sf-country-code').evaluate(root => ({
      iso2: root.dataset.iso2, value: root.querySelector('input').value,
      name: root.querySelector('.sf-country-code-left').getAttribute('aria-label'),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    if (initial !== '+49 151 1234567' || row.iso2 !== 'RU' || row.value !== '+7 151 123-45-67' || !row.name.includes('Россия') || row.overflow) failures.push({mode, width, theme, initial, ...row});
    await page.locator('.sf-country-code-left').click();
    await page.evaluate(async () => {
      await document.fonts.load('24px "Material Symbols Outlined"');
      document.querySelectorAll('main .sf-icon').forEach(node => node.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
    });
    await page.screenshot({path: `output/playwright/country-code-countries-${mode}-${width}-${theme}.png`, fullPage: true});
    results.push({mode, width, theme, initial, ...row});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
