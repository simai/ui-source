/* global document, innerWidth */
async page => {
  const failures = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({width: 390, height: 900});
  const source = encodeURIComponent('http://127.0.0.1:8765/ui-source-composition-editor-advanced-v1');
  const assets = encodeURIComponent('http://127.0.0.1:8765/framework-composition-editor-advanced-v1/candidate');
  await page.goto(`http://127.0.0.1:8765/ui-source-composition-editor-advanced-v1/tests/fixtures/composition-editor-fields-lab.html?source=${source}&assets=${assets}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const check = (value, name, details = null) => { if (!value) failures.push({name, details}); };
  check(await page.locator('sf-dropdown').count() === 3, 'three independent section surface controls');
  check(await page.locator('sf-input').count() === 4, 'one columns and three independent heading controls');
  check(await page.locator('details[data-field-group="advanced"]').count() === 3, 'three advanced fields use progressive disclosure');
  check(await page.locator('#field-surface-a-surface').getAttribute('value') === 'surface', 'first same-type instance keeps surface');
  check(await page.locator('#field-surface-b-surface').getAttribute('value') === 'contrast', 'second same-type instance keeps contrast');
  check(await page.locator('#field-nested-copy-surface').getAttribute('value') === 'contrast', 'nested same-type instance keeps contrast');
  check(await page.locator('#field-columns-nested-columns').getAttribute('value') === '3', 'nested integer value projected');
  check(await page.locator('#field-columns-nested-columns').getAttribute('data-min') === '1', 'integer minimum retained');
  check(await page.locator('#field-columns-nested-columns').getAttribute('data-max') === '12', 'integer maximum retained');
  check(await page.locator('#field-heading-a-level').getAttribute('value') === '2', 'first heading level is isolated');
  check(await page.locator('#field-heading-nested-level').getAttribute('value') === '4', 'nested heading level is isolated');
  check(await page.locator('#field-heading-b-level').getAttribute('value') === '3', 'second heading level is isolated');
  check(await page.locator('#field-heading-a-level').getAttribute('data-min') === '1', 'heading minimum retained');
  check(await page.locator('#field-heading-a-level').getAttribute('data-max') === '6', 'heading maximum retained');
  check(await page.locator('#field-heading-a-level').getAttribute('data-group') === 'advanced', 'advanced group projected');
  check(await page.locator('#field-heading-a-level').getAttribute('data-visibility') === 'collapsed', 'collapsed visibility projected');
  check(await page.locator('#field-heading-a-level').getAttribute('data-capability-hints') === 'composition.data.level', 'advanced capability hint projected without evaluation');
  check(await page.locator('#field-heading-a-level').getAttribute('data-permission-hints') === 'composition.node.update', 'advanced permission hint projected without authorization');
  check(await page.locator('#field-heading-a-level').getAttribute('aria-describedby') === 'field-heading-a-level-help', 'advanced localized help reference is connected');
  check(await page.locator('#field-surface-a-surface').getAttribute('data-visibility') === 'visible', 'initial visibility projected');
  check(await page.locator('#field-surface-a-surface').getAttribute('data-capability-hints') === 'composition.presentation.preset', 'capability hint projected without evaluation');
  check(await page.locator('#field-surface-a-surface').getAttribute('data-permission-hints') === 'composition.node.update', 'permission hint projected without authorization');
  check(await page.locator('#field-surface-a-surface').getAttribute('aria-describedby') === 'field-surface-a-surface-help', 'localized help reference is connected');
  check(await page.locator('#field-surface-a-surface-help').isVisible(), 'localized help is visible');
  check(await page.locator('#field-heading-a-level-help').isHidden(), 'advanced help starts collapsed');
  const advanced = page.locator('#field-heading-a-level').locator('xpath=ancestor::details');
  const advancedSummary = advanced.locator('summary');
  await advancedSummary.focus();
  await page.keyboard.press('Space');
  check(await advanced.getAttribute('open') !== null, 'Space opens advanced disclosure');
  check(await page.locator('#field-heading-a-level-help').isVisible(), 'advanced help becomes visible');
  const advancedInput = page.locator('#field-heading-a-level input');
  await advancedInput.fill('5');
  check(await advancedInput.inputValue() === '5', 'advanced integer control accepts keyboard input');
  for (const id of ['field-surface-a-surface', 'field-nested-copy-surface', 'field-surface-b-surface']) {
    const button = page.locator(`#${id}`).locator('button[aria-controls]');
    check(await button.count() === 1, `${id} has one Smart dropdown trigger`);
    check((await button.getAttribute('aria-label') || '').length > 0, `${id} has an accessible name`);
  }
  const first = page.locator('#field-surface-a-surface').locator('button[aria-controls]');
  await first.focus();
  await page.keyboard.press('Enter');
  check(await first.getAttribute('aria-expanded') === 'true', 'Enter opens registered-choice control');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  check(await first.getAttribute('aria-expanded') === 'false', 'Enter commits and closes registered-choice control');
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement?.closest('sf-dropdown')?.id === 'field-surface-a-surface'), 'Tab reaches the first field');
  check(await page.locator('#rendered-preview h2[data-sf-composition-id="heading-a"]').textContent() === 'Primary heading', 'renderer emits semantic h2');
  check(await page.locator('#rendered-preview h4[data-sf-composition-id="heading-nested"]').textContent() === 'Nested heading', 'renderer emits nested semantic h4');
  check(await page.locator('#rendered-preview h3[data-sf-composition-id="heading-b"]').textContent() === 'Secondary heading', 'renderer emits second semantic h3');
  const narrow = await page.evaluate(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    visible: Boolean(document.querySelector('#field-columns-nested-columns input')?.getClientRects().length),
  }));
  check(narrow.visible && narrow.scrollWidth <= narrow.viewport, 'narrow layout has no horizontal overflow', narrow);
  await page.screenshot({path: 'output/playwright/composition-editor-fields-mobile.png', fullPage: true});
  await page.setViewportSize({width: 1280, height: 900});
  await page.evaluate(() => { document.documentElement.className = 'theme-dark'; });
  const wide = await page.evaluate(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    visible: Boolean(document.querySelector('#field-surface-b-surface button')?.getClientRects().length),
    theme: document.documentElement.className,
  }));
  check(wide.visible && wide.scrollWidth <= wide.viewport, 'wide dark-theme layout has no horizontal overflow', wide);
  await page.screenshot({path: 'output/playwright/composition-editor-fields-wide-dark.png', fullPage: true});
  return {status: failures.length || errors.length ? 'failed' : 'passed', failures, errors};
}
