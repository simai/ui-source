/* global document, getComputedStyle, innerWidth, requestAnimationFrame, window */
async page => {
  const failures = [], errors = [], cases = [];
  const check = (ok, name, actual, context = {}) => {
    if (!ok) failures.push({ name, actual, ...context });
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const source = message.location().url;
    if (message.type() === 'error' && !source.endsWith('/favicon.ico')) errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });

  const workspace = 'http://127.0.0.1:8765/ui-source';
  const candidate = `${workspace}/source/output/tags-owner-browser`;
  const dependencyStyles = ['avatars', 'close', 'dot', 'icon-buttons', 'icons', 'tags'];
  const dependencyScripts = ['close', 'icon-buttons', 'tags'];

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const dir of ['ltr', 'rtl']) {
        for (const forcedColors of ['none', 'active']) {
          const context = { width, theme, dir, forcedColors };
          await page.setViewportSize({ width, height: 1000 });
          await page.emulateMedia({ reducedMotion: 'reduce', forcedColors });
          await page.goto(`${workspace}/tests/fixtures/action-focus-lab.html`);
          for (const component of dependencyStyles) {
            await page.addStyleTag({ url: `${candidate}/component/${component}/css/${component}.css` });
          }
          for (const component of dependencyScripts) {
            await page.addScriptTag({ url: `${candidate}/smart/${component}/js/${component}.js` });
          }

          await page.evaluate(({ theme, dir }) => {
            document.documentElement.className = `theme-${theme}`;
            document.documentElement.dir = dir;
            document.querySelector('main').innerHTML = `
              <a id="before-tags" href="#after-tags">До тегов</a>
              <div id="tag-group" class="flex flex-wrap gap-2 items-center">
                <sf-tag id="static" type="default" text="Документация" closable="false"></sf-tag>
                <sf-tag id="toggle" type="checkbox" text="Дизайн" aria-label="Фильтр Дизайн"></sf-tag>
                <sf-tag id="selected" type="checkbox" text="Выбран" active></sf-tag>
                <sf-tag id="disabled" type="checkbox" text="Недоступен" disabled></sf-tag>
                <sf-tag id="removable" type="icon" icon="sell" text="Важное" close-label="Удалить тег Важное"></sf-tag>
                <sf-tag id="count" type="default" text="Задачи" count="12" size="1"></sf-tag>
                <sf-tag id="success" type="success" text="Готово"></sf-tag>
                <sf-tag id="warning" type="warning" text="Требует внимания"></sf-tag>
                <sf-tag id="long" type="color" color-class="bg-tertiary" text="Очень длинное выбранное значение, которое должно переноситься без переполнения"></sf-tag>
              </div>
              <a id="after-tags" href="#before-tags">После тегов</a>`;
            window.__tagEvents = { change: [], close: [], disabled: [] };
            document.getElementById('toggle').addEventListener('change', event => window.__tagEvents.change.push(event.detail.active));
            document.getElementById('removable').addEventListener('close', event => window.__tagEvents.close.push(event.detail.component === event.currentTarget));
            document.getElementById('disabled').addEventListener('change', event => window.__tagEvents.disabled.push(event.detail));
          }, { theme, dir });
          await page.waitForFunction(() => [...document.querySelectorAll('sf-tag')].every(host => host.querySelector('.sf-tag')));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

          const semantics = await page.evaluate(() => {
            const root = id => document.querySelector(`#${id} > .sf-tag`);
            const staticRoot = root('static');
            const toggleRoot = root('toggle');
            const removableRoot = root('removable');
            return {
              staticTag: staticRoot.tagName,
              staticRole: staticRoot.getAttribute('role'),
              staticTab: staticRoot.getAttribute('tabindex'),
              toggleTag: toggleRoot.tagName,
              toggleType: toggleRoot.getAttribute('type'),
              togglePressed: toggleRoot.getAttribute('aria-pressed'),
              toggleClose: toggleRoot.querySelectorAll('button, sf-icon-button').length,
              removableTag: removableRoot.tagName,
              removableButtons: removableRoot.querySelectorAll('sf-icon-button').length,
              closeName: removableRoot.querySelector('sf-icon-button')?.getAttribute('aria-label'),
              decorationsHidden: [...document.querySelectorAll('.sf-tag-check, .sf-tag-icon, .sf-tag-color-icon, .sf-dot, .sf-avatar')]
                .every(node => node.getAttribute('aria-hidden') === 'true'),
            };
          });
          check(semantics.staticTag === 'DIV' && semantics.staticRole === null && semantics.staticTab === null, 'Static label has no false action semantics', semantics, context);
          check(semantics.toggleTag === 'BUTTON' && semantics.toggleType === 'button' && semantics.togglePressed === 'false', 'Selectable tag is one native toggle button', semantics, context);
          check(semantics.toggleClose === 0, 'Toggle and remove actions are never nested', semantics, context);
          check(semantics.removableTag === 'DIV' && semantics.removableButtons === 1 && semantics.closeName === 'Удалить тег Важное', 'Removable value owns one named close action', semantics, context);
          check(semantics.decorationsHidden, 'Redundant visuals are hidden from the accessibility tree', semantics, context);

          await page.locator('#toggle > button').click();
          await page.waitForFunction(() => document.getElementById('toggle').hasAttribute('active'));
          await page.locator('#removable sf-icon-button').click();
          await page.locator('#disabled > button').click({ force: true }).catch(() => {});
          const events = await page.evaluate(() => ({
            values: window.__tagEvents,
            active: document.getElementById('toggle').hasAttribute('active'),
            pressed: document.querySelector('#toggle > button').getAttribute('aria-pressed'),
          }));
          check(events.active && events.pressed === 'true' && events.values.change.join(',') === 'true', 'Toggle updates source state and emits one exact change', events, context);
          check(events.values.close.length === 1 && events.values.close[0] === true, 'Close emits one owner-bound removal intent', events, context);
          check(events.values.disabled.length === 0, 'Disabled toggle emits no intent', events, context);

          const staticRoot = page.locator('#static > .sf-tag');
          const staticBefore = await staticRoot.evaluate(node => getComputedStyle(node).backgroundColor);
          await staticRoot.hover();
          const staticAfter = await staticRoot.evaluate(node => getComputedStyle(node).backgroundColor);
          check(staticBefore === staticAfter, 'Static label does not gain action hover affordance', { staticBefore, staticAfter }, context);

          await page.locator('#toggle > button').click();
          const pointerFocus = await page.locator('#toggle > button').evaluate(node => node.matches(':focus-visible'));
          check(!pointerFocus, 'Pointer focus does not show the keyboard indicator', pointerFocus, context);
          await page.locator('#before-tags').focus();
          await page.keyboard.press('Tab');
          const focus = await page.locator('#toggle > button').evaluate(node => {
            const style = getComputedStyle(node);
            return { active: document.activeElement === node, visible: node.matches(':focus-visible'), shadow: style.boxShadow, outline: style.outlineStyle };
          });
          check(focus.active && focus.visible, 'Tab reaches the native toggle and exposes visible focus', focus, context);
          check(forcedColors === 'active' ? focus.outline !== 'none' : focus.shadow !== 'none', 'Focus survives the active color mode', focus, context);

          const geometry = await page.evaluate(() => {
            const group = document.getElementById('tag-group');
            const roots = [...group.querySelectorAll('.sf-tag')];
            const staticStyle = getComputedStyle(document.querySelector('#static > .sf-tag'));
            const toggleStyle = getComputedStyle(document.querySelector('#toggle > .sf-tag'));
            return {
              pageOverflow: document.documentElement.scrollWidth > innerWidth,
              groupOverflow: group.scrollWidth > group.clientWidth + 1,
              rootsFit: roots.every(root => root.scrollWidth <= root.clientWidth + 1 && root.getBoundingClientRect().right <= innerWidth + 1),
              radii: [staticStyle.borderStartStartRadius, toggleStyle.borderStartStartRadius],
              durations: roots.map(root => getComputedStyle(root).transitionDuration),
            };
          });
          check(!geometry.pageOverflow && !geometry.groupOverflow && geometry.rootsFit, 'Tag group wraps without horizontal overflow', geometry, context);
          check(geometry.radii[0] === geometry.radii[1] && geometry.radii[0] !== '0px', 'Static and interactive tags share the UI radius', geometry, context);
          check(geometry.durations.every(value => value.split(',').every(part => part.trim() === '0s')), 'Reduced motion removes tag transitions', geometry, context);

          cases.push(context);
          if (width === 390 && theme === 'light' && dir === 'ltr' && forcedColors === 'none') {
            await page.screenshot({ path: 'output/playwright/tags-owner-mobile-ltr.png', fullPage: true });
          }
          if (width === 390 && theme === 'dark' && dir === 'rtl' && forcedColors === 'none') {
            await page.screenshot({ path: 'output/playwright/tags-owner-mobile-rtl.png', fullPage: true });
          }
        }
      }
    }
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: cases.length, checks: cases.length * 16, failures, errors };
}
