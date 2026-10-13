/* global document, getComputedStyle, innerWidth, parent */
// Run against the verified ui-doc build with the exact Quantity candidate.
async (page) => {
  const url = 'http://127.0.0.1:8901/ru/components/quantity/';
  const assets = 'http://127.0.0.1:8765/ui-source/source/output/quantity-owner-browser/component/quantity';
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
  await page.route('**/distr/component/quantity/js/quantity.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/distr/component/quantity/css/quantity.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

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
        reason: node.dataset.docaraExamplePreviewReason,
        iframe: Boolean(node.querySelector('iframe')),
      })));
      if (modes.some(mode => mode.resolved !== 'sandbox' || !mode.iframe)) failures.push({ check: 'sandbox modes', width, theme, modes });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'page overflow', width, theme });

      const frames = [];
      for (let index = 0; index < count; index += 1) {
        const iframe = examples.nth(index).locator('iframe');
        const handle = await iframe.elementHandle();
        const frame = await handle.contentFrame();
        await frame.waitForSelector('.sf-quantity');
        await frame.addStyleTag({ url: `${assets}/css/quantity.css` });
        await frame.addScriptTag({ url: `${assets}/js/quantity.js` });
        await frame.waitForFunction(() => {
          const roots = Array.from(document.querySelectorAll('.sf-quantity'));
          return roots.length > 0 && roots.every(root => root.dataset.sfQuantityBound === '1');
        }, null, { timeout: 10000 });
        await frame.evaluate(() => parent.postMessage({
          type: 'docara:example-height',
          height: Math.ceil(document.body.getBoundingClientRect().height),
        }, '*'));
        await page.waitForTimeout(50);
        frames.push({ frame, iframe });
      }

      const overview = frames[0].frame;
      const overviewInput = overview.locator('.sf-quantity input');
      const overviewMinus = overview.locator('.sf-quantity-count').first();
      await overviewMinus.click();
      if (await overviewInput.inputValue() !== '1' || !(await overviewMinus.isDisabled())) failures.push({ check: 'overview min boundary', width, theme });
      await overviewInput.click();
      await page.waitForTimeout(250);
      const pointerClass = await overview.locator('.sf-quantity').first().getAttribute('class');
      const pointerStyle = await overview.locator('.sf-quantity-wrap').evaluate(node => ({
        shadow: getComputedStyle(node).boxShadow,
        token: getComputedStyle(node).getPropertyValue('--sf-quantity-wrap--box-shadow'),
      }));
      if (pointerStyle.shadow !== 'none' && !/rgba\(0, 0, 0, 0\).*0px 0px 0px 0px/.test(pointerStyle.shadow)) failures.push({ check: 'pointer focus', width, theme, pointerStyle, pointerClass });
      await overviewInput.press('Tab');
      await page.waitForTimeout(250);
      const keyboardClass = await overview.locator('.sf-quantity').first().getAttribute('class');
      const keyboardStyle = await overview.evaluate(() => ({
        active: document.activeElement?.outerHTML,
        focusVisible: document.activeElement?.matches(':focus-visible'),
        ruleMatch: Boolean(document.querySelector('.sf-quantity:not(.sf-quantity--pointer-focus) .sf-icon-button.sf-quantity-count:not(:disabled):focus-visible')),
        styles: Array.from(document.styleSheets).map(sheet => sheet.href).filter(Boolean),
        shadow: getComputedStyle(document.querySelectorAll('.sf-quantity-count')[1]).boxShadow,
        token: getComputedStyle(document.querySelectorAll('.sf-quantity-count')[1]).getPropertyValue('--sf-icon-button--box-shadow'),
      }));
      if (keyboardStyle.shadow === 'none') failures.push({ check: 'keyboard focus', width, theme, keyboardClass, keyboardStyle });

      const bounds = frames[1].frame;
      const decimal = bounds.locator('input[name="length"]');
      await decimal.fill('9');
      await decimal.blur();
      if (!/^5([,.]00)?$/.test(await decimal.inputValue())) failures.push({ check: 'direct max clamp', width, theme, value: await decimal.inputValue() });

      const formatting = frames[2].frame;
      const formatted = await formatting.locator('input').first().evaluate(input => ({ value: input.value, raw: input.dataset.rawValue }));
      if (formatted.raw !== '1234.5' || !formatted.value.includes('234')) failures.push({ check: 'locale formatting', width, theme, formatted });

      const modesFrame = frames[3].frame;
      const strict = modesFrame.locator('input').first();
      await strict.focus();
      await strict.press('End');
      await strict.press('a');
      if ((await strict.inputValue()).includes('a')) failures.push({ check: 'strict typing', width, theme });

      const sizes = frames[4].frame;
      const fontSizes = await sizes.locator('.sf-quantity input').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).fontSize));
      const sizeClasses = await sizes.locator('.sf-quantity').evaluateAll(nodes => nodes.map(node => Array.from(node.classList).find(name => name.startsWith('sf-quantity--size-'))));
      if (new Set(sizeClasses).size !== 5 || new Set(fontSizes).size < 4) failures.push({ check: 'five semantic sizes', width, theme, sizeClasses, fontSizes });

      const states = frames[5].frame;
      if (await states.locator('input[readonly]').count() !== 1 || await states.locator('input[readonly]').isEditable()) failures.push({ check: 'readonly state', width, theme });
      if (await states.locator('input[readonly]').locator('xpath=..').locator('button:disabled').count() !== 2) failures.push({ check: 'readonly actions', width, theme });
      if (await states.locator('input[aria-invalid="true"]').count() !== 1) failures.push({ check: 'invalid state', width, theme });

      const reset = frames[6].frame;
      const resetInput = reset.locator('input[name="quantity"]');
      await reset.locator('.sf-quantity-count').last().click();
      await reset.locator('button[type="reset"]').evaluate(button => button.click());
      await reset.waitForFunction(() => document.querySelector('input[name="quantity"]').dataset.rawValue === '3', null, { timeout: 5000 });
      if (await resetInput.inputValue() !== '3') failures.push({ check: 'form reset', width, theme });

      for (const { frame, iframe } of frames) {
        const contract = await iframe.evaluate(node => ({ scrolling: node.getAttribute('scrolling'), height: node.getBoundingClientRect().height }));
        const bodyHeight = await frame.locator('body').evaluate(node => node.scrollHeight);
        if (contract.scrolling !== 'no' || Math.abs(contract.height - bodyHeight) > 2) failures.push({ check: 'intrinsic frame height', width, theme, contract, bodyHeight });
      }
      if (width === 390 && theme === 'light') await page.screenshot({ path: 'output/playwright/quantity-owner-docs-mobile.png', fullPage: true });
    }
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 4, failures, errors };
}
