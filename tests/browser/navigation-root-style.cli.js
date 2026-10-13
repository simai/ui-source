async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const asset of ['breadcrumbs', 'step']) await page.addStyleTag({url: `${base}/component/${asset}/css/${asset}.css`});
    for (const asset of ['icons', 'breadcrumbs', 'steps']) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(theme => {document.documentElement.className = `theme-${theme}`; document.querySelector('main').replaceChildren();}, theme);
    for (const mode of ['breadcrumbs-items', 'breadcrumbs-children', 'steps']) {
      const setup = await page.evaluate(async mode => {
        const records = [], failures = [];
        const check = (ok, name, actual) => {records.push(name); if (!ok) failures.push({name, actual});};
        const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const isSteps = mode === 'steps', host = document.createElement(isSteps ? 'sf-steps' : 'sf-breadcrumbs');
        host.id = 'navigation-case';
        if (isSteps) host.setAttribute('items', 'Данные|Проверка|Готово::disabled');
        else {
          host.setAttribute('aria-label', 'Путь');
          if (mode === 'breadcrumbs-items') host.setAttribute('items', JSON.stringify([{label: 'Раздел'}, {label: 'Тема'}, {label: 'Страница', current: true}]));
          else host.innerHTML = '<sf-breadcrumbs-item>Раздел</sf-breadcrumbs-item><sf-breadcrumbs-item>Тема</sf-breadcrumbs-item><sf-breadcrumbs-item current>Страница</sf-breadcrumbs-item>';
        }
        host.setAttribute('root-class', 'max-w-sm');
        host.setAttribute('root-style', 'padding-inline:var(--sf-space-1)');
        document.querySelector('main').append(host); await wait();
        const root = host.querySelector(isSteps ? '.sf-steps' : 'nav');
        if (!root) return {checks: 1, failures: [{name: 'rendered root', actual: host.outerHTML}]};
        host.__events = [];
        host.addEventListener(isSteps ? 'sf-step-change' : 'sf-breadcrumb-click', e => host.__events.push(isSteps ? e.detail.current : e.detail.item.label));
        const snapshot = () => ({text: root.textContent, current: root.querySelector('[aria-current="page"],[aria-current="step"]')?.textContent, label: root.getAttribute('aria-label')});
        const initial = snapshot(), focus = root.querySelector('button,[role="button"]');
        focus.focus();
        check(root.classList.contains('max-w-sm'), 'initial root class', root.className);
        check(root.style.paddingInline === 'var(--sf-space-1)', 'initial root style', root.style.cssText);
        host.removeAttribute('root-style'); host.style.setProperty('padding-inline', 'var(--sf-space-2)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)', 'CSSOM root style', root.style.cssText);
        host.style.setProperty('margin-block-start', 'var(--sf-space-1)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)' && root.style.marginBlockStart === 'var(--sf-space-1)', 'sequential CSSOM', root.style.cssText);
        host.setAttribute('root-style', 'padding-inline:var(--sf-space-3)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-3)', 'explicit root precedence', root.style.cssText);
        host.removeAttribute('root-style'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)', 'remove explicit root style', root.style.cssText);
        host.setAttribute('root-class', 'max-w-md'); await wait();
        check(root.classList.contains('max-w-md') && !root.classList.contains('max-w-sm'), 'replace root class', root.className);
        host.removeAttribute('root-class'); host.removeAttribute('style'); await wait();
        check(!root.classList.contains('max-w-md') && !root.style.paddingInline && !root.style.marginBlockStart, 'remove customization', root.style.cssText);
        check(root === host.querySelector(isSteps ? '.sf-steps' : 'nav'), 'root identity', null);
        check(document.activeElement === focus, 'focus retained', document.activeElement?.outerHTML);
        check(JSON.stringify(initial) === JSON.stringify(snapshot()), 'navigation state retained', snapshot());
        check(host.__events.length === 0, 'no events from styling', host.__events);
        check(getComputedStyle(host).display === 'contents' && !host._updateLoopBlocked, 'boxless without update loop', host._updateLoopCount);
        return {checks: records.length, failures};
      }, mode);
      failures.push(...setup.failures.map(f => ({width, theme, mode, ...f})));
      const host = page.locator('#navigation-case');
      const check = (ok, name, actual) => {if (!ok) failures.push({width, theme, mode, name, actual});};
      if (mode === 'steps') {
        await host.getByRole('button', {name: 'Проверка', exact: true}).click();
        await host.getByRole('button', {name: /Данные/}).press('Space');
        await host.getByRole('button', {name: 'Проверка', exact: true}).press('Enter');
        await host.locator('[data-step-index="2"]').evaluate(step => step.click());
        const events = await host.evaluate(e => e.__events);
        check(JSON.stringify(events) === '[1,0,1]', 'pointer/Space/Enter and disabled step', events);
        check(await host.evaluate(e => e.current === 1), 'selected step retained', null);
      } else {
        await host.getByRole('button', {name: 'Раздел', exact: true}).click();
        await host.getByRole('button', {name: 'Тема', exact: true}).press('Enter');
        const events = await host.evaluate(e => e.__events);
        check(JSON.stringify(events) === '["Раздел","Тема"]', 'one event per native activation', events);
        check(await host.locator('[aria-current="page"]').count() === 1, 'one current breadcrumb', null);
        await host.evaluate(e => {e.__events = []; e.setAttribute('items', 'Один|Два|Три|Четыре|Пять');});
        await host.getByRole('button', {name: 'Show hidden breadcrumbs'}).click();
        await page.waitForFunction(() => document.querySelectorAll('#navigation-case [data-sf-breadcrumb-index]').length === 5);
        await host.evaluate(e => e.setAttribute('root-style', 'padding-inline:var(--sf-space-1)'));
        await page.waitForFunction(() => document.querySelector('#navigation-case nav')?.style.paddingInline === 'var(--sf-space-1)', null, {timeout: 2000}).catch(() => {});
        check(await host.locator('[data-sf-breadcrumb-index]').count() === 5, 'style keeps expanded path', null);
        check(await host.evaluate(e => e.__events.length === 1), 'ellipsis activates once', null);
      }
      results.push({width, theme, mode, checks: setup.checks});
      await host.evaluate(e => e.remove());
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, checks: results.reduce((n, r) => n + r.checks, 0), failures, errors};
}
