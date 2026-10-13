// Run with playwright-cli run-code using this file's contents as the argument.
async (page) => {
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/quantity-state-lab.html');
  await page.waitForFunction(() => !!document.getElementById('masked').__sfQuantityMask);
  await page.evaluate(() => {
    window.quantityChanges = 0;
    document.getElementById('quantities').addEventListener('change', () => window.quantityChanges++);
  });
  const input = id => page.locator(`#${id} input`);
  const read = id => input(id).evaluate(e => ({value: e.value, raw: e.dataset.rawValue ?? null, defaultValue: e.defaultValue}));
  const results = [];
  const equal = (actual, expected, name) => {
    if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
    results.push(name);
  };
  const plus = id => page.locator(`#${id} button`).last().click();
  const reset = async () => {
    await page.getByRole('button', {name: 'Сбросить значения', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('#plain input').dataset.rawValue === '2');
  };
  const changeCount = () => page.evaluate(() => window.quantityChanges);

  equal(await page.locator('#readonly button:disabled').count(), 2, 'readonly disables both actions');
  await input('readonly').focus();
  equal(await input('readonly').evaluate(e => e === document.activeElement && !e.disabled), true, 'readonly remains focusable');
  await page.getByRole('button', {name: 'Разрешить редактирование', exact: true}).click();
  await plus('readonly');
  equal((await read('readonly')).raw, '5', 'readonly mutation re-enables actions');

  await input('plain').fill('');
  await input('plain').blur();
  equal((await read('plain')).value, '', 'empty field stays empty after blur');
  equal((await read('plain')).raw, null, 'empty field clears raw cache');
  await plus('plain');
  equal((await read('plain')).raw, '1', 'empty field increment uses fallback');

  const beforeButtons = Number(await changeCount());
  await plus('grouped'); await plus('grouped');
  equal((await read('grouped')).value, '1,236.50', 'localized increments keep grouped display');
  equal((await read('grouped')).raw, '1236.5', 'localized increments retain raw number');
  equal(Number(await changeCount()) - beforeButtons, 2, 'one change per button action');
  equal((await read('scientific')).value, '0.002', 'scientific step keeps initial precision');
  await plus('scientific');
  equal((await read('scientific')).raw, '0.003', 'scientific step increments precisely');

  await input('plain').fill('7'); await plus('plain');
  equal((await read('plain')).raw, '8', 'edit then increment');
  const beforeReset = await changeCount();
  await reset();
  equal((await read('plain')).value, '2', 'reset restores plain display');
  equal(await changeCount(), beforeReset, 'reset emits no synthetic change');
  await plus('plain');
  equal((await read('plain')).raw, '3', 'increment follows restored reset baseline');

  await input('plain').fill('9'); await input('plain').blur();
  await page.locator('#prevent-reset').check();
  const cancelled = await read('plain');
  await page.getByRole('button', {name: 'Сбросить значения', exact: true}).click();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
  equal(JSON.stringify(await read('plain')), JSON.stringify(cancelled), 'cancelled reset preserves state');
  await page.locator('#prevent-reset').uncheck();

  await input('masked').fill('5'); await plus('masked');
  equal((await read('masked')).raw, '6', 'real IMask edit then increment');
  await reset();
  equal((await read('masked')).value, '2', 'real IMask reset restores display');
  equal(await page.locator('#masked').evaluate(e => e.__sfQuantityMask.typedValue), 2, 'real IMask reset restores internal value');
  await plus('masked');
  equal((await read('masked')).raw, '3', 'real IMask increment follows reset');
  await input('masked').fill(''); await input('masked').blur();
  equal((await read('masked')).value, '', 'real IMask clear stays empty');

  await page.getByRole('button', {name: 'Создать счётчик', exact: true}).click();
  const factoryInput = page.locator('#created input');
  equal(await factoryInput.evaluate(e => e.defaultValue), '4', 'constructor records native default');
  await page.locator('#created button').last().click();
  equal(await factoryInput.inputValue(), '5', 'constructor increment');
  await reset();
  equal(await factoryInput.inputValue(), '5', 'other form reset does not affect constructor');
  await page.getByRole('button', {name: 'Сбросить созданный счётчик', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#created input').dataset.rawValue === '4');
  equal(await factoryInput.inputValue(), '4', 'constructor reset restores initial value');
  await page.locator('#created button').last().click();
  equal(await factoryInput.inputValue(), '5', 'constructor increment after reset');
  await page.screenshot({path: 'output/playwright/quantity-state.png', fullPage: true});
  return {status: 'passed', checks: results.length, results, grouped: await read('grouped'), masked: await read('masked')};
}
