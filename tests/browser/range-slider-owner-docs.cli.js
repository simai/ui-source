/* global document, getComputedStyle, innerWidth, parent */
// Run against the verified ui-doc build with the exact Range Slider candidate.
async (page) => {
  const url = 'http://127.0.0.1:8902/ru/components/range-slider/';
  const assets = 'http://127.0.0.1:8765/ui-source/source/output/range-owner-browser/component/range-slider';
  const failures = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*.woff2*', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'access-control-allow-origin': '*' },
    });
  });
  await page.route('**/distr/component/range-slider/js/range-slider.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/distr/component/range-slider/css/range-slider.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference', forcedColors: 'none' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await page.evaluate(value => {
        document.documentElement.classList.remove('theme-light', 'theme-dark');
        document.documentElement.classList.add(`theme-${value}`);
      }, theme);

      const examples = page.locator('[data-docara-example]');
      const count = await examples.count();
      if (count !== 7) failures.push({ check: 'example count', width, theme, count });
      const modes = await examples.evaluateAll(nodes => nodes.map(node => ({
        resolved: node.dataset.docaraExamplePreviewResolved,
        iframe: Boolean(node.querySelector('iframe')),
      })));
      if (modes.some(mode => mode.resolved !== 'sandbox' || !mode.iframe)) failures.push({ check: 'sandbox modes', width, theme, modes });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'page overflow', width, theme });

      const frames = [];
      for (let index = 0; index < count; index += 1) {
        const iframe = examples.nth(index).locator('iframe');
        const handle = await iframe.elementHandle();
        const frame = await handle.contentFrame();
        await frame.waitForSelector('.sf-range-slider');
        await frame.addStyleTag({ url: `${assets}/css/range-slider.css` });
        await frame.addScriptTag({ url: `${assets}/js/range-slider.js` });
        await frame.waitForFunction(() => {
          const roots = Array.from(document.querySelectorAll('.sf-range-slider'));
          return roots.length > 0 && roots.every(root => root.noUiSlider);
        }, null, { timeout: 10000 });
        await frame.evaluate(() => parent.postMessage({
          type: 'docara:example-height',
          height: Math.ceil(document.body.getBoundingClientRect().height),
        }, '*'));
        await page.waitForTimeout(50);
        const renderedHandles = await frame.locator('.sf-thumb-handle').evaluateAll(nodes => nodes.map(node => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }));
        if (!renderedHandles.length || renderedHandles.some(rendered => !rendered)) failures.push({ check: 'rendered handles', width, theme, index, renderedHandles });
        frames.push({ frame, iframe });
      }

      const overview = frames[0].frame;
      const overviewHandle = overview.getByRole('slider', { name: 'Громкость', exact: true });
      if (await overviewHandle.getAttribute('aria-valuenow') !== '30') failures.push({ check: 'overview value', width, theme });
      if (await overview.locator('.sf-thumb-text').textContent() !== '30%') failures.push({ check: 'overview visible unit', width, theme });

      const precision = frames[1].frame;
      const precisionValues = await precision.locator('[role="slider"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-valuenow')));
      if (precisionValues.join('|') !== '1.2345|0.002') failures.push({ check: 'precision values', width, theme, precisionValues });
      const precisionLabels = await precision.locator('.sf-thumb-text').allTextContents();
      if (precisionLabels.join('|') !== '1.23 кг|0.002 мг') failures.push({ check: 'precision labels', width, theme, precisionLabels });

      const multiple = frames[2].frame;
      const multipleNames = await multiple.locator('[role="slider"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
      const multipleBounds = await multiple.locator('[role="slider"]').evaluateAll(nodes => nodes.map(node => ({
        min: Number(node.getAttribute('aria-valuemin')),
        max: Number(node.getAttribute('aria-valuemax')),
      })));
      if (multipleNames.join('|') !== 'Минимальная цена|Максимальная цена') failures.push({ check: 'boundary names', width, theme, multipleNames });
      if (multipleBounds[0].max !== 70 || multipleBounds[1].min !== 30) failures.push({ check: 'dependent bounds', width, theme, multipleBounds });

      const labels = frames[3].frame;
      const labelNames = await labels.locator('[role="slider"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
      if (labelNames.join('|') !== 'Готовность|Минимальная скорость|Максимальная скорость') failures.push({ check: 'label example names', width, theme, labelNames });
      const mergedLabels = await labels.locator('.sf-range-slider').nth(1).locator('.sf-tooltip').evaluateAll(nodes => nodes.map(node => ({
        hidden: getComputedStyle(node).display === 'none',
        text: node.textContent.trim(),
      })));
      if (mergedLabels.length !== 2 || !mergedLabels[1].hidden || !mergedLabels[0].text.includes(' – ')) failures.push({ check: 'collision merge', width, theme, mergedLabels });

      const connect = frames[4].frame;
      const connectCounts = await connect.locator('.sf-range-slider').evaluateAll(nodes => nodes.map(node => node.querySelectorAll('.sf-range-slider-progress-line').length));
      if (connectCounts.join('|') !== '1|1|1|0') failures.push({ check: 'connect modes', width, theme, connectCounts });

      const keyboard = frames[5].frame;
      const keyboardHandles = keyboard.locator('[role="slider"]');
      const before = await keyboardHandles.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-valuenow')));
      await keyboardHandles.nth(0).focus();
      await keyboardHandles.nth(0).press('ArrowRight');
      await keyboardHandles.nth(1).focus();
      await keyboardHandles.nth(1).press('ArrowRight');
      const after = await keyboardHandles.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-valuenow')));
      if (Number(after[0]) <= Number(before[0]) || after[1] !== before[1]) failures.push({ check: 'keyboard modes', width, theme, before, after });

      const disabled = frames[6].frame;
      const disabledState = await disabled.locator('.sf-range-slider').evaluate(root => ({
        disabled: root.matches('[disabled]'),
        handleDisabled: root.querySelector('[role="slider"]')?.getAttribute('aria-disabled'),
        tabIndex: root.querySelector('[role="slider"]')?.getAttribute('tabindex'),
      }));
      if (!disabledState.disabled || disabledState.handleDisabled !== 'true' || disabledState.tabIndex !== null) failures.push({ check: 'disabled state', width, theme, disabledState });

      for (const { frame, iframe } of frames) {
        const contract = await iframe.evaluate(node => ({ scrolling: node.getAttribute('scrolling'), height: node.getBoundingClientRect().height }));
        const bodyHeight = await frame.locator('body').evaluate(node => node.scrollHeight);
        if (contract.scrolling !== 'no' || Math.abs(contract.height - bodyHeight) > 2) failures.push({ check: 'intrinsic frame height', width, theme, contract, bodyHeight });
      }
      if (width === 390 && theme === 'light') await page.screenshot({ path: 'output/playwright/range-slider-owner-docs-mobile.png', fullPage: true });
    }
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 4, failures, errors };
}
