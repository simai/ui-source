async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const smart of [false, true]) for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const n of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${n}/css/${n}.css`});
    for (const n of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${n}/js/${n}.js`});
    await page.addScriptTag({url: `${base}/component/tabs/js/tabs.js`});
    await page.evaluate(async ({base, theme, smart}) => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch(`${base}/examples/tabs-nested-${smart ? 'smart' : 'base'}.html`);
      if (!response.ok) throw new Error('Missing actual draft example');
      document.querySelector('main').innerHTML = await response.text();
    }, {base, theme, smart});
    const outer = page.getByRole('tablist', {name: 'Проект', exact: true});
    const inner = page.getByRole('tablist', {name: 'Материалы проекта', exact: true});
    await inner.getByRole('tab').first().focus(); await page.keyboard.press('ArrowRight');
    if (await inner.getByRole('tab').nth(1).getAttribute('aria-selected') !== 'true' || await outer.getByRole('tab').first().getAttribute('aria-selected') !== 'true') failures.push({smart, width, theme, issue: 'nested keyboard ownership'});
    await outer.getByRole('tab', {name: 'Доступ', exact: true}).click();
    await outer.getByRole('tab', {name: 'Материалы', exact: true}).click();
    if (await inner.getByRole('tab').nth(1).getAttribute('aria-selected') !== 'true') failures.push({smart, width, theme, issue: 'nested selection lost on parent selection'});
    await inner.getByRole('tab').nth(1).focus(); await page.keyboard.press('ArrowLeft');
    const row = await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      const navs = [...document.querySelectorAll('main .sf-tabs-top')];
      const controls = navs.map(n => n.querySelector('button'));
      return {overflow: document.documentElement.scrollWidth > innerWidth, names: navs.map(n => n.getAttribute('aria-label')),
        outerRadius: getComputedStyle(controls[0]).borderStartStartRadius, innerRadius: getComputedStyle(controls[1]).borderStartStartRadius,
        innerBorder: getComputedStyle(controls[1]).borderBottomWidth,
        focused: document.activeElement.textContent.trim(), focus: getComputedStyle(document.activeElement).boxShadow};
    });
    if (row.overflow || row.outerRadius === row.innerRadius || parseFloat(row.innerBorder) <= 0 || row.focused !== 'Описание проекта' || !row.focus.includes('inset')) failures.push({smart, width, theme, row});
    await page.screenshot({path: `output/playwright/tabs-nested-${smart ? 'smart' : 'base'}-${width}-${theme}.png`, fullPage: true});
    results.push({smart, width, theme, row});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
