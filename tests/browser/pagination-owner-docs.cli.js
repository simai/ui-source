/* global document, dispatchEvent, Event, getComputedStyle, innerWidth */
// Run against the verified ui-doc build to validate the public Pagination page.
async page => {
  const failures = [];
  const errors = [];
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
  await page.route('**/*.woff2*', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'access-control-allow-origin': '*' },
    });
  });

  const base = 'http://127.0.0.1:8909';
  const candidateCss = 'http://127.0.0.1:8910/component/pagination/css/pagination.css';
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/ru/components/pagination/`);
      await page.waitForFunction(expectedTheme => document.documentElement.classList.contains(`theme-${expectedTheme}`), theme);

      const examples = page.locator('[data-docara-example]');
      if (await examples.count() !== 5) failures.push({ check: 'example count', count: await examples.count(), width, theme });
      if (await examples.evaluateAll(nodes => nodes.some(node => node.dataset.docaraExamplePreviewResolved !== 'sandbox'))) failures.push({ check: 'sandbox mode', width, theme });
      const frames = [];
      for (let index = 0; index < await examples.count(); index += 1) {
        const iframe = examples.nth(index).locator('iframe');
        const frame = await (await iframe.elementHandle()).contentFrame();
        await frame.waitForSelector('.sf-pagination');
        await frame.waitForFunction(expectedTheme => (
          document.documentElement.dataset.docaraExampleReady === 'true'
          && document.documentElement.classList.contains(`theme-${expectedTheme}`)
        ), theme, { timeout: 60000 });
        await frame.addStyleTag({ url: candidateCss });
        await frame.evaluate(() => dispatchEvent(new Event('resize')));
        frames.push({ frame, iframe });
        let frameState;
        let frameContract;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          frameState = await frame.locator('body').evaluate(body => {
            const style = getComputedStyle(body);
            const rect = body.getBoundingClientRect();
            let contentTop = rect.top - (parseFloat(style.marginTop) || 0);
            let contentBottom = rect.bottom + (parseFloat(style.marginBottom) || 0);
            for (const child of body.children) {
              const childRect = child.getBoundingClientRect();
              const childStyle = getComputedStyle(child);
              contentTop = Math.min(contentTop, childRect.top - (parseFloat(childStyle.marginTop) || 0));
              contentBottom = Math.max(contentBottom, childRect.bottom + (parseFloat(childStyle.marginBottom) || 0));
            }
            return {
              height: Math.ceil(Math.max(0, contentBottom - contentTop)),
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          frameContract = await iframe.evaluate(node => ({
            scrolling: node.getAttribute('scrolling'),
            height: node.getBoundingClientRect().height,
          }));
          if (frameContract.height >= frameState.height && frameContract.height - frameState.height <= 8) break;
          await page.waitForTimeout(50);
        }
        if (frameState.overflow) failures.push({ check: 'frame overflow', index, width, theme, frameState });
        if (frameContract.scrolling !== 'no' || frameContract.height < frameState.height || frameContract.height - frameState.height > 8) failures.push({ check: 'intrinsic frame height', index, width, theme, frameContract, frameState });
      }

      const overview = await frames[0].frame.locator('nav').evaluate(nav => ({
        name: nav.getAttribute('aria-label'),
        list: nav.querySelector('.sf-pagination-list')?.tagName,
        current: nav.querySelectorAll('[aria-current="page"]').length,
        namedButtons: [...nav.querySelectorAll('button')].every(button => button.getAttribute('aria-label')),
        genericTransition: Boolean(nav.querySelector('.transition')),
      }));
      if (overview.name !== 'Страницы результатов' || overview.list !== 'OL' || overview.current !== 1 || !overview.namedButtons || overview.genericTransition) failures.push({ check: 'overview contract', width, theme, overview });

      const range = await frames[1].frame.locator('nav').evaluate(nav => ({
        current: nav.querySelectorAll('[aria-current="page"]').length,
        ellipses: [...nav.querySelectorAll('.sf-page-number--ellipsis')].map(item => ({ tag: item.tagName, action: Boolean(item.closest('button,a')) })),
        wrappedNumbers: [...nav.querySelectorAll('.sf-page-number')].filter(item => getComputedStyle(item).whiteSpace !== 'nowrap').map(item => item.textContent.trim()),
      }));
      if (range.current !== 1 || range.ellipses.length !== 2 || range.ellipses.some(item => item.tag !== 'SPAN' || item.action) || range.wrappedNumbers.length) failures.push({ check: 'long-range contract', width, theme, range });

      const links = await frames[2].frame.locator('nav').evaluate(nav => ({
        actions: [...nav.querySelectorAll('.sf-page-number')].map(item => ({ tag: item.tagName, href: item.getAttribute('href') })),
        current: nav.querySelectorAll('[aria-current="page"]').length,
      }));
      if (links.current !== 1 || links.actions.some(item => item.tag !== 'A' || !item.href)) failures.push({ check: 'URL navigation contract', width, theme, links });

      const shapes = await frames[3].frame.locator('nav').evaluateAll(nodes => nodes.map(nav => ({ name: nav.getAttribute('aria-label'), current: nav.querySelectorAll('[aria-current="page"]').length })));
      if (shapes.length !== 2 || shapes.some(item => !item.name || item.current !== 1)) failures.push({ check: 'shape variants', width, theme, shapes });

      const states = await frames[4].frame.locator('nav').evaluate(nav => ({
        current: nav.querySelectorAll('[aria-current="page"]').length,
        disabled: nav.querySelectorAll('button:disabled').length,
      }));
      if (states.current !== 1 || states.disabled !== 1) failures.push({ check: 'state variants', width, theme, states });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push({ check: 'page overflow', width, theme });

      if (width === 390 && theme === 'light') {
        await examples.nth(1).scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        await examples.nth(1).screenshot({ path: 'output/playwright/pagination-owner-docs-mobile.png' });
      }
    }
  }

  await page.goto(`${base}/ru/smart-components/reference/pagination/`);
  const smartText = await page.locator('main').innerText();
  for (const expected of ['экспериментальный', 'selected-count', 'Многоточие не является кнопкой', 'Границы композиции']) {
    if (!smartText.includes(expected)) failures.push({ check: 'Smart reference source contract', expected });
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 5, failures, errors };
}
