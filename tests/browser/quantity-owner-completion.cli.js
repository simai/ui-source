// Run with playwright-cli run-code using this file's contents as the argument.
/* global document, getComputedStyle */
async (page) => {
  const url = 'http://127.0.0.1:8765/ui-source/tests/fixtures/quantity-state-lab.html';
  const results = [];
  const check = (condition, name, details = '') => {
    if (!condition) throw new Error(`${name}${details ? `: ${details}` : ''}`);
    results.push(name);
  };
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference', forcedColors: 'none' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#plain')?.dataset.sfQuantityBound === '1');

  const plain = page.locator('#plain input');
  const plainButtons = page.locator('#plain .sf-quantity-count');
  await plain.fill('20000');
  await plain.blur();
  check(await plain.inputValue() === '10,000', 'direct input clamps to max');
  check(await plainButtons.last().isDisabled(), 'increment disables at max');
  await plainButtons.first().click();
  check(await plain.inputValue() === '9,999', 'decrement re-enters range');
  check(!(await plainButtons.last().isDisabled()), 'increment re-enables below max');

  await plain.click();
  check(await page.locator('#plain').evaluate(e => e.classList.contains('sf-quantity--pointer-focus')), 'pointer marks quiet focus');
  const pointerShadow = await page.locator('#plain .sf-quantity-wrap').evaluate(e => getComputedStyle(e).boxShadow);
  check(pointerShadow === 'none', 'pointer focus has no outer ring', pointerShadow);
  await page.keyboard.press('Shift+Tab');
  check(!(await page.locator('#plain').evaluate(e => e.classList.contains('sf-quantity--pointer-focus'))), 'keyboard clears pointer marker');
  const keyboardShadow = await plainButtons.first().evaluate(e => getComputedStyle(e).boxShadow);
  check(keyboardShadow !== 'none', 'keyboard button gets inset ring', keyboardShadow);

  const readonly = page.locator('#readonly input');
  check(await readonly.isEditable() === false, 'readonly is not editable');
  check(await readonly.isEnabled(), 'readonly remains enabled and focusable');
  check(await page.locator('#readonly button:disabled').count() === 2, 'readonly disables both actions');

  const geometry = await page.locator('#plain .sf-quantity-wrap').evaluate(e => {
    const style = getComputedStyle(e);
    return { radius: style.borderRadius, border: style.borderTopWidth };
  });
  check(geometry.radius !== '0px', 'control uses semantic UI radius', geometry.radius);
  check(geometry.border === '1px', 'control uses hairline border', geometry.border);

  const lightBackground = await page.locator('#plain .sf-quantity-wrap').evaluate(e => getComputedStyle(e).backgroundColor);
  await page.evaluate(() => document.documentElement.className = 'theme-dark');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#plain .sf-quantity-wrap')).backgroundColor !== 'rgb(255, 255, 255)');
  const darkBackground = await page.locator('#plain .sf-quantity-wrap').evaluate(e => getComputedStyle(e).backgroundColor);
  check(darkBackground !== lightBackground, 'dark theme resolves a different surface', `${lightBackground} -> ${darkBackground}`);
  await page.evaluate(() => document.documentElement.dir = 'rtl');
  check(await page.locator('#plain').evaluate(e => getComputedStyle(e).direction) === 'rtl', 'RTL inherited');

  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile has no horizontal overflow');
  await page.screenshot({ path: 'output/playwright/quantity-owner-mobile.png', fullPage: true });

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce', forcedColors: 'none' });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#plain')?.dataset.sfQuantityBound === '1');
  const duration = await page.locator('#plain .sf-quantity-wrap').evaluate(e => getComputedStyle(e).transitionDuration);
  check(duration === '0s', 'reduced motion removes transition', duration);

  await page.emulateMedia({ forcedColors: 'active' });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#plain')?.dataset.sfQuantityBound === '1');
  await page.locator('#plain input').focus();
  const forcedOutline = await page.locator('#plain .sf-quantity-wrap').evaluate(e => getComputedStyle(e).outlineStyle);
  check(forcedOutline !== 'none', 'forced colors keeps keyboard focus');

  check(errors.length === 0, 'runtime has no errors', errors.join(' | '));
  return { status: 'passed', checks: results.length, results, errors, geometry, lightBackground, darkBackground };
}
