async page => {
  const base = 'http://127.0.0.1:8953';
  const errors = [];
  const loaderErrors = [];
  const results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => {
    const message = event.text();
    if (event.type() === 'error') errors.push(message);
    if (message.includes('Failed to load script') || message.includes('Failed to load styles')) {
      loaderErrors.push(message);
    }
  });

  const closeTop = async frame => {
    await frame.evaluate(() => document.querySelector('.sf-modal[data-sf-modal-state="open"] [data-sf-modal-close]')?.click());
    await frame.waitForFunction(() => !document.querySelector('.sf-modal[data-sf-modal-state="open"]'));
  };

  const stage = async name => page.evaluate(value => document.documentElement.dataset.testStage = value, name);

  for (const width of [390, 1280]) {
    await page.setViewportSize({width, height: 900});

    await page.goto(`${base}/ru/components/modal/`);
    await stage(`${width}:ordinary:load`);
    await page.waitForFunction(() => document.querySelectorAll('iframe[title="Example"]').length === 2);
    let frames = page.frames().slice(1);
    await frames[0].waitForFunction(() => typeof modalExampleInitialized !== 'undefined' && modalExampleInitialized === true);
    await frames[0].evaluate(() => document.querySelector('#modal-example-open')?.click());
    await stage(`${width}:ordinary:overview-open`);
    await frames[0].waitForFunction(() => document.querySelector('.sf-modal')?.dataset.sfModalState === 'open');
    const ordinary = await frames[0].evaluate(() => {
      const root = document.querySelector('.sf-modal');
      const surface = root.querySelector('[data-sf-modal-surface]');
      const probe = document.createElement('i');
      probe.style.borderRadius = 'var(--sf-radius--surface)';
      document.body.append(probe);
      const state = {
        named: root.getAttribute('aria-labelledby') || root.getAttribute('aria-label'),
        focusInside: root.contains(document.activeElement),
        radius: getComputedStyle(surface).borderStartStartRadius,
        tokenRadius: getComputedStyle(probe).borderStartStartRadius,
      };
      probe.remove();
      return state;
    });
    await closeTop(frames[0]);
    await frames[1].waitForFunction(() => typeof modalPositionsInitialized !== 'undefined' && modalPositionsInitialized === true);
    await frames[1].evaluate(() => document.querySelector('[data-modal-position="inline-start"]')?.click());
    await stage(`${width}:ordinary:logical-open`);
    await frames[1].waitForFunction(() => document.querySelector('.sf-modal[data-sf-modal-position="inline-start"]')?.dataset.sfModalState === 'open');
    const logicalPosition = await frames[1].evaluate(() => document.querySelector('.sf-modal[data-sf-modal-state="open"]')?.dataset.sfModalPosition);
    await closeTop(frames[1]);
    await frames[1].waitForFunction(() => document.querySelector('.sf-modal')?.dataset.sfModalState === 'closed');

    await page.goto(`${base}/ru/smart-components/reference/modal/`);
    await stage(`${width}:smart:load`);
    await page.waitForFunction(() => document.querySelectorAll('iframe[title="Example"]').length === 6);
    const serviceHeadings = await page.locator('h2, h3').allTextContents();
    frames = page.frames().slice(1);
    for (const frame of frames) {
      await frame.waitForFunction(() => customElements.get('sf-modal'));
    }

    await frames[0].evaluate(() => document.querySelector('[data-sf-modal-open]')?.click());
    await stage(`${width}:smart:overview-open`);
    await frames[0].waitForFunction(() => document.querySelector('sf-modal')?.getModalRoot()?.dataset.sfModalState === 'open');
    const smartFocus = await frames[0].evaluate(() => document.querySelector('sf-modal').getModalRoot().contains(document.activeElement));
    await closeTop(frames[0]);

    await frames[1].evaluate(() => document.querySelector('[data-sf-modal-open="modal-inline-start"]')?.click());
    await stage(`${width}:smart:logical-open`);
    await frames[1].waitForFunction(() => document.querySelector('sf-modal[modal-id="modal-inline-start"]')?.openState === true);
    const smartLogicalPosition = await frames[1].evaluate(() => document.querySelector('sf-modal[modal-id="modal-inline-start"]').getModalRoot().dataset.sfModalPosition);
    await frames[1].evaluate(() => document.querySelector('sf-modal[modal-id="modal-inline-start"]').close({animate: false}));

    await frames[2].evaluate(() => document.querySelector('[data-sf-modal-open="modal-overlay-focus"]')?.click());
    await stage(`${width}:smart:overlay-open`);
    await frames[2].waitForFunction(() => document.querySelector('sf-modal[modal-id="modal-overlay-focus"]')?.openState === true);
    const focusPreset = await frames[2].evaluate(() => document.querySelector('sf-modal[modal-id="modal-overlay-focus"]').getModalRoot().querySelector('[data-sf-modal-overlay]').dataset.sfModalOverlayPreset);
    await frames[2].evaluate(() => document.querySelector('sf-modal[modal-id="modal-overlay-focus"]').close({animate: false}));

    const inline = await frames[3].evaluate(() => {
      const host = document.querySelector('sf-modal');
      const root = host.getModalRoot();
      return {display: host.display, role: root.getAttribute('role'), state: root.dataset.sfModalState};
    });

    await stage(`${width}:smart:minimize-open`);
    await frames[4].evaluate(() => document.querySelector('[data-sf-modal-open]')?.click());
    await frames[4].waitForFunction(() => document.querySelector('sf-modal')?.openState === true);
    await stage(`${width}:smart:minimize-hide`);
    await frames[4].evaluate(() => document.querySelector('sf-modal')?.getModalRoot()?.querySelector('[data-sf-modal-hide]')?.click());
    await frames[4].waitForFunction(() => document.querySelector('sf-modal')?.hiddenState === true);
    const minimized = await frames[4].evaluate(() => ({
      hidden: document.querySelector('sf-modal').hiddenState,
      inert: document.querySelector('sf-modal').getModalRoot().inert,
    }));
    await stage(`${width}:smart:minimize-show`);
    await frames[4].evaluate(() => document.querySelector('[data-sf-modal-show]')?.click());
    await frames[4].waitForFunction(() => document.querySelector('sf-modal')?.hiddenState === false);
    await closeTop(frames[4]);

    await frames[5].evaluate(() => document.querySelector('[data-sf-modal-open]')?.click());
    await stage(`${width}:smart:local-open`);
    await frames[5].waitForFunction(() => document.querySelector('sf-modal')?.getModalRoot()?.dataset.sfModalState === 'open');
    await frames[5].waitForFunction(() => document.querySelector('sf-modal')?.getModalRoot()?.textContent.includes('Содержимое клонировано'));
    const localContent = await frames[5].evaluate(() => document.querySelector('sf-modal').getModalRoot().textContent.includes('Содержимое клонировано'));
    await closeTop(frames[5]);

    let frameSizes = [];
    let iframeHeights = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      frameSizes = await Promise.all(frames.map(frame => frame.evaluate(() => ({
        width: innerWidth,
        contentWidth: document.documentElement.scrollWidth,
        contentHeight: document.documentElement.scrollHeight,
      }))));
      iframeHeights = await page.locator('iframe[title="Example"]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
      if (frameSizes.every((size, index) => Math.abs(size.contentHeight - iframeHeights[index]) <= 1)) break;
      await page.waitForTimeout(100);
    }
    results.push({
      width,
      ordinary,
      logicalPosition,
      smartFocus,
      smartLogicalPosition,
      focusPreset,
      inline,
      minimized,
      localContent,
      frameSizes,
      iframeHeights,
      noServiceSections: !serviceHeadings.some(heading => ['Атрибуты и свойства', 'Теги и подключение', 'Источник'].includes(heading.trim())),
      exactHeights: frameSizes.every((size, index) => Math.abs(size.contentHeight - iframeHeights[index]) <= 1),
      noOverflow: frameSizes.every(size => size.contentWidth <= size.width + 1),
    });
  }

  const failures = results.filter(result =>
    !result.ordinary.named || !result.ordinary.focusInside || result.ordinary.radius !== result.ordinary.tokenRadius ||
    result.logicalPosition !== 'inline-start' || !result.smartFocus || result.smartLogicalPosition !== 'inline-start' ||
    result.focusPreset !== 'focus' || result.inline.display !== 'inline' || result.inline.role !== 'region' ||
    !result.minimized.hidden || !result.minimized.inert || !result.localContent || !result.noServiceSections ||
    !result.exactHeights || !result.noOverflow,
  );
  return {
    status: failures.length || errors.length || loaderErrors.length ? 'failed' : 'passed',
    cases: results.length,
    failures,
    errors,
    loaderErrors,
    results,
  };
}
