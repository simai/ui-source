async page => {
  const failures = [], errors = []; let checks = 0;
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const check = (ok, name, context, actual) => {checks++; if (!ok) failures.push({name, ...context, actual});};
  for (const theme of ['light', 'dark']) for (const variant of ['buttons', 'icons']) for (const type of ['', 'vertical']) for (const dir of ['ltr', 'rtl']) {
    const context = {theme, variant, type, dir};
    await page.setViewportSize({width: theme === 'light' ? 390 : 1280, height: 900});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['icon', 'close', 'button', 'icon-button', 'tabs']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(async ({theme, variant, type, dir}) => {
      document.documentElement.className = `theme-${theme}`; document.documentElement.dir = dir;
      const main = document.querySelector('main'); main.replaceChildren();
      const host = document.createElement('sf-tabs'); host.id = 'tabs-case';
      host.setAttribute('variant', variant); if (type) host.setAttribute('type', type);
      host.setAttribute('items', 'Обзор::icon=home|Недоступно::disabled,icon=lock|История::icon=history');
      host.innerHTML = '<div slot="panel-0">Описание <input aria-label="Поле панели"><sf-tabs id="nested-tabs" items="Внутри|Ещё"></sf-tabs></div><p slot="panel-2">История</p>';
      main.append(host); host.__changes = [];
      host.addEventListener('sf-tab-change', e => {if (e.target === host) host.__changes.push(e.detail.current);});
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await document.fonts.load('24px "Material Symbols Outlined"');
      document.querySelectorAll('.sf-icon').forEach(icon => icon.classList.add('sf-icon-loaded'));
    }, context);
    // Production can load the ordinary component after Smart rendering. It
    // must not attach a second state owner or enumerate nested Smart buttons.
    await page.addScriptTag({url: `${base}/component/tabs/js/tabs.js`});
    await page.evaluate(() => window.SF.Tabs.init(document));
    check(await page.evaluate(() => [...document.querySelectorAll('sf-tabs > .sf-tabs')].every(e => !e.dataset.sfTabsBound)), 'ordinary runtime leaves Smart-owned roots alone', context);
    check(await page.evaluate(async () => {let calls = 0; const ready = document.querySelector('#tabs-case').afterRender(() => calls++); await ready; return typeof ready?.then === 'function' && calls === 1;}), 'shared afterRender callback remains compatible', context);
    const top = page.locator('#tabs-case > .sf-tabs > .sf-tabs-top-container > .sf-tabs-top');
    const button = index => top.locator(`button[data-sf-tab-index="${index}"]`);
    const state = () => page.evaluate(() => {
      const host = document.querySelector('#tabs-case');
      const top = host.querySelector(':scope > .sf-tabs > .sf-tabs-top-container > .sf-tabs-top');
      const buttons = [...top.querySelectorAll('button')];
      return {active: host.activeIndex, focus: buttons.indexOf(document.activeElement), events: host.__changes.slice(), buttons: buttons.map(b => ({role: b.getAttribute('role'), selected: b.getAttribute('aria-selected'), tabindex: b.tabIndex, id: b.id, controls: b.getAttribute('aria-controls'), label: b.getAttribute('aria-label') || b.textContent.trim()})), hostStops: [...top.children].filter(e => e.hasAttribute('tabindex')).length,
        panels: [...host.querySelectorAll(':scope > .sf-tabs > .sf-tabs-main-container > [role="tabpanel"]')].map(p => ({id: p.id, labelledby: p.getAttribute('aria-labelledby'), hidden: p.hidden, tabindex: p.tabIndex}))};
    });
    let s = await state();
    check(s.buttons.every(b => b.role === 'tab'), 'native tab roles', context, s.buttons);
    check(s.buttons.map(b => b.tabindex).join() === '0,-1,-1' && !s.hostStops, 'one native tab stop, no host stop', context, s);
    check(s.buttons.every((b, i) => b.id && b.controls === s.panels[i].id && s.panels[i].labelledby === b.id), 'bidirectional panel links', context, s);
    const names = await Promise.all(['Обзор', 'Недоступно', 'История'].map(name => top.getByRole('tab', {name, exact: true}).count()));
    check(names.every(count => count === 1), 'text and icon tab accessible names', context, {names, buttons: s.buttons});
    check(s.panels[0].tabindex === 0, 'text panel keyboard entry', context, s.panels);
    const ids = s.buttons.map(b => b.id);
    await button(0).focus();
    const forward = type === 'vertical' ? 'ArrowDown' : dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = type === 'vertical' ? 'ArrowUp' : dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.press(forward); s = await state();
    check(s.active === 2 && s.focus === 2 && s.events.join() === '2', 'arrow skips disabled and moves focus once', context, s);
    await button(2).focus(); await page.keyboard.press(backward); s = await state();
    check(s.active === 0 && s.focus === 0, 'reverse arrow moves focus', context, s);
    await button(0).focus(); await page.keyboard.press('End'); s = await state();
    check(s.active === 2 && s.focus === 2, 'End selects last enabled', context, s);
    await button(2).focus(); await page.keyboard.press(forward); s = await state();
    check(s.active === 0 && s.focus === 0, 'arrow wraps', context, s);
    await button(2).focus(); await page.keyboard.press('Home'); s = await state();
    check(s.active === 0 && s.focus === 0, 'Home uses focused tab not stale selection', context, s);
    await button(0).focus(); await page.keyboard.press(type === 'vertical' ? 'ArrowRight' : 'ArrowDown'); s = await state();
    check(s.active === 0 && s.focus === 0, 'perpendicular arrow does not select', context, s);
    await page.evaluate(() => document.querySelector('#tabs-case').goTo(0));
    await page.locator('#tabs-case input').focus(); await page.keyboard.press('ArrowRight'); s = await state();
    check(s.active === 0, 'panel input keys stay local', context, s);
    const nested = page.locator('#nested-tabs button');
    await nested.nth(1).click(); s = await state();
    check(s.active === 0, 'nested click does not activate outer tab', context, s);
    await page.evaluate(() => document.querySelector('#tabs-case').goTo(0));
    await nested.nth(0).focus(); await page.keyboard.press(dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'); s = await state();
    check(s.active === 0, 'nested keyboard does not activate outer tab', context, s);
    await page.evaluate(async () => {document.querySelector('#tabs-case').style.paddingInline = 'var(--sf-space-1)'; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));});
    s = await state(); check(s.buttons.map(b => b.id).join() === ids.join(), 'IDs survive style render', context, s.buttons);
    check(await page.evaluate(() => {const ids = [...document.querySelectorAll('[role="tab"],[role="tabpanel"]')].map(e => e.id); return ids.every(Boolean) && new Set(ids).size === ids.length;}), 'nested IDs unique', context);
    await page.evaluate(async () => {document.querySelector('#tabs-case').setAttribute('items', 'Первый::disabled|Второй::disabled'); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));});
    s = await state(); check(s.buttons.every(b => b.tabindex === -1), 'all disabled has no tab stop', context, s.buttons);
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: 16, checks, failures, errors};
}
