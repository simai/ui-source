// Run with playwright-cli run-code using this file's contents as the argument.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/selection-controls-lab.html';
  const failures = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);

  const switchInput = page.getByRole('switch', { name: 'Уведомления Сообщать о важных изменениях', exact: true });
  const toggleInput = page.getByRole('switch', { name: 'Компактный режим', exact: true });
  for (const input of [switchInput, toggleInput]) {
    const pointer = await input.evaluate((element) => getComputedStyle(element.closest('label')).cursor);
    if (pointer !== 'pointer') failures.push({ check: 'whole enabled label pointer', pointer });
    await input.click();
    if (await input.evaluate((element) => element.matches(':focus-visible'))) {
      failures.push({ check: 'pointer interaction has no focus-visible ring' });
    }
  }

  await switchInput.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  if (!await switchInput.evaluate((element) => element.matches(':focus-visible'))) {
    failures.push({ check: 'keyboard navigation exposes focus-visible' });
  }
  const beforeSpace = await switchInput.isChecked();
  await page.keyboard.press('Space');
  if (await switchInput.isChecked() === beforeSpace) failures.push({ check: 'native Space toggles switch' });

  const radios = page.locator('#radio input[type="radio"]');
  await radios.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  if (!await radios.nth(1).isChecked()) failures.push({ check: 'native radio arrow navigation' });

  await page.getByRole('button', { name: 'Создать элементы', exact: true }).click();
  const fontRadios = page.locator('#factory-controls input[name="factory-font-radio"]');
  const fontNames = await fontRadios.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
  if (JSON.stringify(fontNames) !== JSON.stringify(['small', 'medium', 'large'])) {
    failures.push({ check: 'font radios have stable accessible names', fontNames });
  }
  await fontRadios.nth(1).focus();
  await page.keyboard.press('ArrowRight');
  const fontState = await fontRadios.evaluateAll((elements) => elements.map((element) => ({
    checked: element.checked,
    active: element.closest('label').querySelector('.sf-radio-text').classList.contains('active'),
  })));
  if (!fontState[2]?.checked || !fontState[2]?.active || fontState.filter((item) => item.active).length !== 1) {
    failures.push({ check: 'font visual state follows native radio group', fontState });
  }

  const dynamicFont = await page.evaluate(async () => {
    const Radio = new Map(window.SF_PENDING_COMPONENTS).get('Radio');
    const firstForm = document.querySelector('#choices');
    const secondForm = document.querySelector('#smart-choices');
    const build = (form, checked) => {
      const component = new Radio({ param: {
        type: 'font', count: 2, name: 'shared-font-name', text: 'A',
        value: ['regular', 'bold'], description: ['Обычное начертание', 'Жирное начертание'], checked,
      } });
      const root = component.render();
      form.append(root);
      return root;
    };
    const first = build(firstForm, 0);
    const second = build(secondForm, 1);
    const wait = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    first.querySelectorAll('input')[1].click();
    await wait();
    const afterFirst = [...first.querySelectorAll('input')].map((input) => input.checked);
    const secondUnchanged = [...second.querySelectorAll('input')].map((input) => input.checked);
    const description = first.querySelector('.sf-radio-button-description')?.textContent;
    first.closest('form').reset();
    await wait();
    return {
      afterFirst,
      secondUnchanged,
      description,
      reset: [...first.querySelectorAll('input')].map((input) => input.checked),
      names: [...first.querySelectorAll('input')].map((input) => input.getAttribute('aria-label')),
    };
  });
  if (JSON.stringify(dynamicFont.afterFirst) !== JSON.stringify([false, true])) failures.push({ check: 'dynamic font selection', dynamicFont });
  if (JSON.stringify(dynamicFont.secondUnchanged) !== JSON.stringify([false, true])) failures.push({ check: 'same-name groups stay form-scoped', dynamicFont });
  if (dynamicFont.description !== 'Жирное начертание') failures.push({ check: 'font description follows selection', dynamicFont });
  if (JSON.stringify(dynamicFont.reset) !== JSON.stringify([true, false])) failures.push({ check: 'font group native reset', dynamicFont });
  if (JSON.stringify(dynamicFont.names) !== JSON.stringify(['Обычное начертание', 'Жирное начертание'])) failures.push({ check: 'description-backed accessible names', dynamicFont });

  for (const name of ['Smart уведомления', 'Smart компактный режим']) {
    const input = page.getByRole('switch', { name, exact: true });
    if (!await input.isChecked()) failures.push({ check: 'Smart checked projection', name });
  }
  await page.locator('#smart-choices').evaluate((form) => form.reset());
  await page.waitForFunction(() => [...document.querySelectorAll('#smart-choices [role="switch"]')].every((input) => input.checked));

  await page.goto(`${base}?disabled`);
  for (const selector of ['#radio label', '#switch label', '#toggle label']) {
    const cursor = await page.locator(selector).first().evaluate((element) => getComputedStyle(element).cursor);
    if (cursor !== 'default') failures.push({ check: 'disabled label cursor', selector, cursor });
  }

  await page.screenshot({ path: 'output/playwright/selection-owner-completion-mobile.png', fullPage: true });
  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    checks: 16,
    failures,
    errors,
    fontNames,
    fontState,
    dynamicFont,
  };
}
