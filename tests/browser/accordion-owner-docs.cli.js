/* global document, dispatchEvent, Event, getComputedStyle, innerWidth, requestAnimationFrame */
async page => {
  const failures = [], errors = [];
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
  await page.route('**/*.woff2*', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'access-control-allow-origin': '*' },
    });
  });

  const base = 'http://127.0.0.1:8912';
  const candidate = 'http://127.0.0.1:8765/ui-source/source/output/accordion-owner-browser';
  const candidateCss = await (await page.request.get(
    `${candidate}/component/accordion/css/accordion.css`,
  )).text();
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      const context = { width, theme };
      await page.emulateMedia({ colorScheme: theme, forcedColors: 'none', reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/ru/components/accordion/`);
      await page.waitForFunction(
        expected => document.documentElement.classList.contains(`theme-${expected}`),
        theme,
      );

      const examples = page.locator('[data-docara-example]');
      check(await examples.count() === 7, 'All Accordion variants have live examples', await examples.count(), context);
      check(!(await examples.evaluateAll(nodes => nodes.some(
        node => node.dataset.docaraExamplePreviewResolved !== 'sandbox',
      ))), 'Accordion examples keep isolated preview mode', null, context);

      const frames = [];
      for (let index = 0; index < await examples.count(); index += 1) {
        const iframe = examples.nth(index).locator('iframe');
        const frame = await (await iframe.elementHandle()).contentFrame();
        await frame.waitForLoadState('load');
        await frame.waitForSelector('.sf-accordion-trigger[aria-controls]');
        await frame.waitForFunction(expected => (
          document.documentElement.dataset.docaraExampleReady === 'true'
          && document.documentElement.classList.contains(`theme-${expected}`)
        ), theme, { timeout: 60000 });
        await frame.addStyleTag({ content: candidateCss });
        await frame.evaluate(() => dispatchEvent(new Event('resize')));
        await frame.evaluate(() => document.getAnimations().forEach(animation => {
          try {
            animation.finish();
          } catch {
            animation.cancel();
          }
        }));
        await page.waitForTimeout(25);
        frames.push({ frame, iframe });

        const state = await frame.locator('body').evaluate(body => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          height: Math.ceil(body.getBoundingClientRect().height),
        }));
        const shell = await iframe.evaluate(node => ({
          scrolling: node.getAttribute('scrolling'),
          height: node.getBoundingClientRect().height,
        }));
        check(!state.overflow, 'Example has no horizontal overflow', state, { ...context, index });
        check(shell.scrolling === 'no' && shell.height >= state.height, 'Example iframe expands without its own scrollbar', { state, shell }, { ...context, index });
      }

      const overview = frames[0].frame;
      const overviewInitial = await overview.locator('.sf-accordion').first().evaluate(item => {
        const trigger = item.querySelector('.sf-accordion-trigger');
        const content = item.querySelector('.sf-accordion-content');
        return {
          controls: trigger.getAttribute('aria-controls') === content.id,
          labelled: content.getAttribute('aria-labelledby') === trigger.id,
          expanded: trigger.getAttribute('aria-expanded'),
          titleSize: getComputedStyle(item.querySelector('.sf-accordion-title')).fontSize,
          bodySize: getComputedStyle(content).fontSize,
          width: item.getBoundingClientRect().width,
        };
      });
      check(overviewInitial.controls && overviewInitial.labelled && overviewInitial.expanded === 'true', 'Overview exposes the exact trigger and region relationship', overviewInitial, context);
      check(overviewInitial.titleSize === overviewInitial.bodySize, 'Accordion title and body use the same adaptive body size', overviewInitial, context);

      const overviewItems = overview.locator('.sf-accordion');
      await overviewItems.nth(1).locator('.sf-accordion-trigger').click();
      await overview.evaluate(() => new Promise(resolve => requestAnimationFrame(
        () => requestAnimationFrame(resolve),
      )));
      const independent = await overviewItems.evaluateAll(items => items.map(item => ({
        expanded: item.querySelector('.sf-accordion-trigger').getAttribute('aria-expanded'),
        width: item.getBoundingClientRect().width,
      })));
      check(independent.every(item => item.expanded === 'true'), 'Overview demonstrates independent disclosure', independent, context);
      check(independent.every(item => Math.abs(item.width - overviewInitial.width) < 0.5), 'Example disclosure does not change width', independent, context);
      check(!(await overviewItems.nth(1).locator('.sf-accordion-trigger').evaluate(node => node.matches(':focus-visible'))), 'Pointer activation remains visually silent', null, context);

      await overview.locator('body').click({ position: { x: 1, y: 1 } });
      await overview.locator('.sf-accordion-trigger').first().focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const keyboard = await overview.locator('.sf-accordion-trigger').first().evaluate(node => ({
        focused: document.activeElement === node,
        visible: node.matches(':focus-visible'),
        shadow: getComputedStyle(node).boxShadow,
      }));
      check(keyboard.focused && keyboard.visible && keyboard.shadow !== 'none', 'Keyboard focus encloses the complete heading', keyboard, context);

      const single = frames[1].frame.locator('.sf-accordion');
      await single.nth(1).locator('.sf-accordion-trigger').click();
      const singleState = await single.evaluateAll(items => items.map(item => ({
        expanded: item.querySelector('.sf-accordion-trigger').getAttribute('aria-expanded'),
        hidden: item.querySelector('.sf-accordion-content').hidden,
      })));
      check(singleState[0].expanded === 'false' && singleState[0].hidden && singleState[1].expanded === 'true' && !singleState[1].hidden, 'Single example closes the previous section', singleState, context);

      const plusMinus = frames[2].frame.locator('.sf-accordion');
      await plusMinus.nth(1).locator('.sf-accordion-trigger').click();
      await frames[2].frame.waitForFunction(() => document.querySelectorAll(
        '.sf-accordion-trigger[aria-expanded="true"]',
      ).length === 2);
      const icons = await plusMinus.evaluateAll(items => items.map(item => item.querySelector('.sf-icon').textContent.trim()));
      check(icons.every(icon => icon === 'remove'), 'Plus/minus example follows open state', icons, context);

      const filled = await frames[3].frame.locator('.sf-accordion').evaluate(node => {
        const probe = document.createElement('span');
        probe.style.backgroundColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--sf-surface-container');
        document.body.append(probe);
        const result = {
          background: getComputedStyle(node).backgroundColor,
          probe: getComputedStyle(probe).backgroundColor,
        };
        probe.remove();
        return result;
      });
      const outline = await frames[4].frame.locator('.sf-accordion').evaluate(node => ({
        background: getComputedStyle(node).backgroundColor,
        border: getComputedStyle(node).borderStyle,
      }));
      const flush = await frames[5].frame.locator('.sf-accordion').first().evaluate(node => ({
        background: getComputedStyle(node).backgroundColor,
        radius: getComputedStyle(node).borderStartStartRadius,
        border: getComputedStyle(node).borderBlockEndStyle,
      }));
      check(
        !transparent(filled.background) && filled.background === filled.probe,
        'Filled example retains its container surface',
        filled,
        context,
      );
      check(transparent(outline.background) && outline.border !== 'none', 'Outline example uses a transparent bordered surface', outline, context);
      check(transparent(flush.background) && flush.radius === '0px' && flush.border !== 'none', 'Flush example uses a boundary without card geometry', flush, context);
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Documentation page has no horizontal overflow', null, context);

      if (width === 390 && theme === 'light') {
        await examples.nth(0).scrollIntoViewIfNeeded();
        await examples.nth(0).screenshot({ path: 'output/playwright/accordion-owner-docs-mobile.png' });
      }
    }
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: 4,
    checks: 116,
    failures,
    errors,
  };
}
