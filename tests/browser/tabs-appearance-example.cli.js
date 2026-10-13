async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(async ({base, theme}) => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch(`${base}/examples/tabs-appearance.html`);
      if (!response.ok) throw new Error('Missing draft example');
      document.querySelector('main').innerHTML = await response.text();
    }, {base, theme});
    const groups = page.getByRole('tablist');
    for (let i = 0; i < 4; i++) {
      const first = groups.nth(i).getByRole('tab', {name: 'Обзор', exact: true});
      await first.click(); await page.mouse.move(0, 0);
      if (await first.evaluate(e => e.matches(':focus-visible'))) failures.push({width, theme, i, issue: 'pointer ring'});
      await first.press('ArrowRight');
      const next = groups.nth(i).getByRole('tab', {name: 'История', exact: true});
      if (await next.getAttribute('aria-selected') !== 'true' || !await next.evaluate(e => document.activeElement === e && e.matches(':focus-visible'))) failures.push({width, theme, i, issue: 'keyboard selection'});
    }
    const result = await page.evaluate(async () => {
      const faces = await document.fonts.load('24px "Material Symbols Outlined"');
      if (!faces.length) throw new Error('Local font missing');
      document.querySelectorAll('main .sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      return {active: [...document.querySelectorAll('main sf-tabs')].map(e => e.activeIndex),
        panels: document.querySelectorAll('main [role="tabpanel"]:not([hidden])').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        focus: getComputedStyle(document.activeElement).boxShadow};
    });
    if (result.active.join() !== '1,1,1,1' || result.panels !== 4 || result.overflow || !result.focus.includes('inset')) failures.push({width, theme, result});
    await page.screenshot({path: `output/playwright/tabs-appearance-${width}-${theme}.png`, fullPage: true});
    results.push({width, theme, result});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
