/* global document, getComputedStyle, innerWidth, requestAnimationFrame */
async page => {
  const failures = [], errors = [], results = [];
  const check = (ok, name, actual, context = {}) => {
    if (!ok) failures.push({ name, actual, ...context });
  };
  page.on('pageerror', error => errors.push(error.message));

  const candidate = 'http://127.0.0.1:8765/ui-source/source/output/step-owner-browser';
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const dir of ['ltr', 'rtl']) {
        for (const forcedColors of ['none', 'active']) {
          const context = { width, theme, dir, forcedColors };
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ forcedColors, reducedMotion: 'reduce' });
          await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
          await page.addStyleTag({ url: `${candidate}/component/step/css/step.css` });
          await page.addScriptTag({ url: `${candidate}/smart/icons/js/icons.js` });
          await page.addScriptTag({ url: `${candidate}/smart/steps/js/steps.js` });

          await page.evaluate(({ theme, dir }) => {
            document.documentElement.className = `theme-${theme}`;
            document.documentElement.dir = dir;
            const main = document.querySelector('main');
            main.innerHTML = `
              <button type="button" id="focus-start">Начало</button>
              <form id="process-form">
                <sf-steps
                  id="smart-steps"
                  aria-label="Этапы заявки"
                  completed-label="Завершено"
                  error-label="Ошибка"
                  items="Данные|Проверка|Отправка::disabled"
                  current="1"
                  error-step="1"
                ></sf-steps>
              </form>
              <div class="sf-steps sf-steps--size-1 flex flex-col">
                <div class="sf-steps-container flex items-center" role="list" aria-label="Статические этапы">
                  <div id="static-step" class="sf-step sf-step--size-1 sf-step--stage-default flex items-center justify-center" role="listitem"><span class="sf-step-container">Статический</span></div>
                  <button id="native-step" type="button" class="sf-step sf-step--size-1 sf-step--stage-default flex items-center justify-center"><span class="sf-step-container">Доступный</span></button>
                </div>
              </div>`;
            const host = document.querySelector('#smart-steps');
            host.__changes = [];
            host.addEventListener('sf-step-change', event => host.__changes.push(event.detail.current));
            const form = document.querySelector('#process-form');
            form.__submits = 0;
            form.addEventListener('submit', event => {
              event.preventDefault();
              form.__submits += 1;
            });
          }, { theme, dir });
          await page.waitForFunction(() => document.querySelectorAll('#smart-steps .sf-step').length === 3);

          const host = page.locator('#smart-steps');
          const root = host.locator('.sf-steps');
          const steps = host.locator('.sf-step');
          check(await root.getAttribute('role') === 'group', 'Smart root is a group', await root.getAttribute('role'), context);
          check(await root.getAttribute('aria-label') === 'Этапы заявки', 'Smart group keeps localized name', await root.getAttribute('aria-label'), context);
          check(await steps.count() === 3, 'Smart renders all steps', await steps.count(), context);
          check(await steps.evaluateAll(nodes => nodes.every(node => node.tagName === 'BUTTON' && node.type === 'button' && !node.hasAttribute('role') && !node.hasAttribute('tabindex'))), 'Smart steps are native non-submit buttons', await steps.evaluateAll(nodes => nodes.map(node => node.outerHTML)), context);
          check(await steps.nth(2).isDisabled(), 'Disabled step uses native disabled state', await steps.nth(2).evaluate(node => node.outerHTML), context);
          check(await steps.nth(1).getAttribute('aria-current') === 'step' && await host.locator('[aria-current="false"]').count() === 0, 'Only current step exposes aria-current', await steps.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-current'))), context);
          check(await page.getByRole('button', { name: 'Данные, Завершено', exact: true }).count() === 1, 'Completed state is in accessible name', await steps.nth(0).getAttribute('aria-label'), context);
          check(await page.getByRole('button', { name: 'Проверка, Ошибка', exact: true }).count() === 1, 'Error state is in accessible name', await steps.nth(1).getAttribute('aria-label'), context);
          check(await host.locator('.sf-icon').evaluateAll(nodes => nodes.every(node => node.getAttribute('aria-hidden') === 'true')), 'All status and separator icons are decorative', await host.locator('.sf-icon').evaluateAll(nodes => nodes.map(node => node.outerHTML)), context);

          await steps.nth(0).click();
          await steps.nth(1).focus();
          await page.keyboard.press('Space');
          await steps.nth(0).focus();
          await page.keyboard.press('Enter');
          await steps.nth(2).evaluate(node => node.click());
          const behavior = await host.evaluate(node => ({ current: node.current, changes: node.__changes, submits: document.querySelector('#process-form').__submits }));
          check(JSON.stringify(behavior) === JSON.stringify({ current: 0, changes: [0, 1, 0], submits: 0 }), 'Pointer, Space and Enter emit once; disabled does nothing; form is not submitted', behavior, context);

          await page.locator('#focus-start').click();
          await steps.nth(1).click();
          const pointerShadow = await steps.nth(1).evaluate(node => getComputedStyle(node).boxShadow);
          check(pointerShadow === 'none', 'Pointer focus has no custom ring', pointerShadow, context);
          await page.locator('#focus-start').click();
          await page.keyboard.press('Tab');
          const keyboard = await steps.nth(0).evaluate(node => {
            const style = getComputedStyle(node);
            return {
              focusVisible: node.matches(':focus-visible'),
              shadow: style.boxShadow,
              outline: style.outlineStyle,
              transitionDuration: style.transitionDuration,
            };
          });
          check(keyboard.focusVisible, 'Keyboard focus is visible', keyboard, context);
          check(forcedColors === 'active' ? keyboard.outline !== 'none' : keyboard.shadow !== 'none', 'Keyboard focus uses theme or forced-color indicator', keyboard, context);
          check(keyboard.transitionDuration.split(',').every(value => value.trim() === '0s'), 'Reduced motion removes Step transitions', keyboard, context);

          await page.locator('#static-step').hover();
          const staticBackground = await page.locator('#static-step').evaluate(node => getComputedStyle(node).backgroundColor);
          await page.locator('#native-step').hover();
          const interactiveBackground = await page.locator('#native-step').evaluate(node => getComputedStyle(node).backgroundColor);
          check(staticBackground === 'transparent' || /rgba\([^)]*, 0\)$/.test(staticBackground), 'Static step has no misleading hover', staticBackground, context);
          check(forcedColors === 'active' || interactiveBackground !== staticBackground, 'Interactive step has hover affordance', { staticBackground, interactiveBackground }, context);

          const constrained = await host.evaluate(node => {
            node.style.inlineSize = '300px';
            const container = node.querySelector('.sf-steps-container');
            const labels = [...node.querySelectorAll('.sf-step-container')];
            const result = {
              overflow: container.scrollWidth > container.clientWidth + 1,
              wrapped: labels.some(label => label.getBoundingClientRect().height > parseFloat(getComputedStyle(label).lineHeight) + 1),
            };
            node.style.removeProperty('inline-size');
            return result;
          });
          check(!constrained.overflow && !constrained.wrapped, 'Short step labels stay intact in a constrained mobile-width container', constrained, context);

          const geometry = await page.evaluate(() => {
            const host = document.querySelector('#smart-steps');
            host.setAttribute('items', 'ОченьДлинноеНазваниеШагаБезПробелов|Проверка сведений|Недоступное подтверждение::disabled');
            const read = () => {
              const container = host.querySelector('.sf-steps-container');
              const labels = [...host.querySelectorAll('.sf-step-container')];
              const icons = [...host.querySelectorAll('.sf-icon')];
              const separator = host.querySelector('.sf-steps-separator--directional');
              return {
                pageOverflow: document.documentElement.scrollWidth > innerWidth,
                labelOverflow: labels.some(label => label.scrollWidth > label.clientWidth + 1),
                iconShrink: icons.some(icon => icon.getBoundingClientRect().width < parseFloat(getComputedStyle(icon).width) - 1),
                separatorTransform: separator ? getComputedStyle(separator).transform : '',
                containerWidth: container.getBoundingClientRect().width,
              };
            };
            return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(read()))));
          });
          check(!geometry.pageOverflow && !geometry.labelOverflow && !geometry.iconShrink, 'Long labels fit without shrinking icons or page overflow', geometry, context);
          check(dir === 'rtl' ? geometry.separatorTransform !== 'none' : geometry.separatorTransform === 'none', 'Default directional separator follows text direction', geometry.separatorTransform, context);

          results.push(context);
          if (width === 390 && theme === 'light' && dir === 'rtl' && forcedColors === 'none') {
            await page.screenshot({ path: 'output/playwright/step-owner-mobile-rtl.png', fullPage: true });
          }
        }
      }
    }
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: results.length,
    checks: results.length * 19,
    failures,
    errors,
  };
}
