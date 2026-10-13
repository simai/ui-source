/* global customElements, document, getComputedStyle, innerWidth */
// Run with playwright-cli run-code using this file's contents as the argument.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/input-owner-lab.html';
  const failures = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.waitForFunction(() => customElements.get('sf-input') && document.querySelector('#smart-email input'));

  const smart = page.locator('#smart-email input');
  const nativeMetadata = await smart.evaluate((input) => ({
    type: input.type,
    name: input.name,
    autocomplete: input.autocomplete,
    inputMode: input.inputMode,
    minLength: input.minLength,
    maxLength: input.maxLength,
    pattern: input.pattern,
    required: input.required,
  }));
  const expectedMetadata = { type: 'email', name: 'smart-email', autocomplete: 'email', inputMode: 'email', minLength: 6, maxLength: 80, pattern: '.+@.+', required: true };
  if (JSON.stringify(nativeMetadata) !== JSON.stringify(expectedMetadata)) failures.push({ check: 'Smart native metadata', nativeMetadata });

  await smart.click();
  const pointerShadow = await smart.evaluate((input) => getComputedStyle(input.closest('.sf-input-field')).boxShadow);
  if (pointerShadow !== 'none') failures.push({ check: 'pointer focus is visually quiet', pointerShadow });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  if (!await smart.evaluate((input) => input.matches(':focus-visible'))) failures.push({ check: 'keyboard focus is visible' });
  const focusShadow = await smart.evaluate((input) => getComputedStyle(input.closest('.sf-input-field')).boxShadow);
  if (focusShadow === 'none') failures.push({ check: 'focus ring belongs to joined field boundary', focusShadow });

  const readonly = page.locator('#readonly-input');
  const readonlyBefore = await readonly.evaluate((input) => getComputedStyle(input.closest('.sf-input-field')).backgroundColor);
  await readonly.hover();
  const readonlyAfter = await readonly.evaluate((input) => getComputedStyle(input.closest('.sf-input-field')).backgroundColor);
  if (readonlyBefore !== readonlyAfter) failures.push({ check: 'readonly has no editable hover feedback', readonlyBefore, readonlyAfter });

  await smart.fill('changed@example.com');
  await page.locator('#smart-form').evaluate((form) => form.reset());
  await page.waitForFunction(() => document.querySelector('#smart-email input').value === 'reset@example.com');

  await page.getByRole('button', { name: 'Создать через API', exact: true }).click();
  const factory = page.locator('#factory-output .sf-input');
  const factoryState = await factory.evaluate((root) => {
    const input = root.querySelector('input');
    return { classes: [...root.classList], type: input.type, inputMode: input.inputMode, autocomplete: input.autocomplete, minLength: input.minLength, maxLength: input.maxLength, pattern: input.pattern };
  });
  if (!factoryState.classes.includes('sf-input--size-1') || !factoryState.classes.includes('sf-input--bordered')) failures.push({ check: 'constructor bounds visual axes', factoryState });
  if (JSON.stringify({ ...factoryState, classes: undefined }) !== JSON.stringify({ classes: undefined, type: 'tel', inputMode: 'tel', autocomplete: 'tel', minLength: 5, maxLength: 20, pattern: '[0-9+ ]+' })) failures.push({ check: 'constructor native metadata', factoryState });

  const invalid = page.locator('#invalid-input');
  if (await invalid.getAttribute('aria-errormessage') !== 'input-error') failures.push({ check: 'invalid message relationship' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'mobile horizontal overflow' });

  for (const theme of ['light', 'dark']) {
    for (const dir of ['ltr', 'rtl']) {
      await page.goto(`${base}?theme=${theme}&dir=${dir}`);
      await page.waitForFunction(() => customElements.get('sf-input') && document.querySelector('#smart-email input'));
      const geometry = await page.locator('#smart-email .sf-input-field').evaluate((field) => ({ width: field.getBoundingClientRect().width, radius: getComputedStyle(field).borderStartStartRadius }));
      if (geometry.width <= 0 || geometry.radius === '0px') failures.push({ check: 'theme and direction geometry', theme, dir, geometry });
    }
  }

  await page.screenshot({ path: 'output/playwright/input-owner-mobile.png', fullPage: true });
  return { status: failures.length || errors.length ? 'failed' : 'passed', checks: 14, failures, errors, nativeMetadata, factoryState };
}
