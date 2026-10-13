// Run with playwright-cli run-code using this file's contents as the argument.
async (page) => {
  await page.emulateMedia({forcedColors: 'none'});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/selection-controls-lab.html');
  await page.getByRole('button', {name: 'Создать элементы', exact: true}).click();
  const read = () => page.locator('#factory-controls input').evaluateAll(es => es.map(e => ({
    name: e.name, value: e.value, checked: e.checked, defaultChecked: e.defaultChecked,
    active: e.closest('label').classList.contains('active'),
    checkboxIcon: e.closest('label').querySelector('.sf-checkbox-box .sf-icon')?.textContent,
    fontActive: e.closest('label').querySelector('.sf-radio-text')?.classList.contains('active'),
  })));
  const initial = await read();
  if (initial.length !== 10 || initial.filter(e => e.checked).length !== 7) throw new Error('Constructor fixture incomplete');
  if (initial.some(e => e.checked !== e.defaultChecked)) throw new Error('Constructor did not preserve default');
  await page.getByRole('checkbox', {name: 'Factory Checkbox', exact: true}).uncheck();
  for (const name of ['Factory Switch', 'Factory Toggle simple', 'Factory Toggle icon', 'Factory Toggle short']) {
    await page.getByRole('switch', {name, exact: true}).uncheck();
  }
  // Radio deliberately visually hides its native input; interact with its label.
  await page.locator('#factory-controls label:has(input[name="factory-radio"][value="b"])').click();
  await page.locator('#factory-controls label:has(input[name="factory-font-radio"][value="large"])').click();
  const changed = await read();
  if (changed.some((e,i) => e.defaultChecked !== initial[i].defaultChecked)) throw new Error('Interaction mutated reset default');
  if (changed.filter(e => e.checked).length !== 2) throw new Error('User changes were not applied');
  await page.getByRole('button', {name: 'Сбросить созданные элементы', exact: true}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('#factory-controls input')].every(e => (
    e.checked === e.defaultChecked && (e.closest('label').classList.contains('sf-checkbox')
      ? e.closest('label').querySelector('.sf-icon').textContent === (e.checked ? 'check' : '')
      : e.closest('label').classList.contains('active') === e.checked)
  )));
  const reset = await read();
  if (JSON.stringify(initial) !== JSON.stringify(reset)) throw new Error('Reset differs from initial projection');
  return {status: 'passed', count: initial.length, initial, changed, reset};
}
