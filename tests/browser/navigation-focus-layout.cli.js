async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) for (const forcedColors of ['none', 'active']) {
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({forcedColors, reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const asset of ['breadcrumbs', 'step']) await page.addStyleTag({url: `${base}/component/${asset}/css/${asset}.css`});
    for (const asset of ['icons', 'breadcrumbs', 'steps']) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(theme => {document.documentElement.className = `theme-${theme}`;}, theme);
    for (const mode of ['base-step', 'smart-step', 'base-breadcrumb', 'smart-breadcrumb']) {
      await page.evaluate(async mode => {
        const main = document.querySelector('main');
        main.innerHTML = '<button id="focus-start">Начало</button><section id="target-area" class="p-1"></section>';
        const area = main.querySelector('#target-area');
        if (mode === 'base-step') area.innerHTML = '<button type="button" class="sf-step sf-step--size-1 sf-step--stage-default flex items-center"><span class="sf-step-container">Данные</span></button>';
        if (mode === 'smart-step') area.innerHTML = '<sf-steps items="Данные|Проверка" current="1"></sf-steps>';
        if (mode === 'base-breadcrumb') area.innerHTML = '<nav class="sf-breadcrumbs flex"><a href="#destination" class="sf-breadcrumbs-item sf-breadcrumbs-item--link flex"><span class="sf-breadcrumbs-item-container flex"><span>Данные</span></span></a></nav>';
        if (mode === 'smart-breadcrumb') area.innerHTML = '<sf-breadcrumbs items="Данные::href=#destination|Страница::current"></sf-breadcrumbs>';
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        area.querySelector('.sf-step,.sf-breadcrumbs-item').id = 'focus-target';
      }, mode);
      const target = page.locator('#focus-target');
      const read = () => target.evaluate(async e => {
        await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        const c = getComputedStyle(e), r = e.getBoundingClientRect(), probe = document.createElement('span');
        probe.style.boxShadow = 'var(--sf-ui-focus)'; probe.style.outlineWidth = 'var(--sf-focus-outline-width)'; e.append(probe);
        const p = getComputedStyle(probe), expected = {shadow: p.boxShadow, width: p.outlineWidth}; probe.remove();
        return {shadow: c.boxShadow, outline: c.outlineStyle, outlineWidth: c.outlineWidth, visible: e.matches(':focus-visible'), width: r.width, height: r.height, expected};
      });
      await page.locator('#focus-start').click(); await target.click();
      const pointer = await read();
      if (pointer.shadow !== 'none') failures.push({width, theme, forcedColors, mode, issue: 'pointer acquired focus shadow', pointer});
      await page.locator('#focus-start').click(); await page.keyboard.press('Tab');
      const keyboard = await read();
      if (!keyboard.visible || (forcedColors === 'none' ? keyboard.shadow !== keyboard.expected.shadow || keyboard.shadow === 'none' : keyboard.outline === 'none' || keyboard.outlineWidth !== keyboard.expected.width)) failures.push({width, theme, forcedColors, mode, issue: 'token keyboard focus', keyboard});
      if (pointer.width !== keyboard.width || pointer.height !== keyboard.height) failures.push({width, theme, forcedColors, mode, issue: 'focus changed geometry', pointer, keyboard});
      if (mode === 'smart-step') {
        // After selecting the second step, the first completed step's accessible
        // name must not contain the decorative icon ligature.
        await page.locator('sf-steps').evaluate(e => e.setAttribute('current', '1'));
        await page.waitForFunction(() => document.querySelector('#focus-target.sf-step--stage-completed'));
        if (await page.getByRole('button', {name: 'Данные, Completed', exact: true}).count() !== 1) failures.push({width, theme, forcedColors, mode, issue: 'decorative step icon alters accessible name or completed status is missing'});
      }
      if (mode.startsWith('smart') && ((width === 390 && theme === 'light') || (width === 1280 && theme === 'dark' && forcedColors === 'none'))) {
        await page.evaluate(async () => {await document.fonts.load('24px "Material Symbols Outlined"'); document.querySelectorAll('.sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));});
        await page.screenshot({path: `output/playwright/navigation-focus-${mode}-${width}-${theme}-${forcedColors}.png`});
      }
      results.push({width, theme, forcedColors, mode, pointer, keyboard});
    }
    if (forcedColors === 'none') {
      const geometry = await page.evaluate(async () => {
        document.querySelector('main').innerHTML = '<sf-breadcrumbs items="ОченьДлинноеНазваниеРазделаБезПробелов::href=#x|СтраницаСПодробнымНазванием::current"></sf-breadcrumbs><sf-steps items="ОченьДлинноеНазваниеШагаБезПробелов|Проверка сведений|Подтверждение данных"></sf-steps>';
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return ['sf-breadcrumbs nav', '.sf-steps-container'].map(selector => {
          const root = document.querySelector(selector), r = root.getBoundingClientRect();
          const escaped = [...root.querySelectorAll('.sf-step-container,.sf-breadcrumbs-item-container')].some(e => e.scrollWidth > e.clientWidth + 1);
          return {selector, overflow: r.right > innerWidth + 1 || escaped || document.documentElement.scrollWidth > innerWidth};
        });
      });
      for (const row of geometry) if (row.overflow) failures.push({width, theme, issue: 'long label overflow', ...row});
      if ((width === 390 && theme === 'light') || (width === 1280 && theme === 'dark')) {
        await page.evaluate(async () => {await document.fonts.load('24px "Material Symbols Outlined"'); document.querySelectorAll('.sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));});
        await page.screenshot({path: `output/playwright/navigation-long-labels-${width}-${theme}.png`});
      }
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
