async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const asset of ['buttons', 'icon-buttons', 'close', 'button-group', 'badges', 'progress-bar', 'alerts']) await page.addStyleTag({url: `${base}/component/${asset}/css/${asset}.css`});
    for (const asset of ['icons', 'buttons', 'close', 'icon-buttons', 'button-group', 'badges', 'progress-bar', 'alert']) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(async theme => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch('../../source/output/action-focus-browser/examples/smart-action-customization.html');
      if (!response.ok) throw new Error('Missing documentation example');
      document.querySelector('main').innerHTML = await response.text();
    }, theme);
    await page.waitForFunction(() => document.querySelectorAll('sf-button-group button[role="radio"]').length === 2 && document.querySelector('sf-alert .sf-alert'));
    await page.getByRole('radio', {name: 'Карточки', exact: true}).click();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('sf-button-group').value === 'list');
    const result = await page.evaluate(async () => {
      const faces = await document.fonts.load('24px "Material Symbols Outlined"', 'edit info');
      if (!faces.length) throw new Error('Local fixture icon font unavailable');
      document.querySelectorAll('main .sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      return {
        radios: document.querySelectorAll('main [role="radio"]').length,
        focus: document.activeElement?.getAttribute('data-sf-button-group-value'),
        progress: document.querySelector('.sf-progress-bar-progress').style.width,
        alertPadding: getComputedStyle(document.querySelector('.sf-alert')).paddingInlineStart,
        badgePadding: getComputedStyle(document.querySelector('.sf-badge')).paddingInlineStart,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    if (result.radios !== 2 || result.focus !== 'list' || result.progress !== '42%' || parseFloat(result.alertPadding) <= 0 || parseFloat(result.badgePadding) <= 0 || result.overflow) failures.push({width, theme, result});
    await page.screenshot({path: `output/playwright/action-style-example-${width}-${theme}.png`});
    results.push({width, theme, ...result});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
