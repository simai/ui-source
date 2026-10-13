// Run with playwright-cli run-code using this file's contents as the argument.
async (page) => {
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/text-field-reset-lab.html');
  await page.waitForFunction(() => !!document.querySelector('#smart-textarea-masked .sf-textarea')?.__sfTextareaMask);
  await page.getByRole('button', {name: 'Создать текстовые поля', exact: true}).click();
  await page.evaluate(() => {
    window.textEvents = [];
    for (const type of ['input', 'change']) document.addEventListener(type, e => {
      if (e.target.matches('input[name],textarea[name]')) window.textEvents.push(type);
    });
  });
  let checks = 0;
  const eq = (actual, expected, name) => {
    if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
    checks++;
  };
  const field = name => page.locator(`input[name="${name}"],textarea[name="${name}"]`);
  const read = () => page.locator('input[name], textarea[name]').evaluateAll(es => es.map(e => {
    const root = e.closest('.sf-input,.sf-textarea');
    const host = e.closest('sf-input,sf-textarea');
    return {name: e.name, value: e.value, defaultValue: e.defaultValue,
      mask: (root.__sfInputMask || root.__sfTextareaMask)?.value ?? null,
      publicValue: host?.value ?? null};
  }));
  const rerender = async () => {
    await page.getByRole('button', {name: 'Обновить подсказки', exact: true}).click();
    await page.waitForFunction(() => [...document.querySelectorAll('sf-input,sf-textarea')].every(e => e.textContent.includes(e.getAttribute('hint'))));
  };
  const settleReset = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
  const initial = await read();
  eq(initial.length, 10, 'fixture control count');
  for (const item of initial) {
    const expected = item.name === 'smart-controlled' ? 'Сброс' : item.name === 'smart-empty' ? '' : item.value;
    eq(item.defaultValue, expected, `${item.name} initial default`);
    await field(item.name).fill(item.mask === null ? 'Изменено' : '34');
  }
  await field('Textarea').blur();
  const edited = await read();
  for (const item of edited) {
    if (item.publicValue !== null) eq(item.publicValue, item.value, `${item.name} public live value`);
    if (item.mask !== null) eq(item.mask, item.value, `${item.name} mask live value`);
  }
  await rerender();
  eq(JSON.stringify(await read()), JSON.stringify(edited), 'hint rerender preserves live/default/mask values');
  await page.locator('#cancel-reset').check();
  await page.getByRole('button', {name: 'Сбросить текстовые поля', exact: true}).click();
  await settleReset();
  eq(JSON.stringify(await read()), JSON.stringify(edited), 'cancelled reset preserves all states');
  await page.locator('#cancel-reset').uncheck();
  const beforeResetEvents = await page.evaluate(() => window.textEvents.length);
  await page.getByRole('button', {name: 'Сбросить текстовые поля', exact: true}).click();
  await settleReset();
  for (const item of await read()) {
    if (['Inputs', 'Textarea'].includes(item.name)) eq(item.value, 'Изменено', `${item.name} other form untouched`);
    else {
      eq(item.value, item.defaultValue, `${item.name} native reset`);
      if (item.mask !== null) eq(item.mask, item.value, `${item.name} mask reset`);
      if (item.publicValue !== null) eq(item.publicValue, item.value, `${item.name} public reset value`);
    }
  }
  await page.getByRole('button', {name: 'Сбросить созданные поля', exact: true}).click();
  await settleReset();
  for (const item of await read()) eq(item.value, item.defaultValue, `${item.name} final reset`);
  eq(await page.evaluate(() => window.textEvents.length), beforeResetEvents, 'reset does not emit input/change');
  const reset = await read();
  await rerender();
  eq(JSON.stringify(await read()), JSON.stringify(reset), 'rerender after reset does not resurrect edits');

  for (const item of reset.filter(item => item.mask !== null)) {
    await field(item.name).focus();
    await field(item.name).press('End'); await field(item.name).press('3');
    const value = (await read()).find(row => row.name === item.name);
    eq(value.value, '123', `${item.name} next keystroke follows reset`);
    eq(value.mask, '123', `${item.name} mask next keystroke`);
  }
  await field('smart-textarea-masked').blur();
  const setters = await page.locator('sf-input,sf-textarea').evaluateAll(es => es.map(e => {
    const masked = e.hasAttribute('mask');
    e.value = masked ? '56' : 'Программно';
    const root = e.querySelector('.sf-input,.sf-textarea');
    const native = root.querySelector('input,textarea');
    return {name: native.name, value: e.value, native: native.value,
      mask: (root.__sfInputMask || root.__sfTextareaMask)?.value ?? null};
  }));
  for (const item of setters) {
    eq(item.value, item.mask === null ? 'Программно' : '56', `${item.name} synchronous setter getter`);
    eq(item.native, item.value, `${item.name} synchronous native setter`);
    if (item.mask !== null) eq(item.mask, item.value, `${item.name} synchronous mask setter`);
  }
  await page.waitForFunction(() => [...document.querySelectorAll('sf-input,sf-textarea')].every(e => e.querySelector('input,textarea').value === e.getAttribute('value')));
  await page.screenshot({path: 'output/playwright/text-field-reset.png', fullPage: true});
  return {status: 'passed', checks, controls: initial.length, initial, reset, setters};
}
