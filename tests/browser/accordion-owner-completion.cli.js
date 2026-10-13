/* global document, getComputedStyle, innerWidth, requestAnimationFrame */
async page => {
  const failures = [], errors = [], cases = [];
  const check = (ok, name, actual, context = {}) => {
    if (!ok) failures.push({ name, actual, ...context });
  };
  const transparent = value => value === 'transparent' || /,\s*0\)$/.test(value);
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
  const candidate = `${workspace}/source/output/accordion-owner-browser/component/accordion`;
  await page.route('**/ui-builder/distr/component/accordion/**', async route => {
    const asset = route.request().url().endsWith('.css')
      ? `${candidate}/css/accordion.css`
      : `${candidate}/js/accordion.js`;
    const response = await route.fetch({ url: asset });
    await route.fulfill({ response });
  });
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const dir of ['ltr', 'rtl']) {
        for (const font of ['normal', 'large']) {
          const context = { width, theme, dir, font };
          const query = `theme=${theme}&dir=${dir}&font=${font}`;
          await page.setViewportSize({ width, height: 1000 });
          await page.emulateMedia({ colorScheme: theme, forcedColors: 'none', reducedMotion: 'reduce' });
          await page.goto(`${workspace}/tests/fixtures/accordion-method-lab.html?${query}`);
          await page.waitForFunction(() => document.querySelector(
            '.sf-accordion-trigger[aria-controls]',
          ));

          const initial = await page.evaluate(() => {
            const items = [...document.querySelectorAll('.sf-accordion')];
            const first = items[0];
            const trigger = first.querySelector('.sf-accordion-trigger');
            const content = first.querySelector('.sf-accordion-content');
            const title = first.querySelector('.sf-accordion-title');
            const divider = getComputedStyle(trigger, '::after');
            const outline = document.querySelector('.sf-accordion--outline');
            const flush = document.querySelector('.sf-accordion--flush');
            return {
              count: items.length,
              open: trigger.getAttribute('aria-expanded'),
              controls: trigger.getAttribute('aria-controls') === content.id,
              labelled: content.getAttribute('aria-labelledby') === trigger.id,
              titleSize: getComputedStyle(title).fontSize,
              contentSize: getComputedStyle(content).fontSize,
              divider: divider.backgroundColor,
              width: first.getBoundingClientRect().width,
              overflow: document.documentElement.scrollWidth > innerWidth,
              outline: {
                background: getComputedStyle(outline).backgroundColor,
                border: getComputedStyle(outline).borderStyle,
              },
              flush: {
                background: getComputedStyle(flush).backgroundColor,
                radius: getComputedStyle(flush).borderStartStartRadius,
                border: getComputedStyle(flush).borderBlockEndStyle,
              },
            };
          });
          check(initial.count === 10 && initial.open === 'true', 'All Accordion variants initialize with source state', initial, context);
          check(initial.controls && initial.labelled, 'Trigger and region expose a complete accessible relationship', initial, context);
          check(initial.titleSize === initial.contentSize, 'Title and body share the adaptive body size', initial, context);
          check(initial.divider !== 'rgba(0, 0, 0, 0)', 'Expanded heading keeps a persistent divider', initial, context);
          check(!initial.overflow, 'Accordion laboratory has no horizontal overflow', initial, context);
          check(transparent(initial.outline.background) && initial.outline.border !== 'none', 'Outline surface is transparent with a semantic boundary', initial, context);
          check(transparent(initial.flush.background) && initial.flush.radius === '0px' && initial.flush.border !== 'none', 'Flush surface removes the card while preserving row separation', initial, context);

          const independent = page.locator('#independent-title').locator('..').locator('.sf-accordion');
          const firstWidth = initial.width;
          await independent.nth(1).locator('.sf-accordion-trigger').click();
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(
            () => requestAnimationFrame(resolve),
          )));
          const independentState = await independent.evaluateAll(items => items.map(item => ({
            expanded: item.querySelector('.sf-accordion-trigger').getAttribute('aria-expanded'),
            hidden: item.querySelector('.sf-accordion-content').hidden,
            width: item.getBoundingClientRect().width,
          })));
          check(independentState.every(item => item.expanded === 'true' && !item.hidden), 'Independent sections can remain open together', independentState, context);
          check(independentState.every(item => Math.abs(item.width - firstWidth) < 0.5), 'Disclosure does not change Accordion width', independentState, context);
          check(!(await independent.nth(1).locator('.sf-accordion-trigger').evaluate(node => node.matches(':focus-visible'))), 'Pointer activation does not show keyboard focus', null, context);

          await page.locator('body').click({ position: { x: 1, y: 1 } });
          await page.keyboard.press('Tab');
          const keyboard = await independent.nth(0).locator('.sf-accordion-trigger').evaluate(node => ({
            focused: document.activeElement === node,
            visible: node.matches(':focus-visible'),
            shadow: getComputedStyle(node).boxShadow,
          }));
          check(keyboard.focused && keyboard.visible && keyboard.shadow !== 'none', 'Keyboard focus encloses the complete trigger', keyboard, context);

          const single = page.locator('[data-mode="single"] .sf-accordion');
          await single.nth(1).locator('.sf-accordion-trigger').click();
          const singleState = await single.evaluateAll(items => items.map(item => ({
            expanded: item.querySelector('.sf-accordion-trigger').getAttribute('aria-expanded'),
            hidden: item.querySelector('.sf-accordion-content').hidden,
          })));
          check(singleState[0].expanded === 'false' && singleState[0].hidden && singleState[1].expanded === 'true' && !singleState[1].hidden, 'Single group closes its previous sibling', singleState, context);

          const plusMinus = page.locator('.sf-accordion--plus-minus');
          await plusMinus.nth(1).locator('.sf-accordion-trigger').click();
          const indicators = await plusMinus.evaluateAll(items => items.map(item => ({
            expanded: item.querySelector('.sf-accordion-trigger').getAttribute('aria-expanded'),
            icon: item.querySelector('.sf-icon').textContent.trim(),
            hidden: item.querySelector('.sf-icon').getAttribute('aria-hidden'),
          })));
          check(indicators.every(item => item.icon === 'remove' && item.hidden === 'true'), 'Plus/minus is decorative and follows disclosure state', indicators, context);

          await page.evaluate(() => {
            const article = document.createElement('article');
            article.className = 'sf-accordion';
            article.innerHTML = '<h2 class="sf-accordion-heading"><button class="sf-accordion-trigger" type="button"><span class="sf-accordion-title">Добавлено позднее</span><i class="sf-icon" aria-hidden="true">chevron_right</i></button></h2><div class="sf-accordion-content" role="region">Динамический раздел</div>';
            document.querySelector('main').append(article);
          });
          await page.waitForFunction(() => document.querySelector(
            'main > .sf-accordion:last-child .sf-accordion-trigger[aria-controls]',
          ));
          const dynamic = await page.locator('main > .sf-accordion:last-child').evaluate(item => ({
            expanded: item.querySelector('.sf-accordion-trigger').getAttribute('aria-expanded'),
            labelled: Boolean(item.querySelector('.sf-accordion-content').getAttribute('aria-labelledby')),
          }));
          check(dynamic.expanded === 'true' && dynamic.labelled, 'Late Accordion initializes independently', dynamic, context);

          cases.push(context);
          if (width === 390 && theme === 'light' && dir === 'ltr' && font === 'normal') {
            await page.screenshot({ path: 'output/playwright/accordion-owner-mobile.png', fullPage: true });
          }
        }
      }
    }
  }

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto(`${workspace}/tests/fixtures/accordion-method-lab.html`);
  await page.waitForFunction(() => document.querySelector('.sf-accordion-trigger[aria-controls]'));
  await page.keyboard.press('Tab');
  const forced = await page.locator('.sf-accordion-trigger').first().evaluate(node => ({
    visible: node.matches(':focus-visible'),
    outline: getComputedStyle(node).outlineStyle,
  }));
  check(forced.visible && forced.outline !== 'none', 'Forced colors preserves the focus boundary', forced);

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: cases.length + 1,
    checks: cases.length * 15 + 1,
    failures,
    errors,
  };
}
