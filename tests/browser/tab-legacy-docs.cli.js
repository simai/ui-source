/* global document, getComputedStyle */
async page => {
  const failures = [], errors = [];
  const check = (ok, name, actual = null) => { if (!ok) failures.push({name, actual}); };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const source = message.location().url;
    if (message.type() === 'error' && !source.endsWith('/favicon.ico') && message.text() !== 'A network error occurred.') errors.push(message.text());
  });
  const pathFor = async path => {
    await page.waitForFunction(expected => [...document.querySelectorAll('iframe')]
      .some(frame => frame.srcdoc.includes(`<base href="/_docara/examples/${expected}/">`)), path);
    for (const frame of page.frames()) {
      if (await frame.locator(`base[href="/_docara/examples/${path}/"]`).count()) return frame;
    }
    return null;
  };

  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8926/ru/components/tab/');
  check(await page.locator('[data-docara-example]').count() === 2, 'Page contains both live legacy examples');
  check((await page.locator('main').innerText()).includes('Вкладка (совместимость)'), 'Page exposes the legacy boundary');
  check((await page.locator('main').innerText()).includes('Для нового интерфейса'), 'Page directs new interfaces to Tabs');

  const overview = await pathFor('components/tab/overview');
  const states = await pathFor('components/tab/states');
  const candidate = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/component/tab';
  for (const frame of [overview, states]) {
    await frame.addStyleTag({url: `${candidate}/css/tab.css`});
    await frame.addScriptTag({url: `${candidate}/js/tab.js`});
  }
  await overview.waitForFunction(() => document.querySelector('.sf-tab.initialized [role="tab"]'));
  await states.waitForFunction(() => document.querySelector('.sf-tab.initialized [role="tab"]'));

  check(await overview.locator('[role="tab"]').count() === 2 && await overview.locator('[role="tabpanel"]').count() === 2, 'Overview exposes paired tabs and panels');
  await overview.locator('[role="tab"]').nth(1).click();
  check(await overview.locator('[role="tab"]').nth(1).getAttribute('aria-selected') === 'true', 'Overview switches by pointer');
  await overview.locator('[role="tab"]').first().focus();
  await overview.locator('[role="tab"]').first().press('ArrowRight');
  check(await overview.locator('[role="tab"]').nth(1).getAttribute('aria-selected') === 'true', 'Overview switches by keyboard');

  const state = await states.locator('.sf-tab').evaluate(root => ({
    active: root.getAttribute('data-active'),
    selected: [...root.querySelectorAll('[role="tab"]')].findIndex(tab => tab.getAttribute('aria-selected') === 'true'),
    disabled: root.querySelectorAll('[role="tab"]')[1].getAttribute('aria-disabled'),
    fontSizes: [...root.querySelectorAll('[role="tab"], [role="tabpanel"]')].map(node => getComputedStyle(node).fontSize),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  check(state.active === '2' && state.selected === 2 && state.disabled === 'true', 'States example honors initial and disabled inputs', state);
  check(!state.overflow, 'Examples do not create horizontal overflow', state);
  check(new Set(state.fontSizes).size === 1, 'Tab labels and panels inherit one body typography', state);

  const heights = await page.locator('[data-docara-example] iframe').evaluateAll(frames => frames.map(frame => ({
    frame: frame.getBoundingClientRect().height,
    body: frame.contentDocument?.documentElement.scrollHeight || 0,
  })));
  check(heights.every(item => item.frame + 2 >= item.body), 'Example iframes follow intrinsic content height', heights);
  await page.locator('[data-docara-example]').nth(1).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({path: 'output/playwright/tab-legacy-docs-mobile.png'});

  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: 1, checks: 11, failures, errors};
}
