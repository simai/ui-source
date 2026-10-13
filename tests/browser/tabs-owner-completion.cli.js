/* global document, getComputedStyle, innerWidth */
async page => {
  const failures = [], errors = [];
  const check = (ok, name, actual, context) => {
    if (!ok) failures.push({ name, actual, ...context });
  };
  page.on('pageerror', error => errors.push(error.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      const context = { width, theme };
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({
        colorScheme: theme,
        forcedColors: 'none',
        reducedMotion: 'reduce',
      });
      await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
      for (const name of ['buttons', 'tabs']) {
        await page.addStyleTag({ url: `${base}/component/${name}/css/${name}.css` });
      }
      await page.addStyleTag({ url: `${base}/smart/tabs/css/tabs.css` });
      await page.addStyleTag({ url: `${base}/smart/tabs/template/default.css` });
      await page.addScriptTag({ url: `${base}/component/tabs/js/tabs.js` });
      for (const name of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) {
        await page.addScriptTag({ url: `${base}/smart/${name}/js/${name}.js` });
      }

      await page.evaluate(async ({ currentTheme }) => {
        document.documentElement.className = `theme-${currentTheme}`;
        document.querySelector('main').innerHTML = `
          <div id="ordinary" class="sf-tabs sf-tabs--full flex flex-col">
            <div class="sf-tabs-top-container">
              <div class="sf-tabs-top flex" aria-label="Смешанные вкладки">
                <button type="button" class="sf-button sf-button--outline sf-button--primary sf-button--size-1 selected"><span class="sf-button-text-container">Обзор</span></button>
                <button type="button" aria-label="История" class="sf-icon-button sf-icon-button--outline sf-icon-button--primary sf-icon-button--icon sf-icon-button--size-1"><i class="sf-icon" aria-hidden="true">history</i></button>
                <button type="button" class="sf-button sf-button--outline sf-button--primary sf-button--size-1"><span class="sf-button-text-container">Настройки</span></button>
              </div>
            </div>
            <div class="sf-tabs-main-container">
              <section class="sf-tabs-main-tab selected">Обзор</section>
              <section class="sf-tabs-main-tab">История</section>
              <section class="sf-tabs-main-tab">Настройки</section>
            </div>
          </div>
          <sf-tabs id="smart" type="full" items="Обзор|История|Настройки"></sf-tabs>
          <sf-tabs id="custom" type="full"></sf-tabs>`;
        const smart = document.getElementById('smart');
        const custom = document.getElementById('custom');
        await Promise.all([smart.updateComplete, custom.updateComplete]);
        custom.setData({
          tabs: [
            { label: 'Пользовательская', component: { type: 'sf-button', props: { text: 'Вид вкладки' } } },
            { label: 'Обычная' },
          ],
          panels: [{ text: 'Пользовательская панель' }, { text: 'Обычная панель' }],
        });
        await Promise.all([smart.updateComplete, custom.updateComplete]);
      }, { currentTheme: theme });

      await page.waitForTimeout(500);
      await page.evaluate(() => Promise.all(
        document.getAnimations()
          .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map(animation => animation.finished.catch(() => {})),
      ));

      const state = await page.evaluate(() => {
        const ordinary = document.getElementById('ordinary');
        const ordinaryTabs = [...ordinary.querySelectorAll('[role="tab"]')];
        const smartTabs = [...document.querySelectorAll('#smart [role="tab"]')];
        const customTabs = [...document.querySelectorAll('#custom [role="tab"]')];
        const customVisual = customTabs[0]?.querySelector('[inert]');
        return {
          counts: [ordinaryTabs.length, smartTabs.length, customTabs.length],
          ordinarySeams: ordinaryTabs.slice(1).map(tab => getComputedStyle(tab).borderInlineStartWidth),
          smartSeams: smartTabs.slice(1).map(tab => getComputedStyle(tab).borderInlineStartWidth),
          customName: customTabs[0]?.getAttribute('aria-label'),
          customInert: customVisual?.hasAttribute('aria-hidden') && customVisual.inert,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      check(state.counts.join(',') === '3,3,2', 'All owner scenarios render their complete tab lists', state, context);
      check(state.ordinarySeams.every(value => value === '0px'), 'Mixed ordinary actions share one seam', state, context);
      check(state.smartSeams.every(value => value === '0px'), 'Smart actions share one seam', state, context);
      check(state.customName === 'Пользовательская' && state.customInert, 'Custom visual keeps the wrapper as the named tab owner', state, context);
      check(!state.overflow, 'Tabs owner scenarios do not widen the page', state, context);

      if (state.counts[2] === 2) {
        await page.locator('#custom [role="tab"]').first().focus();
        await page.keyboard.press('ArrowRight');
        const keyboard = await page.evaluate(() => ({
          focused: document.activeElement === document.querySelectorAll('#custom [role="tab"]')[1],
          selected: document.querySelectorAll('#custom [role="tab"]')[1].getAttribute('aria-selected'),
        }));
        check(keyboard.focused && keyboard.selected === 'true', 'Custom visual follows the shared keyboard model', keyboard, context);

        await page.locator('#custom [role="tab"]').first().focus();
        await page.keyboard.press('Tab');
        const tabOwnership = await page.evaluate(() => ({
          descendantFocused: document.querySelector('#custom [role="tab"]:first-child')?.contains(document.activeElement),
          activeTag: document.activeElement?.tagName,
        }));
        check(!tabOwnership.descendantFocused, 'Custom visual does not create a second tab stop', tabOwnership, context);
      }

      if (width === 390 && theme === 'dark') {
        await page.screenshot({ path: 'output/playwright/tabs-owner-mobile-dark.png', fullPage: true });
      }
    }
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: 4,
    checks: 28,
    failures,
    errors,
  };
}
