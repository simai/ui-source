async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const asset of ['avatars', 'dropdown', 'tooltip']) await page.addStyleTag({url: `${base}/component/${asset}/css/${asset}.css`});
    for (const asset of ['icons', 'avatars', 'list-item', 'tooltip']) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(async ({base, theme}) => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch(`${base}/examples/collection-customization.html`);
      if (!response.ok) throw new Error('Missing draft example');
      document.querySelector('main').innerHTML = await response.text();
    }, {base, theme});
    await page.waitForFunction(() => document.querySelector('.sf-avatar--user') && document.querySelector('.sf-list-item') && document.querySelector('.sf-tooltip'));
    const state = await page.evaluate(async () => {
      const faces = await document.fonts.load('24px "Material Symbols Outlined"', 'link');
      if (!faces.length) throw new Error('Local icon font unavailable');
      document.querySelectorAll('main .sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      return {overflow: document.documentElement.scrollWidth > innerWidth,
        selected: document.querySelector('.sf-list-item').classList.contains('selected'),
        padding: ['.sf-avatar--user', '.sf-list-item', '.sf-tooltip'].map(s => getComputedStyle(document.querySelector(s)).paddingInlineStart)};
    });
    if (state.overflow || !state.selected || state.padding.some(p => parseFloat(p) <= 0)) failures.push({width, theme, state});
    await page.screenshot({path: `output/playwright/collection-style-example-${width}-${theme}.png`});
    results.push({width, theme, state});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
