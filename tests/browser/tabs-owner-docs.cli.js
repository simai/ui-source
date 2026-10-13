/* global document, getComputedStyle */
async page => {
  const failures = [], errors = [];
  const check = (ok, name, actual = null) => {
    if (!ok) failures.push({name, actual});
  };
  page.on('pageerror', error => errors.push(error.message));
  const findFrame = async path => {
    await page.waitForFunction(expected => [...document.querySelectorAll('iframe')]
      .some(frame => frame.srcdoc.includes(`<base href="/_docara/examples/${expected}/">`)), path);
    for (const frame of page.frames()) {
      if (await frame.locator(`base[href="/_docara/examples/${path}/"]`).count()) return frame;
    }
    return null;
  };
  const prepareSmart = async frame => {
    const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
    for (const path of [
      'component/buttons/css/buttons.css',
      'component/icon-buttons/css/icon-buttons.css',
      'component/tabs/css/tabs.css',
      'smart/icon-buttons/css/icon-buttons.css',
      'smart/tabs/css/tabs.css',
      'smart/tabs/template/default.css',
    ]) await frame.addStyleTag({url: `${base}/${path}`});
    for (const name of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) {
      await frame.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    }
  };
  const prepareOrdinary = frame => frame.addScriptTag({
    url: 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/component/tabs/js/tabs.js',
  });

  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('http://127.0.0.1:8912/ru/components/tabs/');
  check(await page.locator('[data-docara-example]').count() === 8, 'Ordinary page contains eight live examples');
  const overview = await findFrame('components/tabs/overview');
  await prepareOrdinary(overview);
  await overview.waitForTimeout(500);
  const ordinaryStart = await overview.locator('[role="tab"]').evaluateAll(tabs => tabs.map(tab => ({selected: tab.getAttribute('aria-selected'), tabIndex: tab.tabIndex})));
  check(ordinaryStart.length === 3 && ordinaryStart.filter(item => item.tabIndex === 0).length === 1, 'Ordinary overview has one tab stop', ordinaryStart);
  await overview.locator('[role="tab"]').first().focus();
  await overview.locator('[role="tab"]').first().press('ArrowRight');
  check(await overview.locator('[role="tab"]').nth(1).getAttribute('aria-selected') === 'true', 'Ordinary keyboard navigation activates the next panel');
  const disabled = await findFrame('components/tabs/disabled');
  await prepareOrdinary(disabled);
  await disabled.waitForTimeout(500);
  await disabled.locator('[role="tab"]').first().focus();
  await disabled.locator('[role="tab"]').first().press('ArrowRight');
  check(await disabled.locator('[role="tab"]').nth(2).getAttribute('aria-selected') === 'true', 'Ordinary keyboard navigation skips disabled tabs');
  const icons = await findFrame('components/tabs/icons');
  await icons.waitForTimeout(500);
  check(await icons.locator('[role="tab"][aria-label]').count() === 2, 'Icon-only ordinary tabs retain authored names');
  const dynamic = await findFrame('components/tabs/dynamic');
  await prepareOrdinary(dynamic);
  await dynamic.locator('body > .grid > button').click();
  await dynamic.waitForTimeout(500);
  check(await dynamic.locator('[role="tab"]').count() === 2 && await dynamic.locator('[role="tabpanel"]').count() === 2, 'Dynamic ordinary example is observed without reinitialization');

  await page.goto('http://127.0.0.1:8912/ru/smart-components/reference/tabs/');
  check(await page.locator('[data-docara-example]').count() === 5, 'Smart page contains five live examples');
  const smartOverview = await findFrame('components/tabs/smart-overview');
  const smartKeyboard = await findFrame('components/tabs/smart-keyboard');
  const appearance = await findFrame('components/tabs/smart-appearance');
  const nested = await findFrame('components/tabs/smart-nested');
  const data = await findFrame('components/tabs/smart-data');
  for (const frame of [smartOverview, smartKeyboard, appearance, nested, data]) await prepareSmart(frame);
  await smartOverview.waitForTimeout(500);
  check(await smartOverview.locator('[role="tab"]').count() === 3, 'Smart overview renders three tabs');
  const smartStart = await smartOverview.locator('[role="tab"]').evaluateAll(tabs => tabs.map(tab => ({selected: tab.getAttribute('aria-selected'), tabIndex: tab.tabIndex})));
  check(smartStart.filter(item => item.tabIndex === 0).length === 1, 'Smart overview has one tab stop', smartStart);
  await smartOverview.locator('[role="tab"]').first().focus();
  await smartOverview.locator('[role="tab"]').first().press('ArrowRight');
  check(await smartOverview.locator('[role="tab"]').nth(1).getAttribute('aria-selected') === 'true', 'Smart keyboard navigation activates the next panel');
  await smartKeyboard.waitForTimeout(500);
  check(await smartKeyboard.locator('[role="tab"]').count() === 7, 'Smart variants render their complete tab lists');
  const firstGroup = smartKeyboard.locator('sf-tabs').first();
  await firstGroup.locator('[role="tab"]').first().focus();
  await firstGroup.locator('[role="tab"]').first().press('ArrowRight');
  check(await firstGroup.locator('[role="tab"]').nth(2).getAttribute('aria-selected') === 'true', 'Smart keyboard navigation skips disabled tabs');
  check(await smartKeyboard.locator('sf-tabs').nth(1).locator('[role="tab"][aria-label]').count() === 2, 'Smart icon tabs expose item labels');
  const vertical = smartKeyboard.locator('sf-tabs').nth(2);
  check(await vertical.locator('[role="tablist"]').getAttribute('aria-orientation') === 'vertical', 'Smart vertical variant announces its orientation');
  await appearance.waitForTimeout(500);
  const classes = await appearance.locator('sf-tabs > .sf-tabs').evaluateAll(roots => roots.map(root => root.className));
  check(['underline', 'pills', 'full'].every(type => classes.some(value => value.includes(`sf-tabs--${type}`))), 'Smart appearance example renders all structural skins', classes);
  await nested.waitForTimeout(500);
  check(await nested.locator('[role="tablist"]').count() === 2, 'Nested Smart example renders two owned tablists');
  const nestedBefore = await nested.locator('sf-tabs').first().getAttribute('data-active-index');
  await nested.locator('sf-tabs').nth(1).locator('[role="tab"]').nth(1).click();
  check(await nested.locator('sf-tabs').first().getAttribute('data-active-index') === nestedBefore, 'Nested Smart selection remains local');
  await data.waitForTimeout(500);
  check(await data.locator('#project-tabs [role="tab"]').count() === 2, 'Data example renders two tabs');
  const ownership = await data.locator('#project-tabs [role="tab"]').first().evaluate(tab => ({
    name: tab.getAttribute('aria-label') || tab.textContent.trim(),
    inert: Boolean(tab.querySelector('[inert]')),
    seam: getComputedStyle(tab.querySelector('.sf-button') || tab).borderInlineStartWidth,
  }));
  check(ownership.name === 'Обзор', 'Custom Smart tab keeps a stable accessible name', ownership);
  const unexpectedErrors = errors.filter(message => message !== 'A network error occurred.');
  check(!unexpectedErrors.length, 'Tabs documentation produces no unexpected page errors', unexpectedErrors);
  await page.screenshot({path: 'output/playwright/tabs-owner-docs.png', fullPage: true});

  return {
    status: failures.length || unexpectedErrors.length ? 'failed' : 'passed',
    cases: 13,
    checks: 20,
    failures,
    errors: unexpectedErrors,
    diagnostics: errors.length === unexpectedErrors.length ? [] : [
      'Sandboxed examples on a plain PHP static server cannot load local icon fonts without an Access-Control-Allow-Origin response header.',
    ],
  };
}
