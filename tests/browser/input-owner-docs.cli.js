/* global document, getComputedStyle, innerWidth */
// Run against the verified ui-doc build and inject the exact candidate Input assets.
async (page) => {
  const url = 'http://127.0.0.1:8896/ru/components/inputs/';
  const assets = 'http://127.0.0.1:8894';
  const failures = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await page.evaluate(() => document.querySelectorAll('.sf-input').forEach((root) => delete root.dataset.sfInputBound));
      await page.addStyleTag({ url: `${assets}/component-final/component/inputs/css/inputs.css` });
      await page.addScriptTag({ url: `${assets}/component-final/component/inputs/js/inputs.js` });
      await page.evaluate((value) => {
        document.documentElement.classList.remove('theme-light', 'theme-dark');
        document.documentElement.classList.add(`theme-${value}`);
      }, theme);

      const examples = page.locator('[data-docara-example]');
      const count = await examples.count();
      const modes = await examples.evaluateAll((nodes) => nodes.map((node) => ({
        resolved: node.dataset.docaraExamplePreviewResolved,
        reason: node.dataset.docaraExamplePreviewReason,
        iframe: Boolean(node.querySelector('iframe')),
      })));
      if (count !== 6) failures.push({ check: 'example count', width, theme, count });
      if (modes.filter((mode) => mode.resolved === 'inline').length !== 5) failures.push({ check: 'auto inline count', width, theme, modes });
      if (modes.filter((mode) => mode.resolved === 'sandbox').length !== 1) failures.push({ check: 'reference-safe sandbox count', width, theme, modes });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'page horizontal overflow', width, theme });

      const types = await page.locator('[data-docara-example-inline-preview] input').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.type))].sort());
      for (const type of ['email', 'password', 'search', 'tel', 'text']) {
        if (!types.includes(type)) failures.push({ check: 'documented native type', width, theme, type, types });
      }

      const email = page.locator('[data-docara-example-inline-preview] input[type="email"]').first();
      await email.click();
      const pointerShadow = await email.evaluate((input) => getComputedStyle(input.closest('.sf-input-field')).boxShadow);
      if (pointerShadow !== 'none' && !/0px 0px 0px 0px/.test(pointerShadow)) failures.push({ check: 'docs pointer focus', width, theme, pointerShadow });
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const keyboardShadow = await email.evaluate((input) => getComputedStyle(input.closest('.sf-input-field')).boxShadow);
      if (keyboardShadow === 'none') failures.push({ check: 'docs keyboard focus', width, theme, keyboardShadow });

      const maskRoot = page.locator('[data-docara-example-inline-preview] .sf-input[data-mask="true"]');
      await page.waitForFunction(() => Boolean(document.querySelector('[data-docara-example-inline-preview] .sf-input[data-mask="true"]')?.__sfInputMask));
      const maskInput = maskRoot.locator('input');
      await maskInput.fill('9123456789');
      const maskedValue = await maskInput.inputValue();
      if (!maskedValue.includes('(912)') || !maskedValue.endsWith('67-89')) failures.push({ check: 'mask runtime', width, theme, maskedValue });

      const frame = page.locator('iframe[data-docara-example-frame]').first();
      const frameContract = await frame.evaluate((node) => ({ scrolling: node.getAttribute('scrolling'), height: node.getBoundingClientRect().height }));
      if (frameContract.scrolling !== 'no' || frameContract.height <= 32) failures.push({ check: 'sandbox dynamic height', width, theme, frameContract });
      if (width === 390 && theme === 'light') await page.screenshot({ path: 'output/playwright/input-owner-docs-mobile.png', fullPage: true });
    }
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 4, failures, errors };
}
