/* global document, getComputedStyle, innerWidth */
async page => {
  const failures = [], errors = [], cases = [];
  const check = (ok, name, actual, context = {}) => {
    if (!ok) failures.push({ name, actual, ...context });
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const source = message.location().url;
    if (message.type() === 'error' && !source.endsWith('/favicon.ico')) {
      errors.push(message.text());
    }
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });

  const workspace = 'http://127.0.0.1:8765/ui-source';
  const candidate = `${workspace}/source/output/tooltip-owner-browser`;
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const dir of ['ltr', 'rtl']) {
        for (const forcedColors of ['none', 'active']) {
          const context = { width, theme, dir, forcedColors };
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: theme, forcedColors, reducedMotion: 'reduce' });
          await page.goto(`${workspace}/tests/fixtures/action-focus-lab.html`);
          for (const name of ['icon-buttons', 'icons', 'tooltip']) {
            await page.addStyleTag({ url: `${candidate}/component/${name}/css/${name}.css` });
          }
          await page.addScriptTag({ url: `${candidate}/component/tooltip/js/tooltip.js` });
          await page.addScriptTag({ url: `${candidate}/smart/tooltip/js/tooltip.js` });

          await page.evaluate(({ theme, dir }) => {
            document.documentElement.className = `theme-${theme}`;
            document.documentElement.dir = dir;
            document.querySelector('main').innerHTML = `
              <a id="before-tooltip" href="#after-tooltip">До подсказки</a>
              <span class="sf-tooltip-anchor">
                <button id="tooltip-trigger" class="sf-icon-button sf-icon-button--default sf-icon-button--size-1"
                  type="button" data-tooltip="tooltip-panel" aria-label="Сохранить"
                  aria-describedby="persistent-description">
                  <i class="sf-icon" aria-hidden="true">save</i>
                </button>
                <span id="tooltip-panel" class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1
                  sf-tooltip--arrow-bottom-center" hidden>
                  <span class="sf-tooltip-content flex flex-col">
                    <span class="sf-tooltip-wrap flex flex-col">
                      <span class="sf-tooltip-text">Сохранить изменения</span>
                      <span class="sf-tooltip-supporting-text">Ctrl + S</span>
                    </span>
                    <span class="sf-tooltip-tail" aria-hidden="true"></span>
                  </span>
                </span>
              </span>
              <span id="persistent-description" hidden>Постоянное описание</span>
              <span class="sf-tooltip-anchor" id="smart-anchor">
                <button id="smart-trigger" type="button" data-tooltip>Справка</button>
                <sf-tooltip text="Короткая справка" type="light" arrow="top-center" hidden></sf-tooltip>
              </span>
              <span id="standalone" class="sf-tooltip sf-tooltip--light sf-tooltip--size-1
                sf-tooltip--arrow-none">
                <span class="sf-tooltip-content"><span class="sf-tooltip-text">Постоянная метка</span></span>
              </span>
              <span id="dynamic-root"></span>
              <a id="after-tooltip" href="#before-tooltip">После подсказки</a>`;
          }, { theme, dir });

          await page.waitForFunction(() => {
            const trigger = document.getElementById('tooltip-trigger');
            const smart = document.getElementById('smart-trigger');
            return trigger?.getAttribute('aria-describedby')?.includes('tooltip-panel')
              && smart?.getAttribute('data-tooltip');
          });

          const initial = await page.evaluate(() => {
            const trigger = document.getElementById('tooltip-trigger');
            const panel = document.getElementById('tooltip-panel');
            return {
              hidden: panel.hidden,
              role: panel.getAttribute('role'),
              describedBy: trigger.getAttribute('aria-describedby').split(/\s+/),
              expanded: trigger.hasAttribute('aria-expanded'),
              hasPopup: trigger.hasAttribute('aria-haspopup'),
              standaloneVisible: !document.getElementById('standalone').hidden,
              interactive: panel.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length,
            };
          });
          check(initial.hidden && initial.role === 'tooltip', 'Linked Tooltip starts hidden with tooltip semantics', initial, context);
          check(initial.describedBy.includes('persistent-description') && initial.describedBy.includes('tooltip-panel'), 'Existing descriptions are preserved', initial, context);
          check(!initial.expanded && !initial.hasPopup && initial.interactive === 0, 'Tooltip does not expose popup state or nested actions', initial, context);
          check(initial.standaloneVisible, 'Standalone surface remains visible for existing consumers', initial, context);

          await page.locator('#tooltip-trigger').dispatchEvent('pointerenter', { pointerType: 'touch' });
          check(await page.locator('#tooltip-panel').evaluate(node => node.hidden), 'Touch pointer does not create a sticky hover Tooltip', null, context);

          await page.locator('#tooltip-trigger').hover();
          check(!(await page.locator('#tooltip-panel').evaluate(node => node.hidden)), 'Mouse hover opens Tooltip', null, context);
          await page.locator('#tooltip-panel').hover();
          check(!(await page.locator('#tooltip-panel').evaluate(node => node.hidden)), 'Tooltip remains open while its surface is hovered', null, context);

          await page.locator('#before-tooltip').focus();
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(() => ({
            id: document.activeElement?.id,
            visible: document.activeElement?.matches(':focus-visible'),
            hidden: document.getElementById('tooltip-panel').hidden,
          }));
          check(focused.id === 'tooltip-trigger' && focused.visible && !focused.hidden, 'Keyboard focus opens Tooltip on the native trigger', focused, context);
          await page.keyboard.press('Escape');
          const escaped = await page.evaluate(() => ({
            id: document.activeElement?.id,
            hidden: document.getElementById('tooltip-panel').hidden,
          }));
          check(escaped.id === 'tooltip-trigger' && escaped.hidden, 'Escape dismisses without moving focus', escaped, context);
          await page.keyboard.press('Tab');
          check(await page.locator('#tooltip-panel').evaluate(node => node.hidden), 'Leaving the trigger closes Tooltip', null, context);

          await page.locator('#smart-trigger').focus();
          const smart = await page.locator('#smart-anchor').evaluate(anchor => {
            const trigger = anchor.querySelector('button');
            const host = anchor.querySelector('sf-tooltip');
            const root = host.querySelector('.sf-tooltip');
            return {
              hidden: host.hidden,
              role: host.getAttribute('role'),
              describedBy: trigger.getAttribute('aria-describedby'),
              tailHidden: root.querySelector('.sf-tooltip-tail')?.getAttribute('aria-hidden'),
              wrap: Boolean(root.querySelector('.sf-tooltip-wrap')),
            };
          });
          check(!smart.hidden && smart.role === 'tooltip' && smart.describedBy && smart.tailHidden === 'true' && smart.wrap, 'Smart surface joins the same trigger contract', smart, context);

          await page.evaluate(() => {
            const root = document.getElementById('dynamic-root');
            root.innerHTML = `
              <span class="sf-tooltip-anchor">
                <button id="dynamic-trigger" type="button" data-tooltip>Динамический</button>
                <span class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1
                  sf-tooltip--arrow-inline-start" hidden>
                  <span class="sf-tooltip-content"><span class="sf-tooltip-text">Добавлено позднее</span>
                    <span class="sf-tooltip-tail" aria-hidden="true"></span></span>
                </span>
              </span>`;
          });
          await page.waitForFunction(() => document.getElementById('dynamic-trigger')?.getAttribute('aria-describedby'));
          await page.locator('#dynamic-trigger').focus();
          check(!(await page.locator('#dynamic-root .sf-tooltip').evaluate(node => node.hidden)), 'Dynamic composition initializes independently', null, context);

          const geometry = await page.locator('#tooltip-panel').evaluate(panel => {
            const rect = panel.getBoundingClientRect();
            const content = panel.querySelector('.sf-tooltip-content');
            return {
              inViewport: rect.left >= -1 && rect.right <= innerWidth + 1,
              textFits: [...panel.querySelectorAll('.sf-tooltip-text, .sf-tooltip-supporting-text')]
                .every(node => node.scrollWidth <= node.clientWidth + 1),
              border: getComputedStyle(content).borderStyle,
              pageOverflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          check(geometry.inViewport && geometry.textFits && !geometry.pageOverflow, 'Tooltip stays readable without page overflow', geometry, context);
          if (forcedColors === 'active') {
            check(geometry.border !== 'none', 'Forced colors preserves the surface boundary', geometry, context);
          }

          cases.push(context);
          if (width === 390 && theme === 'light' && dir === 'ltr' && forcedColors === 'none') {
            await page.locator('#tooltip-trigger').focus();
            await page.screenshot({ path: 'output/playwright/tooltip-owner-mobile.png', fullPage: true });
          }
        }
      }
    }
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: cases.length,
    checks: cases.length * 13,
    failures,
    errors,
  };
}
