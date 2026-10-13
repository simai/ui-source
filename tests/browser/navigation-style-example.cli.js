async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const asset of ['breadcrumbs', 'step']) await page.addStyleTag({url: `${base}/component/${asset}/css/${asset}.css`});
    for (const asset of ['icons', 'breadcrumbs', 'steps']) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(async ({theme, base}) => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch(`${base}/examples/navigation-customization.html`);
      if (!response.ok) throw new Error('Missing draft example');
      document.querySelector('main').innerHTML = await response.text();
    }, {theme, base});
    await page.waitForFunction(() => document.querySelectorAll('.sf-step').length === 3 && document.querySelector('sf-breadcrumbs nav'));
    await page.getByRole('button', {name: 'Проверка', exact: true}).click();
    await page.getByRole('button', {name: /Данные/}).press('Space');
    await page.getByRole('button', {name: 'Проверка', exact: true}).press('Enter');
    await page.locator('.sf-step[aria-disabled="true"]').click();
    await page.getByRole('link', {name: 'Раздел', exact: true}).click();
    const state = await page.evaluate(async () => {
      const faces = await document.fonts.load('24px "Material Symbols Outlined"', 'chevron_right check_circle');
      if (!faces.length) throw new Error('Local icon font unavailable');
      document.querySelectorAll('main .sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      const steps = document.querySelector('sf-steps'), breadcrumbs = document.querySelector('sf-breadcrumbs nav');
      return {current: steps.current, overflow: document.documentElement.scrollWidth > innerWidth,
        stepPadding: getComputedStyle(steps.querySelector('.sf-steps')).paddingBlockStart,
        breadcrumbsPadding: getComputedStyle(breadcrumbs).paddingBlockStart,
        currentBreadcrumbs: breadcrumbs.querySelectorAll('[aria-current="page"]').length,
        hash: location.hash};
    });
    if (state.current !== 1 || state.overflow || parseFloat(state.stepPadding) <= 0 || parseFloat(state.breadcrumbsPadding) <= 0 || state.currentBreadcrumbs !== 1 || state.hash !== '#navigation-section') failures.push({width, theme, state});
    await page.screenshot({path: `output/playwright/navigation-style-example-${width}-${theme}.png`});
    results.push({width, theme, state});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
