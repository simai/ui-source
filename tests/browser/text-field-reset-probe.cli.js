// Read-only state probe after native browser interactions, reusable before/after.
async (page) => {
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/text-field-reset-lab.html');
  await page.waitForFunction(() => !!document.querySelector('#smart-textarea-masked .sf-textarea')?.__sfTextareaMask);
  await page.getByRole('button', {name: 'Создать текстовые поля', exact: true}).click();
  const read = () => page.locator('input[name], textarea[name]').evaluateAll(es => es.map(e => {
    const root = e.closest('.sf-input,.sf-textarea');
    const host = e.closest('sf-input,sf-textarea');
    return {name: e.name, value: e.value, defaultValue: e.defaultValue,
      mask: (root.__sfInputMask || root.__sfTextareaMask)?.value ?? null,
      publicValue: host?.value ?? null};
  }));
  const initial = await read();
  for (const item of initial) {
    await page.locator(`input[name="${item.name}"],textarea[name="${item.name}"]`).fill(item.mask === null ? 'Изменено' : '34');
  }
  const edited = await read();
  await page.getByRole('button', {name: 'Обновить подсказки', exact: true}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('sf-input,sf-textarea')].every(e => e.textContent.includes('Подсказка')));
  const rerendered = await read();
  await page.getByRole('button', {name: 'Сбросить текстовые поля', exact: true}).click();
  await page.getByRole('button', {name: 'Сбросить созданные поля', exact: true}).click();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
  const reset = await read();
  return {initial, edited, rerendered, reset};
}
