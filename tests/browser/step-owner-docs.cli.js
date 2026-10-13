/* global document, innerWidth, parent */
// Run against the verified ui-doc build with the exact Step candidate CSS.
async page => {
  const url = 'http://127.0.0.1:8903/ru/components/step/';
  const css = 'http://127.0.0.1:8765/ui-source/source/output/step-owner-browser/component/step/css/step.css';
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
  await page.route('**/distr/component/step/css/step.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce', forcedColors: 'none' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await page.evaluate(value => {
        document.documentElement.classList.remove('theme-light', 'theme-dark');
        document.documentElement.classList.add(`theme-${value}`);
      }, theme);

      const examples = page.locator('[data-docara-example]');
      const count = await examples.count();
      if (count !== 3) failures.push({ check: 'example count', width, theme, count });
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
        await frame.waitForSelector('.sf-steps');
        await frame.addStyleTag({ url: css });
        await frame.evaluate(() => parent.postMessage({
          type: 'docara:example-height',
          height: Math.ceil(document.body.getBoundingClientRect().height),
        }, '*'));
        await page.waitForTimeout(50);
        frames.push({ frame, iframe });
      }

      const overview = frames[0].frame;
      if (await overview.getByRole('list', { name: 'Оформление заказа' }).count() !== 1) failures.push({ check: 'overview named list', width, theme });
      if (await overview.getByRole('listitem').count() !== 3) failures.push({ check: 'overview list items', width, theme });
      if (await overview.locator('[aria-current="step"]').textContent() !== 'Доставка') failures.push({ check: 'overview current step', width, theme });
      const overviewStatuses = await overview.locator('.sr-only').allTextContents();
      if (overviewStatuses.join('|') !== ', завершено|, не начато') failures.push({ check: 'overview text statuses', width, theme, overviewStatuses });

      const states = frames[1].frame;
      const stateData = await states.locator('.sf-step').evaluateAll(nodes => nodes.map(node => ({
        classes: node.className,
        current: node.getAttribute('aria-current'),
        disabled: node.getAttribute('aria-disabled'),
        text: node.textContent.trim(),
      })));
      if (!stateData[0].classes.includes('stage-completed') || !stateData[0].text.includes('завершено')) failures.push({ check: 'completed state', width, theme, stateData });
      if (!stateData[1].classes.includes('stage-error') || stateData[1].current !== 'step' || !stateData[1].text.includes('ошибка')) failures.push({ check: 'error current state', width, theme, stateData });
      if (!stateData[2].classes.includes('disabled') || stateData[2].disabled !== 'true' || !stateData[2].text.includes('недоступно')) failures.push({ check: 'disabled state', width, theme, stateData });

      const compact = frames[2].frame;
      if (await compact.locator('.sf-step--size-1\\/2').count() !== 3) failures.push({ check: 'compact markup', width, theme });

      for (const { frame, iframe } of frames) {
        const frameState = await frame.locator('body').evaluate(body => ({
          height: body.scrollHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
          iconsVisible: [...body.querySelectorAll('.sf-icon')].every(icon => {
            const rect = icon.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }),
        }));
        const contract = await iframe.evaluate(node => ({
          scrolling: node.getAttribute('scrolling'),
          height: node.getBoundingClientRect().height,
        }));
        if (frameState.overflow || !frameState.iconsVisible) failures.push({ check: 'example rendering', width, theme, frameState });
        if (contract.scrolling !== 'no' || contract.height < frameState.height || contract.height - frameState.height > 8) failures.push({ check: 'intrinsic frame height', width, theme, contract, frameState });
      }

      if (width === 390 && theme === 'light') {
        for (let index = 0; index < count; index += 1) {
          await examples.nth(index).scrollIntoViewIfNeeded();
          await page.waitForTimeout(100);
          await examples.nth(index).screenshot({ path: `output/playwright/step-owner-docs-example-${index + 1}.png` });
        }
        await page.locator('h1').scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        await page.screenshot({ path: 'output/playwright/step-owner-docs-mobile.png' });
      }
    }
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 4, failures, errors };
}
