async (page) => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/selection-controls-lab.html');
    await page.addStyleTag({url: 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/component/buttons/css/buttons.css'});
    await page.evaluate(async theme => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch('../../source/output/action-focus-browser/examples/smart-selection-customization.html');
      if (!response.ok) throw new Error('Missing actual documentation example');
      document.querySelector('main').innerHTML = await response.text();
    }, theme);
    await page.waitForFunction(() => document.querySelectorAll('main label input').length === 5);
    const read = () => page.locator('main').evaluate(el => ({
      data: [...new FormData(el.querySelector('form'))],
      roots: [...el.querySelectorAll('label')].map(root => ({
        class: root.classList.contains('max-w-sm'), gap: root.style.gap,
        computedGap: getComputedStyle(root).gap,
      })),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    const initial = await read();
    if (initial.overflow || initial.roots.some(r => !r.class || r.gap !== 'var(--sf-space-3)' || parseFloat(r.computedGap) <= 0)) failures.push({width, theme, step: 'visible root customization', initial});
    await page.getByRole('checkbox', {name: 'Обновления продукта Только важные новости', exact: true}).uncheck();
    await page.locator('sf-radio[value="download"] label').click();
    await page.getByRole('switch', {name: 'Уведомления', exact: true}).uncheck();
    await page.getByRole('switch', {name: 'Компактный режим', exact: true}).check();
    const changed = await read();
    if (JSON.stringify(changed.data) !== JSON.stringify([['delivery', 'download'], ['compact', 'yes']])) failures.push({width, theme, step: 'form interaction', changed});
    await page.getByRole('button', {name: 'Вернуть исходный выбор', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('sf-checkbox input')?.checked && !document.querySelector('sf-toggle input')?.checked);
    const reset = await read();
    if (JSON.stringify(initial) !== JSON.stringify(reset)) failures.push({width, theme, step: 'reset', initial, reset});
    await page.evaluate(async () => {
      // The isolated fixture supplies a local font, not the production Loader.
      // Its initial font-ready pass ran before this example was inserted.
      const faces = await document.fonts.load('24px "Material Symbols Outlined"', 'check');
      if (!faces.length) throw new Error('Local icon font missing');
      document.querySelectorAll('main .sf-icon').forEach(icon => icon.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
    });
    await page.screenshot({path: `output/playwright/selection-style-example-${width}-${theme}.png`});
    results.push({width, theme, initial, changed, reset});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
