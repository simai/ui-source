// Run against a verified ui-doc build, injecting the exact candidate owner assets.
async (page) => {
  const docs = 'http://127.0.0.1:8893/ru/components';
  const assets = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/component';
  const expectedExamples = { radio: 4, switch: 3, toggle: 4 };
  const results = [];
  const failures = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      for (const kind of ['radio', 'switch', 'toggle']) {
        await page.goto(`${docs}/${kind}/`);
        await page.addStyleTag({ url: `${assets}/${kind}/css/${kind}.css` });
        await page.addScriptTag({ url: `${assets}/${kind}/js/${kind}.js` });
        await page.evaluate((value) => {
          document.documentElement.classList.remove('theme-light', 'theme-dark');
          document.documentElement.classList.add(`theme-${value}`);
        }, theme);

        const examples = page.locator('[data-docara-example]');
        const count = await examples.count();
        const previewModes = await examples.evaluateAll((nodes) => nodes.map((node) => ({
          requested: node.dataset.docaraExamplePreviewRequested,
          resolved: node.dataset.docaraExamplePreviewResolved,
          iframe: Boolean(node.querySelector('iframe')),
        })));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        if (count !== expectedExamples[kind]) failures.push({ kind, width, theme, check: 'example count', count });
        if (previewModes.some((mode) => mode.resolved !== 'inline' || mode.iframe)) failures.push({ kind, width, theme, check: 'auto inline previews', previewModes });
        if (overflow) failures.push({ kind, width, theme, check: 'page horizontal overflow' });

        if (kind === 'radio') {
          const font = page.locator('.sf-radio-button--type-font .sf-radio-text');
          const visual = await font.first().evaluate((element) => {
            const style = getComputedStyle(element);
            return { display: style.display, width: parseFloat(style.width), height: parseFloat(style.height) };
          });
          if (visual.display !== 'grid' || visual.width <= 0 || visual.height <= 0) failures.push({ kind, width, theme, check: 'font visual contract', visual });
          const fontInputs = page.locator('.sf-radio-wrap--type-font input[type="radio"]');
          const names = await fontInputs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
          if (names.some((name) => !name)) failures.push({ kind, width, theme, check: 'font accessible names', names });
          await fontInputs.nth(1).click();
          const description = await page.locator('.sf-radio-wrap--type-font .sf-radio-button-description').textContent();
          if (description?.trim() !== 'Среднее начертание') failures.push({ kind, width, theme, check: 'font description projection', description });
        } else {
          const switches = page.locator('[data-docara-example-inline-preview] [role="switch"]');
          if (await switches.count() === 0) failures.push({ kind, width, theme, check: 'native switch role' });
          const first = switches.first();
          const before = await first.isChecked();
          await first.click();
          if (await first.isChecked() === before) failures.push({ kind, width, theme, check: 'native interaction' });
        }

        results.push({ kind, width, theme, count, previewModes, overflow });
        if (width === 390 && theme === 'light') {
          await page.screenshot({ path: `output/playwright/selection-docs-${kind}-mobile.png`, fullPage: true });
        }
      }
    }
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: results.length,
    results,
    failures,
    errors,
  };
}
