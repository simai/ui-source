/* global document, getComputedStyle, window */
async page => {
  const failures = [], errors = [], cases = [];
  const check = (ok, name, actual = null, context = {}) => {
    if (!ok) failures.push({name, actual, ...context});
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text());
  });

  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const dir of ['ltr', 'rtl']) {
        const context = {width, theme, dir};
        await page.setViewportSize({width, height: 900});
        await page.emulateMedia({colorScheme: theme, forcedColors: 'none'});
        await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
        await page.addStyleTag({url: `${base}/component/tab/css/tab.css`});
        await page.evaluate(({theme, dir}) => {
          document.documentElement.className = `theme-${theme}`;
          document.documentElement.dir = dir;
          document.querySelector('main').innerHTML = `
            <div id="legacy" class="sf-tab">
              <nav aria-label="Разделы профиля"><ul>
                <li aria-label="Профиль"><span class="sf-tab-inactive">Профиль</span><span class="sf-tab-active">Профиль выбран</span></li>
                <li aria-label="Недоступно" aria-disabled="true"><span class="sf-tab-inactive">Недоступно</span><span class="sf-tab-active">Недоступно выбрано</span></li>
                <li aria-label="Настройки"><span class="sf-tab-inactive">Настройки</span><span class="sf-tab-active">Настройки выбраны</span></li>
              </ul></nav>
              <div class="sf-tab-content"><section>Профиль</section><section>Нет</section><section>Настройки</section></div>
            </div>
            <div id="second" class="sf-tab" data-active="1">
              <nav aria-label="Вторая группа"><ul><li aria-label="Первый"><span class="sf-tab-inactive">Первый</span><span class="sf-tab-active">Первый выбран</span></li><li aria-label="Второй"><span class="sf-tab-inactive">Второй</span><span class="sf-tab-active">Второй выбран</span></li></ul></nav>
              <div class="sf-tab-content"><section>Первый</section><section>Второй</section></div>
            </div>
            <div id="modern" class="sf-tabs"></div>
            <div id="dynamic"></div>`;
        }, {theme, dir});
        await page.addScriptTag({url: `${base}/component/tab/js/tab.js`});
        await page.waitForFunction(() => document.querySelector('#legacy.initialized [role="tab"]'));

        const initial = await page.locator('#legacy').evaluate(root => ({
          listRole: root.querySelector('ul').getAttribute('role'),
          listName: root.querySelector('ul').getAttribute('aria-label'),
          tabs: [...root.querySelectorAll('[role="tab"]')].map(tab => ({
            selected: tab.getAttribute('aria-selected'), tabIndex: tab.tabIndex,
            controls: tab.getAttribute('aria-controls'),
          })),
          panels: [...root.querySelectorAll('[role="tabpanel"]')].map(panel => ({
            hidden: panel.hidden, labelledBy: panel.getAttribute('aria-labelledby'),
          })),
        }));
        check(initial.listRole === 'tablist' && initial.listName === 'Разделы профиля', 'Legacy list receives named tablist semantics', initial, context);
        check(initial.tabs.filter(tab => tab.tabIndex === 0).length === 1 && initial.tabs[0].selected === 'true', 'Legacy group starts with one selected tab stop', initial, context);
        check(initial.tabs.every((tab, index) => tab.controls && initial.panels[index].labelledBy), 'Every tab and panel has an ARIA relationship', initial, context);
        check(initial.panels.filter(panel => !panel.hidden).length === 1, 'Only the selected panel is exposed', initial, context);

        let changes = 0;
        await page.locator('#legacy').evaluate(root => root.addEventListener('sf:tab-change', () => { window.__tabChanges = (window.__tabChanges || 0) + 1; }));
        await page.locator('#legacy [role="tab"]').nth(2).click();
        changes = await page.evaluate(() => window.__tabChanges || 0);
        check(await page.locator('#legacy [role="tab"]').nth(2).getAttribute('aria-selected') === 'true' && changes === 1, 'Pointer selection updates state and emits once', changes, context);

        const first = page.locator('#legacy [role="tab"]').first();
        await first.focus();
        await first.press('ArrowRight');
        const expected = dir === 'rtl' ? 2 : 2;
        check(await page.locator('#legacy [role="tab"]').nth(expected).getAttribute('aria-selected') === 'true', 'Arrow navigation skips the disabled tab and follows direction', null, context);
        await page.keyboard.press('Home');
        check(await first.getAttribute('aria-selected') === 'true', 'Home selects the first enabled tab', null, context);
        await page.keyboard.press('End');
        check(await page.locator('#legacy [role="tab"]').nth(2).getAttribute('aria-selected') === 'true', 'End selects the last enabled tab', null, context);

        const second = await page.locator('#second').evaluate(root => ({
          active: root.getAttribute('data-active'), selected: root.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected'),
        }));
        check(second.active === '1' && second.selected === 'true', 'Independent group honors concise initial index', second, context);
        check(await page.locator('#modern.initialized').count() === 0, 'Legacy runtime does not claim modern Tabs', null, context);

        await page.evaluate(() => {
          document.getElementById('dynamic').innerHTML = '<div class="sf-tab"><nav aria-label="Динамическая группа"><ul><li aria-label="Один"><span class="sf-tab-inactive">Один</span><span class="sf-tab-active">Один выбран</span></li></ul></nav><div class="sf-tab-content"><section>Один</section></div></div>';
        });
        await page.waitForFunction(() => document.querySelector('#dynamic .sf-tab.initialized [role="tab"]'));
        check(await page.locator('#dynamic [role="tabpanel"]:not([hidden])').count() === 1, 'Late legacy group initializes independently', null, context);

        const presentation = await page.locator('#legacy [role="tab"]').nth(2).evaluate(tab => ({
          activeShown: getComputedStyle(tab.querySelector('.sf-tab-active')).display !== 'none',
          inactiveHidden: getComputedStyle(tab.querySelector('.sf-tab-inactive')).display === 'none',
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }));
        check(presentation.activeShown && presentation.inactiveHidden && !presentation.overflow, 'Active representation is stable without page overflow', presentation, context);

        cases.push(context);
        if (width === 390 && theme === 'light' && dir === 'ltr') {
          await page.screenshot({path: 'output/playwright/tab-legacy-owner-mobile.png', fullPage: true});
        }
      }
    }
  }

  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: cases.length, checks: cases.length * 12, failures, errors};
}
