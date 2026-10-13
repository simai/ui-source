async page => {
  const failures = [], errors = []; let checks = 0;
  page.on('pageerror', e => errors.push(e.message));
  const check = (ok, name, context, actual) => {checks++; if (!ok) failures.push({...context, name, actual});};
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const theme of ['light', 'dark']) for (const vertical of [false, true]) for (const dir of ['ltr', 'rtl']) for (const icons of [false, true]) {
    const context = {theme, vertical, dir, icons};
    await page.setViewportSize({width: theme === 'light' ? 390 : 1280, height: 900});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    await page.evaluate(({theme, vertical, dir, icons}) => {
      document.documentElement.className = `theme-${theme}`; document.documentElement.dir = dir;
      const button = (label, index) => icons
        ? `<button type="button" aria-label="${label}" ${index === 1 ? 'disabled' : ''} class="sf-icon-button sf-icon-button--default sf-icon-button--primary sf-icon-button--icon sf-icon-button--size-1 ${index === 0 ? 'selected' : ''}"><i class="sf-icon" aria-hidden="true">home</i></button>`
        : `<button type="button" ${index === 1 ? 'disabled' : ''} class="sf-button sf-button--default sf-button--primary sf-button--size-1 ${index === 0 ? 'selected' : ''}"><i class="sf-icon" aria-hidden="true">home</i><span class="sf-button-text-container">${label}</span></button>`;
      document.querySelector('main').innerHTML = `<button id="start">Начало</button><div id="ordinary" class="sf-tabs flex ${vertical ? 'sf-tabs--vertical' : 'flex-col'}"><div class="sf-tabs-top-container"><nav class="sf-tabs-top flex ${vertical ? 'flex-col' : ''}" aria-label="Проект">${['Обзор', 'Недоступно', 'История'].map(button).join('')}</nav></div><div class="sf-tabs-main-container"><section class="sf-tabs-main-tab"><p>Первое содержимое.</p><input aria-label="Поле панели"></section><section class="sf-tabs-main-tab">Недоступное содержимое</section><section class="sf-tabs-main-tab">История</section></div></div><button id="after">После вкладок</button>`;
    }, context);
    await page.addScriptTag({url: `${base}/component/tabs/js/tabs.js`});
    const top = page.locator('#ordinary .sf-tabs-top'), button = i => top.locator('button').nth(i);
    const state = () => page.evaluate(() => {
      const root = document.querySelector('#ordinary'), buttons = [...root.querySelectorAll('.sf-tabs-top button')], panels = [...root.querySelectorAll('.sf-tabs-main-tab')];
      return {active: Number(root.dataset.activeIndex), focus: buttons.indexOf(document.activeElement), rootRole: root.getAttribute('role'), listRole: root.querySelector('.sf-tabs-top').getAttribute('role'), orientation: root.querySelector('.sf-tabs-top').getAttribute('aria-orientation'),
        buttons: buttons.map(b => ({id: b.id, controls: b.getAttribute('aria-controls'), tabindex: b.tabIndex, role: b.getAttribute('role'), selected: b.getAttribute('aria-selected')})),
        panels: panels.map(p => ({id: p.id, label: p.getAttribute('aria-labelledby'), hidden: p.hidden, tabindex: p.tabIndex}))};
    });
    let s = await state();
    check(s.rootRole !== 'tablist' && s.listRole === 'tablist' && s.orientation === (vertical ? 'vertical' : 'horizontal'), 'only header is oriented tablist', context, s);
    check(s.buttons.every((b, i) => b.id && b.role === 'tab' && b.controls === s.panels[i].id && s.panels[i].label === b.id), 'reciprocal stable tab/panel links', context, s);
    check(s.buttons.map(b => b.tabindex).join() === '0,-1,-1', 'one enabled tab stop', context, s);
    check(await top.getByRole('tab', {name: 'Обзор', exact: true}).count() === 1, 'accessible text or icon name', context);
    const ids = s.buttons.map(b => b.id);
    await page.locator('#start').focus(); await page.keyboard.press('Tab'); s = await state();
    check(s.focus === 0, 'Tab enters active tab', context, s);
    const forward = vertical ? 'ArrowDown' : dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.press(forward); s = await state();
    check(s.active === 2 && s.focus === 2 && s.panels.map(p => p.hidden).join() === 'true,true,false', 'arrow skips disabled and activates/focuses', context, s);
    await page.keyboard.press('Tab');
    check(await page.evaluate(() => document.activeElement === document.querySelectorAll('#ordinary .sf-tabs-main-tab')[2]), 'Tab reaches selected text panel', context);
    await button(2).focus(); await page.keyboard.press(forward); s = await state();
    check(s.active === 0 && s.focus === 0, 'arrow wraps', context, s);
    await page.keyboard.press('End'); s = await state(); check(s.active === 2 && s.focus === 2, 'End', context, s);
    await page.keyboard.press('Home'); s = await state(); check(s.active === 0 && s.focus === 0, 'Home', context, s);
    await page.keyboard.press(vertical ? 'ArrowRight' : 'ArrowDown'); s = await state(); check(s.active === 0 && s.focus === 0, 'perpendicular key remains native', context, s);
    await page.locator('#ordinary input').focus(); await page.keyboard.press('ArrowRight'); s = await state(); check(s.active === 0, 'panel input not captured', context, s);
    await page.evaluate(() => {window.SF.Tabs.activate(document.querySelector('#ordinary'), 2); window.SF.Tabs.init(document); window.SF.Tabs.init(document);}); s = await state();
    check(s.active === 2 && s.buttons.map(b => b.id).join() === ids.join(), 'imperative select/reinit preserves IDs and index', context, s);
    await button(0).focus(); await page.keyboard.press('Enter'); s = await state(); check(s.active === 0, 'native Enter activation', context, s);
    await button(2).focus(); await page.keyboard.press('Space'); s = await state(); check(s.active === 2, 'native Space activation', context, s);
    await page.evaluate(() => {
      const root = document.querySelector('#ordinary'), buttons = root.querySelectorAll('.sf-tabs-top button');
      buttons[1].disabled = false; buttons[2].disabled = true; window.SF.Tabs.init(root);
    }); s = await state();
    check(s.active === 2 && s.buttons.map(b => b.tabindex).join() === '0,-1,-1', 'disabled selected retains panel but entry is enabled', context, s);
    await button(0).focus(); await page.keyboard.press(forward); s = await state(); check(s.active === 1 && s.focus === 1, 'updated disabled state participates in navigation', context, s);
    await page.evaluate(() => {document.querySelectorAll('#ordinary .sf-tabs-top button').forEach(b => b.disabled = true); window.SF.Tabs.init(document);}); s = await state();
    check(s.buttons.every(b => b.tabindex === -1), 'all disabled has no tab stop', context, s);
    await page.evaluate(() => {
      const root = document.querySelector('#ordinary');
      root.querySelector('.sf-tabs-top').insertAdjacentHTML('beforeend', '<button type="button" class="sf-button sf-button--default sf-button--primary sf-button--size-1"><span class="sf-button-text-container">Новая</span></button>');
      root.querySelector('.sf-tabs-main-container').insertAdjacentHTML('beforeend', '<section class="sf-tabs-main-tab">Новая панель</section>');
      window.SF.Tabs.init(root);
    });
    await top.getByRole('tab', {name: 'Новая', exact: true}).click(); s = await state();
    check(s.active === 3 && s.buttons[3].controls === s.panels[3].id && !s.panels[3].hidden, 'appended pair refreshed and delegated click bound', context, s);
    await page.evaluate(() => {
      const original = document.querySelector('#ordinary'), copy = original.cloneNode(true); copy.id = 'ordinary-copy';
      copy.querySelectorAll('button').forEach(b => b.disabled = false);
      original.before(copy); window.SF.Tabs.init(copy);
    });
    await page.locator('#ordinary-copy .sf-tabs-top button').first().click();
    check(await page.evaluate(() => document.querySelector('#ordinary-copy').dataset.activeIndex === '0' && document.querySelector('#ordinary').dataset.activeIndex === '3'), 'copied marker does not suppress clone handlers or mutate original', context);
    check(await page.evaluate(() => {const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return new Set(ids).size === ids.length;}), 'cloned generated IDs are unique', context);
    const dynamic = await page.evaluate(async () => {
      const root = document.querySelector('#ordinary-copy');
      let writes = 0; const watch = new MutationObserver(records => writes += records.length);
      watch.observe(root, {attributes: true, subtree: true});
      const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      root.dataset.activeIndex = '2'; await wait();
      const selected = root.querySelectorAll('.sf-tabs-top button')[2]; selected.disabled = true; await wait();
      const disabledStop = selected.tabIndex;
      const beforeIdle = writes; await wait(); const idleWrites = writes - beforeIdle; watch.disconnect();
      const detached = root.cloneNode(true); detached.id = 'automatic-copy'; document.querySelector('main').append(detached); await wait();
      return {selected: selected.getAttribute('aria-selected'), disabledStop, idleWrites, role: detached.querySelector('.sf-tabs-top').getAttribute('role'), originalId: selected.id, copiedId: detached.querySelectorAll('.sf-tabs-top button')[2].id};
    });
    check(dynamic.selected === 'true' && dynamic.disabledStop === -1 && dynamic.idleWrites === 0, 'live index/disabled synchronization settles without mutation loop', context, dynamic);
    check(dynamic.role === 'tablist' && dynamic.originalId !== dynamic.copiedId, 'added root initializes automatically', context, dynamic);
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: 16, checks, failures, errors};
}
