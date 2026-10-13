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
      const response = await fetch(`${base}/examples/tabs-keyboard.html`);
      if (!response.ok) throw new Error('Missing draft example');
      document.querySelector('main').innerHTML = await response.text();
    }, {base, theme});
    const text = page.getByRole('tablist', {name: 'Материалы проекта'});
    await text.getByRole('tab', {name: 'Обзор', exact: true}).focus();
    await page.keyboard.press('ArrowRight');
    const icons = page.getByRole('tablist', {name: 'Представление материалов'});
    await icons.getByRole('tab', {name: 'История', exact: true}).click();
    await icons.getByRole('tab', {name: 'Обзор', exact: true}).press('Space');
    const vertical = page.getByRole('tablist', {name: 'Параметры проекта'});
    await vertical.getByRole('tab', {name: 'Данные', exact: true}).focus();
    await page.keyboard.press('ArrowDown');
    const result = await page.evaluate(async () => {
      const font = await document.fonts.load('24px "Material Symbols Outlined"');
      if (!font.length) throw new Error('Local icon font unavailable');
      document.querySelectorAll('main .sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      const hosts = [...document.querySelectorAll('main sf-tabs')];
      const focusStyle = getComputedStyle(document.activeElement);
      const verticalRoot = hosts[2].querySelector('.sf-tabs');
      const selectedIcon = hosts[1].querySelector('[role="tab"][aria-selected="true"]');
      const selectedText = hosts[0].querySelector('[role="tab"][aria-selected="true"]');
      return {active: hosts.map(e => e.activeIndex), overflow: document.documentElement.scrollWidth > innerWidth,
        focused: document.activeElement.textContent.trim(), focusVisible: document.activeElement.matches(':focus-visible'),
        focusShadow: focusStyle.boxShadow, verticalGap: getComputedStyle(verticalRoot).columnGap,
        selectedIconBackground: getComputedStyle(selectedIcon).backgroundColor,
        selectedTextBackground: getComputedStyle(selectedText).backgroundColor,
        selectedIconColor: getComputedStyle(selectedIcon.querySelector('.sf-icon')).color,
        selectedTextColor: getComputedStyle(selectedText.querySelector('.sf-button-text-container')).color,
        panels: document.querySelectorAll('main [role="tabpanel"]:not([hidden])').length};
    });
    if (result.active.join() !== '2,0,1' || result.overflow || result.focused !== 'Доступ' || !result.focusVisible || result.panels !== 3) failures.push({width, theme, result});
    if (!result.focusShadow.includes('inset') || !(parseFloat(result.verticalGap) > 0)
      || result.selectedIconBackground !== result.selectedTextBackground
      || result.selectedIconColor !== result.selectedTextColor) failures.push({width, theme, issue: 'focus/spacing/selected color parity', result});
    await page.screenshot({path: `output/playwright/tabs-example-${width}-${theme}.png`});
    results.push({width, theme, result});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
