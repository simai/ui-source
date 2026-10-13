/* global document, getComputedStyle, innerWidth */
// Run against the verified ui-doc build to validate the public Tags page.
async page => {
  const failures = [];
  const errors = [];
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
  await page.route('**/*.woff2*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
  });

  const base = 'http://127.0.0.1:8909';
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      const context = { width, theme };
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/ru/components/tags/`);
      await page.waitForFunction(expectedTheme => document.documentElement.classList.contains(`theme-${expectedTheme}`), theme);

      const examples = page.locator('[data-docara-example]');
      check(await examples.count() === 7, 'All documented Tag variants have live examples', await examples.count(), context);
      check(!(await examples.evaluateAll(nodes => nodes.some(node => node.dataset.docaraExamplePreviewResolved !== 'sandbox'))), 'Examples use the isolated preview contract', null, context);

      const frames = [];
      for (let index = 0; index < await examples.count(); index += 1) {
        const iframe = examples.nth(index).locator('iframe');
        const frame = await (await iframe.elementHandle()).contentFrame();
        await frame.waitForSelector('.sf-tag');
        await frame.waitForFunction(expectedTheme => (
          document.documentElement.dataset.docaraExampleReady === 'true'
          && document.documentElement.classList.contains(`theme-${expectedTheme}`)
        ), theme, { timeout: 60000 });
        const state = await frame.locator('body').evaluate(body => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          height: Math.ceil(body.getBoundingClientRect().height),
        }));
        const shell = await iframe.evaluate(node => ({ scrolling: node.getAttribute('scrolling'), height: node.getBoundingClientRect().height }));
        check(!state.overflow, 'Example has no horizontal overflow', state, { ...context, index });
        check(shell.scrolling === 'no' && shell.height >= state.height, 'Example iframe expands without its own scrollbar', { state, shell }, { ...context, index });
        frames.push(frame);
      }

      const overview = await frames[0].locator('.sf-tag').evaluate(node => ({ tag: node.tagName, role: node.getAttribute('role'), tab: node.getAttribute('tabindex') }));
      check(overview.tag === 'DIV' && overview.role === null && overview.tab === null, 'Static Tag has no false action semantics', overview, context);

      const types = await frames[1].locator('body').evaluate(body => {
        const toggle = body.querySelector('button.sf-tag');
        return {
          toggle: toggle?.tagName,
          pressed: toggle?.getAttribute('aria-pressed'),
          nestedActions: toggle?.querySelectorAll('button, input, a[href]').length,
          decorationsHidden: [...body.querySelectorAll('.sf-tag-check, .sf-tag-icon, .sf-tag-color-icon, .sf-avatar')]
            .every(node => node.getAttribute('aria-hidden') === 'true'),
        };
      });
      check(types.toggle === 'BUTTON' && types.pressed === 'false' && types.nestedActions === 0, 'Selectable Tag owns one native toggle action', types, context);
      check(types.decorationsHidden, 'Redundant Tag visuals are hidden from the accessibility tree', types, context);
      await frames[1].locator('button.sf-tag').click();
      const toggled = await frames[1].locator('button.sf-tag').evaluate(node => ({
        pressed: node.getAttribute('aria-pressed'),
        active: node.classList.contains('active'),
      }));
      check(toggled.pressed === 'true' && toggled.active, 'Ordinary example synchronizes selected state', toggled, context);

      const actions = await frames[3].locator('body').evaluate(body => ({
        count: body.querySelector('.sf-tag-count')?.textContent.trim(),
        root: body.querySelector('.sf-tag--removable')?.tagName,
        closeName: body.querySelector('.sf-tag--removable button')?.getAttribute('aria-label'),
      }));
      check(actions.count === '12' && actions.root === 'DIV' && actions.closeName === 'Удалить тег Важное', 'Count and removal keep separate semantic owners', actions, context);
      await frames[3].locator('.sf-tag--removable button').click();
      check(await frames[3].locator('.sf-tag--removable').count() === 0, 'Ordinary example performs the requested removal', null, context);

      const states = await frames[4].locator('body').evaluate(body => ({
        selected: body.querySelector('[aria-pressed="true"]')?.tagName,
        disabled: Boolean(body.querySelector('button:disabled[aria-pressed="false"]')),
      }));
      check(states.selected === 'BUTTON' && states.disabled, 'Selected and disabled states use native button semantics', states, context);

      const sizes = await frames[5].locator('.sf-tag').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        const textStyle = getComputedStyle(node.querySelector('.sf-tag-container'));
        return { fontSize: textStyle.fontSize, radius: style.borderStartStartRadius };
      }));
      check(sizes.length === 2 && sizes[0].fontSize !== sizes[1].fontSize, 'Token sizes change Tag typography', sizes, context);
      check(sizes.every(item => item.radius !== '0px'), 'Both sizes preserve the compact UI radius', sizes, context);
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Documentation page has no horizontal overflow', null, context);

      if (width === 390 && theme === 'light') {
        await examples.nth(1).scrollIntoViewIfNeeded();
        await examples.nth(1).screenshot({ path: 'output/playwright/tags-owner-docs-mobile.png' });
      }
    }
  }

  await page.goto(`${base}/ru/smart-components/reference/tags/`);
  const smartText = await page.locator('main').innerText();
  for (const expected of ['экспериментальный', 'aria-pressed', 'detail.active', 'закреплённую проекцию ассетов']) {
    if (!smartText.includes(expected)) failures.push({ name: 'Smart Tags source contract is documented', expected });
  }

  return { status: failures.length || errors.length ? 'failed' : 'passed', cases: 5, checks: 64, failures, errors };
}
