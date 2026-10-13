/* global document, getComputedStyle, innerWidth */
// Run against the verified ui-doc build and inject the exact candidate Textarea and resize assets.
async (page) => {
  const url = 'http://127.0.0.1:8899/ru/components/textarea/';
  const assets = 'http://127.0.0.1:8897';
  const failures = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await page.evaluate(() => document.querySelectorAll('.sf-textarea').forEach((root) => delete root.dataset.sfTextareaBound));
      await page.addStyleTag({ url: `${assets}/utility/utility/resize/default/css/default.css` });
      await page.addStyleTag({ url: `${assets}/component-final/component/textarea/css/textarea.css` });
      await page.addScriptTag({ url: `${assets}/component-final/component/textarea/js/textarea.js` });
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
      if (count !== 7) failures.push({ check: 'example count', width, theme, count });
      if (modes.filter((mode) => mode.resolved === 'inline').length !== 6) failures.push({ check: 'auto inline count', width, theme, modes });
      if (modes.filter((mode) => mode.resolved === 'sandbox').length !== 1) failures.push({ check: 'ARIA sandbox count', width, theme, modes });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'page horizontal overflow', width, theme });

      const metadata = await page.locator('[data-docara-example-inline-preview] textarea[name="description"]').evaluate((textarea) => ({
        minLength: textarea.minLength,
        maxLength: textarea.maxLength,
        spellcheck: textarea.spellcheck,
        wrap: textarea.wrap,
        resize: getComputedStyle(textarea).resize,
      }));
      if (JSON.stringify(metadata) !== JSON.stringify({ minLength: 20, maxLength: 500, spellcheck: true, wrap: 'soft', resize: 'vertical' })) failures.push({ check: 'documented native metadata', width, theme, metadata });

      const textarea = page.locator('[data-docara-example-inline-preview] textarea[name="comment"]');
      await textarea.click();
      const pointerShadow = await textarea.evaluate((node) => getComputedStyle(node).boxShadow);
      if (pointerShadow !== 'none' && !/0px 0px 0px 0px/.test(pointerShadow)) failures.push({ check: 'docs pointer focus', width, theme, pointerShadow });
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const keyboardShadow = await textarea.evaluate((node) => getComputedStyle(node).boxShadow);
      if (keyboardShadow === 'none') failures.push({ check: 'docs keyboard focus', width, theme, keyboardShadow });

      const resizeModes = await page.locator('[data-docara-example-inline-preview] textarea.resize-y, [data-docara-example-inline-preview] textarea.resize-none').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).resize));
      if (JSON.stringify(resizeModes) !== JSON.stringify(['vertical', 'none'])) failures.push({ check: 'resize utility examples', width, theme, resizeModes });

      const maskRoot = page.locator('[data-docara-example-inline-preview] .sf-textarea[data-mask="true"]');
      await page.waitForFunction(() => Boolean(document.querySelector('[data-docara-example-inline-preview] .sf-textarea[data-mask="true"]')?.__sfTextareaMask));
      const maskTextarea = maskRoot.locator('textarea');
      await maskTextarea.fill('1234567890123456');
      const maskedValue = await maskTextarea.inputValue();
      if (!maskedValue.includes('1234-5678') || !maskedValue.includes('9012-3456')) failures.push({ check: 'mask runtime', width, theme, maskedValue });

      const frame = page.locator('iframe[data-docara-example-frame]').first();
      const frameContract = await frame.evaluate((node) => ({ scrolling: node.getAttribute('scrolling'), height: node.getBoundingClientRect().height }));
      if (frameContract.scrolling !== 'no' || frameContract.height <= 32) failures.push({ check: 'sandbox dynamic height', width, theme, frameContract });
      const frameHandle = await frame.elementHandle();
      const framePage = await frameHandle.contentFrame();
      const frameContent = { textareas: await framePage.locator('textarea').count(), bodyHeight: await framePage.locator('body').evaluate((node) => node.scrollHeight) };
      if (frameContent.textareas !== 4 || Math.abs(frameContent.bodyHeight - frameContract.height) > 2) failures.push({ check: 'sandbox content and intrinsic height', width, theme, frameContract, frameContent });
      if (width === 390 && theme === 'light') await page.screenshot({ path: 'output/playwright/textarea-owner-docs-mobile.png', fullPage: true });
    }
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 4, failures, errors };
}
