async page => {
  const failures = [], results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const assets = ['buttons', 'icon-buttons', 'close', 'button-group', 'badges', 'progress-bar', 'progress-scale', 'spinner', 'reference-link', 'download-file', 'alert', 'toast'];
  const cases = [
    ['sf-button', '.sf-button', {text: 'Продолжить'}],
    ['sf-icon-button', '.sf-icon-button', {icon: 'edit', 'aria-label': 'Редактировать'}],
    ['sf-icon-button', '.sf-icon-button', {variant: 'close', 'aria-label': 'Закрыть'}],
    ['sf-close', '.sf-close', {}],
    ['sf-button-group', '.sf-button-group', {items: 'list::Список|cards::Карточки', value: 'list', 'aria-label': 'Вид'}],
    ['sf-badge', '.sf-badge', {text: 'Новое'}],
    ['sf-progress-bar', '.sf-progress-bar', {value: '42', 'text-position': 'bottom'}],
    ['sf-progress-scale', '.sf-progress-scale', {value: '42', 'show-text': ''}],
    ['sf-spinner', '.sf-loader-container', {width: '48', label: 'Загрузка'}],
    ['sf-reference-link', '.sf-reference-link', {href: '#help', label: 'Справка', text: 'Описание'}],
    ['sf-download-file', '.sf-download-file', {'file-name': 'Документ.pdf'}],
    ['sf-download-file', '.sf-download-file', {'file-name': 'Документ.pdf', href: '#file'}],
    ['sf-alert', '.sf-alert', {title: 'Готово', 'action-text': 'Подробнее'}],
    ['sf-toast', '.sf-toast', {title: 'Сохранено', 'action-text': 'Отменить'}],
  ];
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
    for (const asset of assets) {
      const css = asset === 'alert' ? 'alerts' : asset;
      await page.addStyleTag({url: `${base}/component/${css}/css/${css}.css`});
    }
    for (const asset of ['icons', ...assets]) await page.addScriptTag({url: `${base}/smart/${asset}/js/${asset}.js`});
    await page.evaluate(theme => {document.documentElement.className = `theme-${theme}`; document.querySelector('main').replaceChildren();}, theme);
    for (const [tag, selector, attrs] of cases) {
      const result = await page.evaluate(async ({tag, selector, attrs}) => {
        const host = document.createElement(tag), records = [], failures = [];
        const check = (ok, name, actual) => {records.push(name); if (!ok) failures.push({name, actual});};
        const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        Object.entries(attrs).forEach(([k, v]) => host.setAttribute(k, v));
        host.setAttribute('root-class', 'max-w-sm');
        host.setAttribute('root-style', 'padding-inline:var(--sf-space-1)');
        document.querySelector('main').append(host); await wait();
        host.__clicks = 0; host.__actions = 0;
        host.addEventListener('click', () => host.__clicks++);
        for (const type of ['sf-alert-action', 'sf-toast-action', 'sf-download-file:click']) host.addEventListener(type, () => host.__actions++);
        const root = host.querySelector(selector);
        if (!root) {host.remove(); return {checks: 1, failures: [{name: 'root rendered', actual: host.outerHTML}]};}
        check(root.classList.contains('max-w-sm'), 'initial root-class', root.className);
        check(root.style.paddingInline === 'var(--sf-space-1)', 'initial root-style', root.style.cssText);
        const state = () => ({text: root.textContent, role: root.getAttribute('role'), value: root.dataset.value, href: root.getAttribute('href'), type: root.getAttribute('type'), disabled: root.disabled, progress: root.querySelector('.sf-progress-bar-progress')?.style.width, svgWidth: root.style.getPropertyValue('--sf-loader-svg-width')});
        const initial = state();
        const focus = root.matches('button,a') ? root : root.querySelector('button,a');
        focus?.focus();
        host.removeAttribute('root-style');
        host.style.setProperty('padding-inline', 'var(--sf-space-2)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)', 'CSSOM reaches root', root.style.cssText);
        host.style.setProperty('margin-block-start', 'var(--sf-space-1)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)' && root.style.marginBlockStart === 'var(--sf-space-1)', 'sequential CSSOM retained', root.style.cssText);
        host.setAttribute('root-style', 'padding-inline:var(--sf-space-3)'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-3)', 'root-style priority', root.style.cssText);
        host.removeAttribute('root-style'); await wait();
        check(root.style.paddingInline === 'var(--sf-space-2)', 'root-style removal restores style', root.style.cssText);
        host.setAttribute('root-class', 'max-w-md'); await wait();
        check(root.classList.contains('max-w-md') && !root.classList.contains('max-w-sm'), 'replace root-class', root.className);
        host.removeAttribute('root-class'); host.removeAttribute('style'); await wait();
        check(!root.classList.contains('max-w-md') && !root.style.paddingInline && !root.style.marginBlockStart, 'remove customization', root.style.cssText);
        check(root === host.querySelector(selector), 'root identity retained', null);
        check(JSON.stringify(state()) === JSON.stringify(initial), 'content/native/runtime state retained', {initial, current: state()});
        check(!focus || document.activeElement === focus, 'existing focus retained', document.activeElement?.tagName);
        check(getComputedStyle(host).display === 'contents', 'boxless host retained', getComputedStyle(host).display);
        check(!host._updateLoopBlocked, 'no update loop', host._updateLoopCount);
        check(host.__clicks === 0 && host.__actions === 0, 'style updates emit no action', {clicks: host.__clicks, actions: host.__actions});
        return {checks: records.length, failures};
      }, {tag, selector, attrs});
      results.push({tag, attrs, width, theme, checks: result.checks});
      failures.push(...result.failures.map(f => ({tag, attrs, width, theme, ...f})));
      const host = page.locator(`main > ${tag}`), root = host.locator(selector).first();
      const check = (ok, name, actual) => {if (!ok) failures.push({tag, attrs, width, theme, name, actual});};
      if (tag === 'sf-button' || tag === 'sf-icon-button') {
        await root.click(); await root.press('Space');
        check(await host.evaluate(e => e.__clicks === 2), 'one activation per pointer/key action', await host.evaluate(e => e.__clicks));
        await host.evaluate(e => e.setAttribute('disabled', ''));
        await page.waitForFunction(tag => document.querySelector(`main > ${tag} button`)?.disabled, tag);
        await root.press('Space');
        check(await host.evaluate(e => e.__clicks === 2), 'disabled does not activate', await host.evaluate(e => e.__clicks));
      } else if (tag === 'sf-button-group') {
        check(await host.getByRole('radio').count() === 2, 'one radio per group item', await host.getByRole('radio').count());
        check(await host.locator('sf-button[role],sf-button[tabindex]').count() === 0, 'Smart wrappers are not extra focus targets', null);
        await host.getByRole('radio', {name: 'Карточки', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('sf-button-group').value === 'cards');
        await page.keyboard.press('ArrowLeft');
        await page.waitForFunction(() => document.querySelector('sf-button-group').value === 'list');
        check(await host.evaluate(e => e.querySelector('[aria-checked="true"]')?.getAttribute('data-sf-button-group-value') === 'list'), 'group keyboard selection retained', null);
        await host.evaluate(e => e.setAttribute('items', 'list::Список::disabled|cards::Карточки'));
        await page.waitForFunction(() => document.querySelector('sf-button-group button[tabindex="0"]')?.getAttribute('data-sf-button-group-value') === 'cards');
        check(await host.locator('button[tabindex="0"]').count() === 1, 'disabled selection leaves one available tab stop', null);
        await host.evaluate(e => e.setAttribute('disabled', ''));
        await page.waitForFunction(() => !document.querySelector('sf-button-group button[tabindex="0"]'));
        check(await host.locator('button[tabindex="0"]').count() === 0, 'disabled group has no tab stop', null);
      } else if (tag === 'sf-alert' || tag === 'sf-toast' || (tag === 'sf-download-file' && !attrs.href)) {
        await root.locator(tag === 'sf-alert' ? '[data-alert-action]' : tag === 'sf-toast' ? '[data-toast-action]' : ':scope').click();
        check(await host.evaluate(e => e.__actions === 1), 'one action event after repeated render', await host.evaluate(e => e.__actions));
      } else if (tag === 'sf-progress-bar' || tag === 'sf-progress-scale') {
        await host.evaluate(e => e.setAttribute('value', '73'));
        await page.waitForFunction(({tag, selector}) => document.querySelector(`main > ${tag}`)?.querySelector(selector)?.dataset.value === '73', {tag, selector});
        check(await root.evaluate(e => e.dataset.value === '73'), 'live progress retained', null);
      }
      await host.evaluate(e => e.remove());
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, checks: results.reduce((n, r) => n + r.checks, 0), failures, errors};
}
