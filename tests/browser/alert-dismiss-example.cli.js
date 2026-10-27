async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const asset of ['alerts', 'buttons', 'icon-buttons', 'close']) await page.addStyleTag({url: `${base}/component/${asset}/css/${asset}.css`});
    for (const asset of ['icon', 'close', 'icon-button', 'alert']) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(async theme => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch('../../source/output/action-focus-browser/examples/alert-dismiss.html');
      if (!response.ok) throw new Error('Missing actual example');
      document.querySelector('main').innerHTML = await response.text();
      window.__exampleCloses = 0;
      document.querySelector('sf-alert').addEventListener('sf-alert-close', () => window.__exampleCloses++);
    }, theme);
    await page.addScriptTag({url: `${base}/examples/alert-dismiss.js`});
    const close = page.getByRole('button', {name: 'Закрыть уведомление', exact: true});
    await close.click();
    await page.waitForFunction(() => !document.querySelector('#dismissible-notice'));
    const afterPointer = await page.evaluate(() => ({focus: document.activeElement.id, disabled: document.querySelector('#restore-notice').disabled, closes: window.__exampleCloses}));
    if (afterPointer.focus !== 'restore-notice' || afterPointer.disabled || afterPointer.closes !== 1) failures.push({width, theme, step: 'pointer close/focus', afterPointer});
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-alert-action') === 'continue');
    await page.keyboard.press('Tab'); await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('#dismissible-notice'));
    const afterKeyboard = await page.evaluate(() => ({focus: document.activeElement.id, closes: window.__exampleCloses}));
    if (afterKeyboard.focus !== 'restore-notice' || afterKeyboard.closes !== 2) failures.push({width, theme, step: 'keyboard repeat/focus', afterKeyboard});
    await page.getByRole('button', {name: 'Показать уведомление', exact: true}).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-alert-action') === 'continue');
    await page.getByRole('button', {name: 'Продолжить', exact: true}).click();
    const state = await page.evaluate(async () => {
      const faces = await document.fonts.load('24px "Material Symbols Outlined"', 'check_circle');
      if (!faces.length) throw new Error('Local fixture icon font missing');
      document.querySelectorAll('main .sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      return {overflow: document.documentElement.scrollWidth > innerWidth, result: document.querySelector('#notice-result').textContent, open: !!document.querySelector('#dismissible-notice'), closes: window.__exampleCloses, iconColor: getComputedStyle(document.querySelector('sf-alert .sf-icon')).color};
    });
    if (state.overflow || !state.open || state.closes !== 2 || state.result !== 'Можно продолжать работу.' || state.iconColor === 'rgba(0, 0, 0, 0)') failures.push({width, theme, step: 'actions and geometry', state});
    await page.screenshot({path: `output/playwright/alert-dismiss-example-${width}-${theme}.png`});
    results.push({width, theme, afterPointer, afterKeyboard, state});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
