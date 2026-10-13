/* global customElements, document, getComputedStyle, innerWidth */
// Run with playwright-cli run-code using this file's contents as the argument.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/textarea-owner-lab.html';
  const failures = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.waitForFunction(() => customElements.get('sf-textarea') && document.querySelector('#smart textarea'));

  const smart = page.locator('#smart textarea');
  const metadata = await smart.evaluate((textarea) => ({
    name: textarea.name,
    autocomplete: textarea.autocomplete,
    inputMode: textarea.inputMode,
    minLength: textarea.minLength,
    maxLength: textarea.maxLength,
    spellcheck: textarea.spellcheck,
    wrap: textarea.wrap,
    rows: textarea.rows,
    required: textarea.required,
    resize: getComputedStyle(textarea).resize,
  }));
  const expected = { name: 'description', autocomplete: 'on', inputMode: 'text', minLength: 10, maxLength: 500, spellcheck: true, wrap: 'soft', rows: 4, required: true, resize: 'vertical' };
  if (JSON.stringify(metadata) !== JSON.stringify(expected)) failures.push({ check: 'Smart native metadata and vertical resize', metadata });

  if (await page.locator('#fixed').evaluate((textarea) => getComputedStyle(textarea).resize) !== 'none') failures.push({ check: 'resize utility override' });
  await smart.click();
  const pointerShadow = await smart.evaluate((textarea) => getComputedStyle(textarea).boxShadow);
  if (pointerShadow !== 'none') failures.push({ check: 'pointer focus is visually quiet', pointerShadow });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  if (!await smart.evaluate((textarea) => textarea.matches(':focus-visible'))) failures.push({ check: 'keyboard focus-visible state' });
  const keyboardShadow = await smart.evaluate((textarea) => getComputedStyle(textarea).boxShadow);
  if (keyboardShadow === 'none') failures.push({ check: 'keyboard focus ring', keyboardShadow });

  const readonly = page.locator('#readonly');
  const readonlyBefore = await readonly.evaluate((textarea) => ({ background: getComputedStyle(textarea).backgroundColor, border: getComputedStyle(textarea).borderColor }));
  await readonly.hover();
  const readonlyAfter = await readonly.evaluate((textarea) => ({ background: getComputedStyle(textarea).backgroundColor, border: getComputedStyle(textarea).borderColor }));
  if (JSON.stringify(readonlyBefore) !== JSON.stringify(readonlyAfter)) failures.push({ check: 'readonly has no editable hover', readonlyBefore, readonlyAfter });

  const ordinary = page.locator('#ordinary');
  await ordinary.fill('Изменено');
  await page.locator('#ordinary-form').evaluate((form) => form.reset());
  await page.waitForFunction(() => document.querySelector('#ordinary').value.includes('Первая строка'));
  if (!await ordinary.inputValue().then((value) => value.includes('\n'))) failures.push({ check: 'native multiline reset' });

  await page.getByRole('button', { name: 'Создать через API', exact: true }).click();
  const factoryState = await page.locator('#factory-output .sf-textarea').evaluate((root) => {
    const textarea = root.querySelector('textarea');
    return { classes: [...root.classList], autocomplete: textarea.autocomplete, inputMode: textarea.inputMode, minLength: textarea.minLength, maxLength: textarea.maxLength, spellcheck: textarea.spellcheck, wrap: textarea.wrap };
  });
  if (!factoryState.classes.includes('sf-textarea--size-1') || !factoryState.classes.includes('sf-textarea--bordered')) failures.push({ check: 'constructor bounds visual axes', factoryState });
  if (factoryState.autocomplete !== 'on' || factoryState.inputMode !== 'text' || factoryState.minLength !== 5 || factoryState.maxLength !== 200 || !factoryState.spellcheck || factoryState.wrap !== 'hard') failures.push({ check: 'constructor native metadata', factoryState });

  const invalid = page.locator('#smart-invalid textarea');
  if (await invalid.getAttribute('aria-errormessage') !== await invalid.getAttribute('aria-describedby')) failures.push({ check: 'invalid message relationship' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'mobile horizontal overflow' });

  for (const theme of ['light', 'dark']) {
    for (const dir of ['ltr', 'rtl']) {
      await page.goto(`${base}?theme=${theme}&dir=${dir}`);
      await page.waitForFunction(() => customElements.get('sf-textarea') && document.querySelector('#smart textarea'));
      const geometry = await page.locator('#smart textarea').evaluate((textarea) => ({ width: textarea.getBoundingClientRect().width, radius: getComputedStyle(textarea).borderStartStartRadius, resize: getComputedStyle(textarea).resize }));
      if (geometry.width <= 0 || geometry.radius === '0px' || geometry.resize !== 'vertical') failures.push({ check: 'theme and direction geometry', theme, dir, geometry });
    }
  }

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto(base);
  await page.waitForFunction(() => customElements.get('sf-textarea') && document.querySelector('#smart textarea'));
  await page.keyboard.press('Tab');
  const accessibleState = await page.locator('#ordinary').evaluate((textarea) => ({
    focusVisible: textarea.matches(':focus-visible'),
    outlineStyle: getComputedStyle(textarea).outlineStyle,
    transitionDuration: getComputedStyle(textarea).transitionDuration,
  }));
  if (!accessibleState.focusVisible || accessibleState.outlineStyle === 'none' || accessibleState.transitionDuration !== '0s') failures.push({ check: 'forced colors and reduced motion', accessibleState });
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });

  await page.screenshot({ path: 'output/playwright/textarea-owner-mobile.png', fullPage: true });
  return { status: failures.length || errors.length ? 'failed' : 'passed', checks: 16, failures, errors, metadata, factoryState };
}
