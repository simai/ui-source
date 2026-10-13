/* global document, innerWidth */
// Run against the verified ui-doc build to confirm the pinned projection stays usable.
async page => {
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

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:8904/ru/smart-components/reference/list-item/');
      await page.evaluate(value => {
        document.documentElement.classList.remove('theme-light', 'theme-dark');
        document.documentElement.classList.add(`theme-${value}`);
      }, theme);

      const example = page.locator('[data-docara-example]');
      if (await example.count() !== 1) failures.push({ check: 'example count', width, theme });
      if (await example.getAttribute('data-docara-example-preview-resolved') !== 'sandbox') failures.push({ check: 'sandbox mode', width, theme });
      const iframe = example.locator('iframe');
      const frame = await (await iframe.elementHandle()).contentFrame();
      await frame.waitForSelector('.sf-list-item');
      const items = frame.locator('.sf-list-item');
      if (await items.count() !== 5) failures.push({ check: 'visual variant count', width, theme });
      if (await items.evaluateAll(nodes => nodes.some(node => node.hasAttribute('role') || node.hasAttribute('tabindex') || node.classList.contains('cursor-pointer')))) failures.push({ check: 'no fake standalone interaction', width, theme });
      if (await frame.locator('.sf-list-item input').evaluateAll(nodes => nodes.some(node => node.tabIndex !== -1))) failures.push({ check: 'decorative inputs', width, theme });
      if (await frame.locator('.sf-list-item--checkbox input').isChecked() !== true) failures.push({ check: 'selected checkbox representation', width, theme });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'page overflow', width, theme });

      const frameState = await frame.locator('body').evaluate(body => ({
        height: body.scrollHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      const frameContract = await iframe.evaluate(node => ({
        scrolling: node.getAttribute('scrolling'),
        height: node.getBoundingClientRect().height,
      }));
      if (frameState.overflow) failures.push({ check: 'frame overflow', width, theme, frameState });
      if (frameContract.scrolling !== 'no' || frameContract.height < frameState.height || frameContract.height - frameState.height > 8) failures.push({ check: 'intrinsic frame height', width, theme, frameContract, frameState });

      if (width === 390 && theme === 'light') {
        await example.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        await example.screenshot({ path: 'output/playwright/list-item-owner-docs-mobile.png' });
      }
    }
  }

  await page.goto('http://127.0.0.1:8904/ru/components/dropdown/');
  const examples = page.locator('[data-docara-example]');
  if (await examples.count() !== 8) failures.push({ check: 'dropdown example count', count: await examples.count() });
  const staleTransition = await page.locator('.docara-code-scroll code').evaluateAll(nodes => nodes.some(node => /sf-list-item[^"\n]*\btransition\b/.test(node.textContent || '')));
  if (staleTransition) failures.push({ check: 'stale generic transition example' });

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 5, failures, errors };
}
