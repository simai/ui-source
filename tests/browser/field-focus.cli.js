// Run through playwright-cli run-code against the generated local lab assets.
async (page) => {
  const base = 'http://127.0.0.1:8765/ui-source/tests/fixtures/field-controls-lab.html';
  const results = [];
  for (const width of [390, 1280]) for (const forcedColors of ['none', 'active']) {
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({forcedColors, reducedMotion: 'reduce'});
    for (const dark of [false, true]) for (const rtl of [false, true]) for (const filled of [false, true]) {
      const modes = [dark && 'dark', rtl && 'rtl', filled && 'filled'].filter(Boolean).join('&');
      await page.goto(`${base}?${modes}`);
      for (const name of ['Рабочая почта', 'Исправьте адрес', 'Комментарий', 'Количество мест', 'Имя контакта', 'Smart адрес', 'Smart комментарий']) {
        if (await page.getByRole('textbox', {name, exact: true}).count() !== 1) throw new Error(`Accessible name: ${name}`);
      }
      await page.locator('#fields').evaluate(async e => {
        await document.fonts.ready;
        await Promise.all(e.getAnimations({subtree: true}).map(a => a.finished.catch(() => {})));
      });
      const measure = () => page.evaluate(() => {
        const e = document.activeElement;
        const root = e.closest('.sf-input,.sf-textarea,.sf-quantity');
        const visual = e.matches('button') ? e : root?.querySelector('.sf-input-field,textarea,.sf-quantity-wrap');
        if (!visual) throw new Error('Unexpected focus owner');
        const style = getComputedStyle(visual), rect = visual.getBoundingClientRect();
        return {name: e.name || e.getAttribute('aria-label'), visible: e.matches(':focus-visible'), button: e.matches('button'),
          shadow: style.boxShadow, outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth),
          offset: parseFloat(style.outlineOffset), background: style.backgroundColor, border: style.borderColor,
          width: rect.width, height: rect.height};
      });
      const baseline = await page.locator('#fields input, #fields textarea, #quantity button').evaluateAll(es => Object.fromEntries(es.map(e => {
        const root = e.closest('.sf-input,.sf-textarea,.sf-quantity');
        const visual = e.matches('button') ? e : root.querySelector('.sf-input-field,textarea,.sf-quantity-wrap');
        const rect = visual.getBoundingClientRect();
        return [e.name || e.getAttribute('aria-label'), {width: rect.width, height: rect.height, background: getComputedStyle(visual).backgroundColor}];
      })));
      await page.getByRole('link', {name: 'Начало проверки'}).click();
      const focus = [];
      for (let n = 0; n < 9; n++) {
        await page.keyboard.press('Tab');
        await page.locator(':focus').evaluate(async e => {
          await Promise.all(e.closest('.sf-input,.sf-textarea,.sf-quantity').getAnimations({subtree: true}).map(a => a.finished.catch(() => {})));
        });
        const current = await measure();
        if (!current.visible) throw new Error('Keyboard focus missing');
        if (forcedColors === 'active') {
          if (current.outline === 'none' || current.outlineWidth < 1) throw new Error(`System focus missing: ${current.name}`);
          if (current.button && current.offset >= 0) throw new Error('Joined system focus must be inset');
        } else {
          if (current.shadow === 'none') throw new Error(`Focus shadow missing: ${current.name}`);
          if (current.button && !current.shadow.includes('inset')) throw new Error('Joined focus must be inset');
        }
        const old = baseline[current.name];
        if (!old || old.width !== current.width || old.height !== current.height) throw new Error(`Focus geometry changed: ${current.name}`);
        if (current.name === 'seats' && old.background !== current.background) throw new Error('Quantity focus changed surface');
        focus.push(current);
      }
      const layout = await page.evaluate(() => ({width: innerWidth, scroll: document.documentElement.scrollWidth,
        duplicates: [...document.querySelectorAll('[id]')].map(e => e.id).filter((id,i,ids) => ids.indexOf(id) !== i)}));
      if (layout.scroll > layout.width || layout.duplicates.length) throw new Error('Overflow or duplicate field IDs');
      await page.getByRole('button', {name: 'Увеличить', exact: true}).click();
      await page.mouse.move(1,1);
      await page.locator(':focus').evaluate(async e => { await Promise.all(e.getAnimations().map(a => a.finished.catch(() => {}))); });
      const pointer = await measure();
      if (pointer.visible || pointer.shadow !== 'none') throw new Error('Pointer button received keyboard focus ring');
      results.push({width, forcedColors, dark, rtl, filled, layout, focus, pointer});
    }
  }
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'no-preference'});
  await page.setViewportSize({width: 390, height: 900});
  await page.goto(base);
  await page.getByRole('textbox', {name: 'Исправьте адрес', exact: true}).click();
  await page.locator('#invalid-email').evaluate(async e => {
    await Promise.all(e.getAnimations({subtree: true}).map(a => a.finished.catch(() => {})));
  });
  await page.screenshot({path: 'output/playwright/field-focus-mobile.png'});
  return {status: 'passed', scenarios: results.length, focusChecks: results.length * 9, results};
}
