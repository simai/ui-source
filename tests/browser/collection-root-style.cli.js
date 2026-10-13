async page => {
  const errors = [], failures = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const cases = [
    ...['default', 'user', 'group', 'label', 'profile'].map(template => ['sf-avatars', 'div', {template, name: 'Команда', 'label-text': 'Команда', 'avatars-more': '2'}]),
    ['sf-list-item', '.sf-list-item', {text: 'Пункт', selected: 'true'}],
    ['sf-pagination', '.sf-pagination', {total: '30', 'page-size': '10', current: '2', 'show-page-size': 'false'}],
    ['sf-tag', '.sf-tag', {type: 'checkbox', text: 'Дизайн', active: 'true', closable: 'false'}],
    ['sf-tooltip', '.sf-tooltip', {text: 'Подсказка'}],
    ['sf-tree-item', '.sf-tree-item', {label: 'Раздел', open: 'true'}],
    ['sf-tabs', '.sf-tabs', {items: 'Обзор|История', 'active-index': '1'}],
  ];
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const asset of ['avatars', 'pagination', 'tags', 'tooltip', 'tree-item', 'tabs', 'dropdown', 'checkbox', 'buttons', 'icon-buttons', 'dot']) await page.addStyleTag({url: `${base}/component/${asset}/css/${asset}.css`});
    for (const asset of ['icons', 'close', 'buttons', 'icon-buttons', 'checkbox', 'list-item', 'dropdown', 'avatars', 'pagination', 'tags', 'tooltip', 'tree-item', 'tabs']) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(theme => {document.documentElement.className = `theme-${theme}`; document.querySelector('main').replaceChildren();}, theme);
    for (const [tag, selector, attrs] of cases) {
      const result = await page.evaluate(async ({tag, selector, attrs, base}) => {
        const host = document.createElement(tag), failures = [], checks = [];
        const check = (ok, name, actual) => {checks.push(name); if (!ok) failures.push({name, actual});};
        const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        Object.entries(attrs).forEach(([k, v]) => host.setAttribute(k, v));
        if (tag === 'sf-avatars') {
          const fixture = await (await fetch(`${base}/smart/avatars/studio.fixture.json`)).json();
          const image = fixture.props['image-url'].replaceAll('"', '%22').replaceAll(' ', '%20');
          host.setAttribute('image-url', image); host.setAttribute('avatars', JSON.stringify([{imageUrl: image}, {imageUrl: image}]));
        }
        if (tag === 'sf-tree-item') host.innerHTML = '<sf-tree-item label="Вложенный пункт" type="file"></sf-tree-item>';
        host.id = 'collection-case'; host.setAttribute('root-class', 'max-w-sm');
        host.setAttribute('root-style', 'padding-inline:var(--sf-space-1)');
        document.querySelector('main').append(host); await wait();
        const root = host.querySelector(selector);
        if (!root) return {checks: 1, failures: [{name: 'visible root rendered', actual: host.outerHTML}]};
        host.__events = [];
        for (const event of ['sf-page-change', 'sf-tab-change', 'sf-tree-item-toggle', 'sf-tree-item-click', 'close', 'change']) host.addEventListener(event, e => host.__events.push(e.type));
        const snapshot = () => ({text: root.textContent, checked: [...root.querySelectorAll('input')].map(e => e.checked), current: root.dataset.activeIndex, expanded: root.getAttribute('aria-expanded'), pressed: root.getAttribute('aria-pressed'), selected: root.getAttribute('aria-selected'), images: [...root.querySelectorAll('img,.sf-avatar--image')].map(e => e.getAttribute('src') || e.style.backgroundImage)});
        const initial = snapshot(), focus = root.matches('button,a,[tabindex="0"]') ? root : root.querySelector('button,a,[tabindex="0"]');
        focus?.focus();
        check(root.classList.contains('max-w-sm'), 'initial root class', root.className);
        check(root.style.paddingInline === 'var(--sf-space-1)', 'initial root style', root.style.cssText);
        if (tag === 'sf-avatars' && attrs.template === 'label') check(!root.querySelector('.sf-avatar').style.paddingInline, 'label does not duplicate style on nested avatar', null);
        if (tag === 'sf-tree-item') check(!root.querySelector('.sf-tree-item').style.paddingInline, 'tree does not copy parent padding to children', null);
        host.removeAttribute('root-style'); host.style.setProperty('padding-inline', 'var(--sf-space-2)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)', 'CSSOM applies to root', root.style.cssText);
        host.style.setProperty('margin-block-start', 'var(--sf-space-1)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)' && root.style.marginBlockStart === 'var(--sf-space-1)', 'sequential CSSOM preserved', root.style.cssText);
        host.setAttribute('root-style', 'padding-inline:var(--sf-space-3)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-3)', 'root style precedence', root.style.cssText);
        host.removeAttribute('root-style'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)', 'remove root override', root.style.cssText);
        host.setAttribute('root-class', 'max-w-md'); await wait();
        check(root.classList.contains('max-w-md') && !root.classList.contains('max-w-sm'), 'replace root class', root.className);
        host.removeAttribute('root-class'); host.removeAttribute('style'); await wait();
        check(!root.classList.contains('max-w-md') && !root.style.paddingInline && !root.style.marginBlockStart, 'remove customization', root.style.cssText);
        check(root === host.querySelector(selector), 'root identity', null);
        check(JSON.stringify(initial) === JSON.stringify(snapshot()), 'state/images preserved', {initial, after: snapshot()});
        check(!focus || document.activeElement === focus, 'focus preserved', document.activeElement?.outerHTML);
        check(host.__events.length === 0, 'styling emits no action', host.__events);
        check(getComputedStyle(host).display === 'contents' && !host._updateLoopBlocked, 'boxless host/no update loop', host._updateLoopCount);
        return {checks: checks.length, failures};
      }, {tag, selector, attrs, base});
      failures.push(...result.failures.map(f => ({tag, attrs, width, theme, ...f})));
      const host = page.locator('#collection-case');
      if (tag === 'sf-pagination') {
        await host.getByRole('button', {name: 'Страница 3', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('#collection-case').current === 3);
        if (await host.evaluate(e => e.__events.length) !== 1) failures.push({tag, width, theme, issue: 'page action count'});
      } else if (tag === 'sf-tabs') {
        // Keep a native selector here: this matrix checks root styling/state.
        // Roles, names and keyboard ownership have their own Tabs matrix.
        await host.locator('button[data-sf-tab-index="0"]').click();
        await page.waitForFunction(() => document.querySelector('#collection-case .sf-tabs').dataset.activeIndex === '0');
        if (await host.locator('button[data-sf-tab-index="0"]').getAttribute('aria-selected') !== 'true') failures.push({tag, width, theme, issue: 'tab action state'});
      } else if (tag === 'sf-tree-item') {
        try {
          await host.locator('.sf-tree-toggle').first().click({timeout: 1000});
          await page.waitForFunction(() => document.querySelector('#collection-case > .sf-tree-item')?.getAttribute('aria-expanded') === 'false', null, {timeout: 1000});
          if (await host.evaluate(e => e.__events.filter(x => x === 'sf-tree-item-toggle').length) !== 1) failures.push({tag, width, theme, issue: 'tree toggle count'});
        } catch (e) {failures.push({tag, width, theme, issue: 'tree pointer blocked', detail: e.message.slice(0, 300)});}
      }
      results.push({tag, attrs, width, theme, checks: result.checks});
      await host.evaluate(e => e.remove());
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, checks: results.reduce((n, r) => n + r.checks, 0), failures, errors};
}
