async page => {
  const failures = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
  for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
  for (const name of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
  await page.evaluate(() => {
    const ordinary = (id, content) => `<div class="sf-tabs" id="${id}"><div class="sf-tabs-top-container"><div class="sf-tabs-top flex"><button class="sf-button sf-button--default sf-button--primary sf-button--size-1"><span class="sf-button-text-container">Первый</span></button><button class="sf-button sf-button--default sf-button--primary sf-button--size-1"><span class="sf-button-text-container">Второй</span></button></div></div><div class="sf-tabs-main-container"><div class="sf-tabs-main-tab">${content}</div><div class="sf-tabs-main-tab">Вторая панель</div></div></div>`;
    document.querySelector('main').innerHTML = ordinary('ordinary-outer', '<sf-tabs id="smart-inner" items="Обзор|История"></sf-tabs>' + ordinary('ordinary-inner', 'Вложенное содержимое'));
  });
  await page.waitForFunction(() => document.querySelector('#smart-inner button'));
  await page.addScriptTag({url: `${base}/component/tabs/js/tabs.js`});
  const state = () => page.evaluate(() => {
    const outer = document.querySelector('#ordinary-outer'), inner = document.querySelector('#ordinary-inner'), smart = document.querySelector('#smart-inner');
    return {outer: Number(outer.dataset.activeIndex), inner: Number(inner.dataset.activeIndex), smart: smart.activeIndex,
      outerPanels: [...outer.querySelector(':scope > .sf-tabs-main-container').children].map(e => e.hidden),
      innerPanels: [...inner.querySelector(':scope > .sf-tabs-main-container').children].map(e => e.hidden),
      smartBound: Boolean(smart.querySelector('.sf-tabs').dataset.sfTabsBound)};
  });
  const nested = page.locator('#smart-inner').getByRole('tab', {name: 'История', exact: true});
  await nested.click(); let s = await state();
  if (s.outer !== 0 || s.inner !== 0 || s.smart !== 1 || s.smartBound) failures.push({phase: 'nested Smart click', state: s});
  await page.locator('#ordinary-inner > .sf-tabs-top-container button').nth(1).click(); s = await state();
  if (s.outer !== 0 || s.inner !== 1 || s.smart !== 1 || s.innerPanels.join() !== 'true,false') failures.push({phase: 'nested ordinary click', state: s});
  await page.locator('#ordinary-outer > .sf-tabs-top-container button').nth(1).click(); s = await state();
  if (s.outer !== 1 || s.inner !== 1 || s.smart !== 1 || s.outerPanels.join() !== 'true,false') failures.push({phase: 'outer click', state: s});
  await page.evaluate(() => {window.SF.Tabs.activate(document.querySelector('#ordinary-outer'), 0); window.SF.Tabs.init(document);}); s = await state();
  if (s.outer !== 0 || s.inner !== 1 || s.smart !== 1 || s.outerPanels.join() !== 'false,true') failures.push({phase: 'outer imperative activate/reinit preserves children', state: s});
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: 4, failures, errors};
}
