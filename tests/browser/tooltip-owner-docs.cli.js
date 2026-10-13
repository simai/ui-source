/* global document, dispatchEvent, Event, getComputedStyle, innerHeight, innerWidth */
async page => {
  const failures = [], errors = [];
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
  await page.route('**/*.woff2*', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'access-control-allow-origin': '*' },
    });
  });

const base = 'http://127.0.0.1:8912';
  const candidate = 'http://127.0.0.1:8765/ui-source/source/output/tooltip-owner-browser';
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      const context = { width, theme };
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/ru/components/tooltip/`);
      await page.waitForFunction(
        expected => document.documentElement.classList.contains(`theme-${expected}`),
        theme,
      );

      const examples = page.locator('[data-docara-example]');
      check(await examples.count() === 5, 'All Tooltip variants have live examples', await examples.count(), context);
      check(!(await examples.evaluateAll(nodes => nodes.some(
        node => node.dataset.docaraExamplePreviewResolved !== 'sandbox',
      ))), 'Tooltip examples keep isolated preview mode', null, context);

      const frames = [];
      for (let index = 0; index < await examples.count(); index += 1) {
        const iframe = examples.nth(index).locator('iframe');
        const frame = await (await iframe.elementHandle()).contentFrame();
        await frame.waitForLoadState('load');
        await frame.waitForSelector('.sf-tooltip', { state: 'attached' });
        await frame.waitForFunction(expected => (
          document.documentElement.dataset.docaraExampleReady === 'true'
          && document.documentElement.classList.contains(`theme-${expected}`)
        ), theme, { timeout: 60000 });
        await frame.addStyleTag({ url: `${candidate}/component/tooltip/css/tooltip.css` });
        await frame.addScriptTag({ url: `${candidate}/component/tooltip/js/tooltip.js` });
        await frame.waitForFunction(() => getComputedStyle(
          document.querySelector('.sf-tooltip-text'),
        ).getPropertyValue('--sf-tooltip-text--font-size').trim() !== '');
        await frame.evaluate(() => dispatchEvent(new Event('resize')));
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
      await overview.waitForFunction(() => document.querySelector('[data-tooltip]')?.getAttribute('aria-describedby'));
      const initial = await overview.locator('.sf-tooltip-anchor').evaluate(anchor => {
        const trigger = anchor.querySelector('[data-tooltip]');
        const tooltip = anchor.querySelector('.sf-tooltip');
        return {
          hidden: tooltip.hidden,
          role: tooltip.getAttribute('role'),
          describedBy: trigger.getAttribute('aria-describedby'),
          expanded: trigger.hasAttribute('aria-expanded'),
          popup: trigger.hasAttribute('aria-haspopup'),
        };
      });
      check(initial.hidden && initial.role === 'tooltip' && initial.describedBy === 'save-tooltip', 'Overview exposes the exact Tooltip relationship', initial, context);
      check(!initial.expanded && !initial.popup, 'Overview does not claim popup state', initial, context);

      await overview.locator('[data-tooltip]').focus();
      check(!(await overview.locator('#save-tooltip').evaluate(node => node.hidden)), 'Keyboard focus opens the real example', null, context);
      const overviewVisual = await overview.locator('#save-tooltip').evaluate(node => {
        const tooltip = node.getBoundingClientRect();
        const content = node.querySelector('.sf-tooltip-content').getBoundingClientRect();
        const text = node.querySelector('.sf-tooltip-text');
        const textRect = text.getBoundingClientRect();
        return {
          tooltip: { top: tooltip.top, bottom: tooltip.bottom },
          content: { top: content.top, bottom: content.bottom },
          text: {
            top: textRect.top,
            bottom: textRect.bottom,
            clientHeight: text.clientHeight,
            scrollHeight: text.scrollHeight,
          },
          viewportHeight: innerHeight,
        };
      });
      check(
        overviewVisual.tooltip.top >= 0
          && overviewVisual.tooltip.bottom <= overviewVisual.viewportHeight
          && overviewVisual.text.top >= overviewVisual.content.top
          && overviewVisual.text.bottom <= overviewVisual.content.bottom
          && overviewVisual.text.scrollHeight <= overviewVisual.text.clientHeight,
        'Open Tooltip and its text stay fully visible inside the preview',
        overviewVisual,
        context,
      );
      await overview.locator('[data-tooltip]').press('Escape');
      const escaped = await overview.locator('.sf-tooltip-anchor').evaluate(anchor => ({
        focused: anchor.ownerDocument.activeElement === anchor.querySelector('[data-tooltip]'),
        hidden: anchor.querySelector('.sf-tooltip').hidden,
      }));
      check(escaped.focused && escaped.hidden, 'Escape dismisses without moving focus', escaped, context);

      const appearances = await frames[1].frame.locator('.sf-tooltip').evaluateAll(nodes => nodes.map(node => ({
        hiddenFromTree: node.getAttribute('aria-hidden'),
        background: getComputedStyle(node.querySelector('.sf-tooltip-content')).backgroundColor,
      })));
      check(appearances.length === 2 && appearances.every(item => item.hiddenFromTree === 'true') && appearances[0].background !== appearances[1].background, 'Appearance showcase is decorative and visually distinct', appearances, context);

      await frames[2].frame.waitForFunction(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const rawToken = rootStyle.getPropertyValue('--sf-text-size-3').trim();
        const expected = rawToken.endsWith('rem')
          ? `${parseFloat(rawToken) * parseFloat(rootStyle.fontSize)}px`
          : rawToken;
        return getComputedStyle(document.querySelector('.sf-tooltip--size-3 .sf-tooltip-text')).fontSize === expected;
      });
      const sizes = await frames[2].frame.locator('.sf-tooltip-text').evaluateAll(nodes => nodes.map(node => {
        const size = [...node.closest('.sf-tooltip').classList]
          .find(className => className.startsWith('sf-tooltip--size-'))
          .replace('sf-tooltip--size-', '');
        const rootStyle = getComputedStyle(document.documentElement);
        const rawToken = rootStyle.getPropertyValue(`--sf-text-size-${size}`).trim();
        const token = rawToken.endsWith('rem')
          ? `${parseFloat(rawToken) * parseFloat(rootStyle.fontSize)}px`
          : rawToken;
        return {
          size,
          actual: getComputedStyle(node).fontSize,
          token,
        };
      }));
      check(
        sizes.every(item => item.actual === item.token),
        'Every Tooltip size resolves through its matching adaptive text token',
        sizes,
        context,
      );
      check(
        new Set(sizes.map(item => item.actual)).size === (width < 960 ? 4 : 5),
        'Tooltip size scale follows the adaptive token contract',
        sizes,
        context,
      );

      const arrows = await frames[3].frame.locator('.sf-tooltip').evaluateAll(nodes => nodes.map(node => ({
        classes: node.className,
        tail: getComputedStyle(node.querySelector('.sf-tooltip-tail')).display,
      })));
      check(arrows.length === 7 && arrows.filter(item => item.tail === 'none').length === 1, 'All logical tail variants and no-arrow are visible', arrows, context);

      const wrapping = frames[4].frame;
      await wrapping.waitForFunction(() => document.querySelector('[data-tooltip]')?.getAttribute('aria-describedby'));
      await wrapping.locator('[data-tooltip]').focus();
      const longText = await wrapping.locator('.sf-tooltip').evaluate(node => ({
        hidden: node.hidden,
        width: node.getBoundingClientRect().width,
        viewport: innerWidth,
        fits: [...node.querySelectorAll('.sf-tooltip-text, .sf-tooltip-supporting-text')]
          .every(text => text.scrollWidth <= text.clientWidth + 1),
      }));
      check(!longText.hidden && longText.fits && longText.width < longText.viewport, 'Long Tooltip stays complete within the preview viewport', longText, context);
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Documentation page has no horizontal overflow', null, context);

      if (width === 390 && theme === 'light') {
        await examples.nth(0).scrollIntoViewIfNeeded();
        await overview.locator('[data-tooltip]').focus();
        await examples.nth(0).screenshot({ path: 'output/playwright/tooltip-owner-docs-mobile.png' });
      }
    }
  }

  await page.goto(`${base}/ru/smart-components/reference/tooltip/`);
  const smartText = await page.locator('main').innerText();
  for (const expected of ['source-кандидат', 'data-tooltip', 'aria-describedby', 'Escape', 'popover']) {
    check(smartText.includes(expected), 'Smart reference documents the source contract', expected);
  }

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: 5,
    checks: 57,
    failures,
    errors,
  };
}
