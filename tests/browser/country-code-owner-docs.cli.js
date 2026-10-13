/* global customElements, document, fetch, getComputedStyle, innerWidth, TextDecoder, window */
async page => {
  const workspace = 'http://127.0.0.1:8765';
  const productBase = `${workspace}/ui-source/source/output/action-focus-browser`;
  const examplesBase = `${workspace}/ui-doc/examples/components/country-code`;
  // The Smart overview moved to smart-components/ with the Smart pages (ui-doc 5b299228).
  const exampleUrlOf = (id) => id === 'smart-overview'
    ? `${workspace}/ui-doc/examples/smart-components/country-code/overview/index.html`
    : `${examplesBase}/${id}/index.html`;
  const siteBase = 'http://127.0.0.1:8927';
  const failures = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors.push(message.text());
  });

  const loadExample = async (id, smart = false) => {
    const exampleUrl = exampleUrlOf(id);
    await page.goto(workspace);
    const markup = await page.evaluate(async url => {
      const response = await fetch(url);
      return new TextDecoder('utf-8').decode(await response.arrayBuffer());
    }, exampleUrl);
    await page.setContent(`<meta charset="utf-8">${markup}`);
    await page.evaluate(base => {
      window.sfPath = `${base}/`;
      window.sfSmartPath = `${base}/smart/`;
    }, productBase);
    await page.addStyleTag({url: `${productBase}/core/css/core.css`});
    await page.addStyleTag({url: `${productBase}/core/css/utility.full.css`});
    await page.addStyleTag({url: `${productBase}/component/country-code/css/country-code.css`});
    await page.addScriptTag({url: `${productBase}/${smart ? 'smart' : 'component'}/country-code/js/country-code.js`});
    if (smart) {
      await page.waitForFunction(() => customElements.get('sf-country-code') && [...document.querySelectorAll('sf-country-code')].every(host => host.querySelector('.sf-country-code')));
    } else {
      await page.waitForFunction(() => [...document.querySelectorAll('.sf-country-code')].every(root => root.__sfCountryCodeInput));
    }
  };

  const checkDocumentationPage = async (route, count, screenshot, expectedSelector = null) => {
    await page.goto(`${siteBase}${route}`);
    await page.waitForFunction(expected => document.querySelectorAll('iframe[data-docara-example-frame]').length === expected, count);
    const rows = [];
    const iframes = page.locator('iframe[data-docara-example-frame]');
    for (let index = 0; index < count; index += 1) {
      const frame = page.frames()[index + 1];
      await frame.waitForFunction(() => document.documentElement.dataset.docaraExampleReady === 'true');
      if (expectedSelector) await frame.locator(expectedSelector).first().waitFor();
      const content = await frame.evaluate(() => ({height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth, viewportWidth: innerWidth}));
      const box = await iframes.nth(index).boundingBox();
      const scrolling = await iframes.nth(index).getAttribute('scrolling');
      rows.push({index, content, box, scrolling});
      if (!box || scrolling !== 'no' || box.height + 2 < content.height || content.width > content.viewportWidth + 1) {
        failures.push({route, reason: 'example frame does not fit content', index, content, box, scrolling});
      }
    }
    await page.screenshot({path: screenshot, fullPage: true});
    return rows;
  };

  await page.setViewportSize({width: 1280, height: 900});
  await checkDocumentationPage('/ru/components/country-code/', 6, 'output/playwright/country-code-owner-docs-ordinary.png', '.sf-country-code');
  await checkDocumentationPage('/ru/smart-components/reference/country-code/', 6, 'output/playwright/country-code-owner-docs-smart.png');

  await loadExample('overview');
  await page.locator('.sf-country-code-left').click();
  const ordinary = await page.locator('.sf-country-code').evaluate(root => ({
    button: root.querySelector('.sf-country-code-left')?.getAttribute('role'),
    expanded: root.querySelector('.sf-country-code-left')?.getAttribute('aria-expanded'),
    inputSize: getComputedStyle(root.querySelector('input')).fontSize,
    options: root.querySelectorAll('[role="option"]').length,
  }));
  if (ordinary.button !== 'button' || ordinary.expanded !== 'true' || ordinary.inputSize !== '16px' || ordinary.options < 200) failures.push({reason: 'ordinary overview contract', ordinary});

  await loadExample('form');
  await page.locator('button[type="submit"]').click();
  if (!String(await page.locator('output').textContent()).includes('+7')) failures.push({reason: 'ordinary FormData example'});

  await loadExample('countries');
  await page.locator('.sf-country-code-left').click();
  if (await page.locator('[role="option"]').count() !== 2) failures.push({reason: 'ordinary custom countries count'});
  await page.locator('[role="option"][data-iso2="RU"]').click();
  if (await page.locator('.sf-country-code').getAttribute('data-iso2') !== 'RU') failures.push({reason: 'ordinary custom country selection'});

  await loadExample('smart-overview', true);
  if (await page.locator('.sf-country-code input').evaluate(input => getComputedStyle(input).fontSize) !== '16px') failures.push({reason: 'Smart default typography'});
  await page.screenshot({path: 'output/playwright/country-code-owner-smart-source.png', fullPage: true});
  await loadExample('smart-modes', true);
  if (await page.locator('.sf-country-code').count() !== 2) failures.push({reason: 'Smart modes example'});
  await loadExample('smart-sizes', true);
  if (await page.locator('.sf-country-code').count() !== 5) failures.push({reason: 'Smart sizes example'});
  await loadExample('smart-form', true);
  await page.locator('button[type="submit"]').click();
  if (!String(await page.locator('output').textContent()).includes('+7')) failures.push({reason: 'Smart FormData example'});
  await loadExample('smart-countries', true);
  await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length === 2);
  await page.locator('.sf-country-code-left').click();
  await page.locator('[role="option"][data-iso2="RU"]').click();
  if (await page.locator('.sf-country-code').getAttribute('data-iso2') !== 'RU') failures.push({reason: 'Smart custom country selection'});
  await loadExample('smart-customization', true);
  await page.locator('button').click();
  if (!(await page.locator('.sf-country-code').getAttribute('class')).includes('bg-surface-2')) failures.push({reason: 'Smart utility customization'});

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: 11,
    checks: 28,
    projectionGap: 'The pinned ui-doc Smart asset projection does not yet include sf-country-code; documentation structure and exact source examples were accepted separately.',
    failures,
    errors,
  };
}
