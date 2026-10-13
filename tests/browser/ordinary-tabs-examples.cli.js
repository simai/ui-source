async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 700});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url: `${base}/component/tabs/js/tabs.js`});
    for (const example of ['overview', 'underline', 'pills', 'full', 'vertical', 'disabled', 'icons', 'dynamic']) {
      await page.evaluate(async ({theme, example, base}) => {
        document.documentElement.className = `theme-${theme}`;
        const response = await fetch(`${base}/examples/ordinary-tabs/${example}/index.html`);
        if (!response.ok) throw new Error('Missing draft example');
        const main = document.querySelector('main'); main.innerHTML = await response.text();
        // Execute the example's own inline script as a real script element,
        // retaining document.currentScript and its local sibling scope.
        main.querySelectorAll('script').forEach(inert => {const live = document.createElement('script'); live.textContent = inert.textContent; inert.replaceWith(live);});
      }, {theme, example, base});
      await page.waitForFunction(() => document.querySelector('main [role="tablist"] [role="tab"]'));
      if (example === 'dynamic') {
        await page.getByRole('button', {name: 'Добавить вкладку', exact: true}).click();
        await page.getByRole('button', {name: 'Добавить вкладку', exact: true}).click();
        await page.waitForFunction(() => document.querySelectorAll('main [role="tab"]').length === 3);
      }
      const tabs = page.getByRole('tablist').getByRole('tab');
      await tabs.last().click();
      await page.keyboard.press('Home');
      const state = await page.evaluate(async () => {
        await document.fonts.load('24px "Material Symbols Outlined"');
        document.querySelectorAll('main .sf-icon').forEach(icon => icon.classList.add('sf-icon-loaded'));
        await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        const root = document.querySelector('main .sf-tabs'), tabs = [...root.querySelectorAll('[role="tab"]')], panels = [...root.querySelectorAll('[role="tabpanel"]')];
        return {active: Number(root.dataset.activeIndex), count: tabs.length, visible: panels.filter(p => !p.hidden).length,
          linked: tabs.every((t, i) => t.id && panels[i].id === t.getAttribute('aria-controls') && panels[i].getAttribute('aria-labelledby') === t.id),
          focus: document.activeElement === tabs[0], overflow: document.documentElement.scrollWidth > innerWidth};
      });
      if (state.active !== 0 || state.visible !== 1 || !state.linked || !state.focus || state.overflow || (example === 'dynamic' && state.count !== 3)) failures.push({width, theme, example, state});
      await page.screenshot({path: `output/playwright/ordinary-tabs-${example}-${width}-${theme}.png`});
      results.push({width, theme, example, state});
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
