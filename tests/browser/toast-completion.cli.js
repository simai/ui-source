/* global customElements, document, getComputedStyle, window */
async page => {
  const results = [];
  const failures = [];
  const errors = [];
  const requests = [];
  const check = (id, pass, detail = '') => {
    results.push({id, pass: Boolean(pass), detail});
    if (!pass) failures.push({id, detail});
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 1280, height: 900});
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'no-preference', colorScheme: 'light'});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/toast-method-lab.html');
  await page.waitForFunction(() => window.SF?.Toast && customElements.get('sf-toast'));

  await page.evaluate(() => {
    const types = ['default', 'primary', 'error', 'warning', 'success'];
    const icons = {default: 'info', primary: 'info', error: 'error', warning: 'warning', success: 'check_circle'};
    const root = document.getElementById('ordinary');
    for (const type of types) {
      root.insertAdjacentHTML('beforeend', `
        <div class="sf-toast sf-toast--${type} flex items-cross-start" data-type="${type}">
          <i class="sf-icon" aria-hidden="true">${icons[type]}</i>
          <div class="sf-toast-container flex flex-col flex-1">
            <div class="sf-toast-wrap flex flex-col">
              <div class="sf-toast-text">${type}</div>
              <div class="sf-toast-supporting-text">supporting</div>
            </div>
          </div>
        </div>`);
    }
    const action = window.SF.Toast.create({
      type: 'success',
      icon: 'check_circle',
      title: 'Сохранено',
      supportingText: 'Изменения доступны.',
      actionText: 'Отменить',
      action: 'undo',
      closeLabel: 'Закрыть обычное сообщение',
      role: 'status',
    });
    action.id = 'ordinary-action';
    root.append(action);
    window.__ordinaryEvents = {actions: [], closes: 0, closeTriggers: []};
    root.addEventListener('sf-toast-action', event => window.__ordinaryEvents.actions.push(event.detail.action));
    root.addEventListener('sf-toast-close', event => {
      window.__ordinaryEvents.closes++;
      window.__ordinaryEvents.closeTriggers.push(event.detail.trigger?.getAttribute('aria-label') || null);
    });

    const persistent = window.SF.Toast.create({title: 'Постоянное'});
    persistent.id = 'persistent';
    root.append(persistent);
  });

  const presentation = await page.evaluate(() => {
    const sample = document.querySelector('[data-type="primary"]');
    const title = sample.querySelector('.sf-toast-text');
    const supporting = sample.querySelector('.sf-toast-supporting-text');
    const probe = document.createElement('span');
    probe.style.color = 'var(--sf-on-primary-container)';
    probe.style.borderStartStartRadius = 'var(--sf-radius--surface)';
    document.body.append(probe);
    const result = {
      radius: getComputedStyle(sample).borderStartStartRadius,
      radiusToken: getComputedStyle(probe).borderStartStartRadius,
      borderWidth: getComputedStyle(sample).borderTopWidth,
      titleSize: getComputedStyle(title).fontSize,
      supportingSize: getComputedStyle(supporting).fontSize,
      titleWeight: getComputedStyle(title).fontWeight,
      actualColor: getComputedStyle(title).color,
      expectedColor: getComputedStyle(probe).color,
      transitionDuration: getComputedStyle(sample).transitionDuration,
    };
    probe.remove();
    return result;
  });
  check('surface radius follows the default surface token', presentation.radius === presentation.radiusToken, presentation);
  check('surface boundary uses the one-pixel token result', presentation.borderWidth === '1px', presentation.borderWidth);
  check('title and supporting text keep normal body size', presentation.titleSize === '16px' && presentation.supportingSize === '16px', presentation);
  check('title hierarchy uses medium weight', presentation.titleWeight === '500', presentation.titleWeight);
  check('container uses its readable foreground role', presentation.actualColor === presentation.expectedColor, presentation);
  check('exit motion uses the normal duration token', presentation.transitionDuration.split(',').every(value => value.trim() === '0.3s'), presentation.transitionDuration);

  await page.getByRole('button', {name: 'Отменить', exact: true}).click();
  check('ordinary action emits the canonical value once', await page.evaluate(() => JSON.stringify(window.__ordinaryEvents.actions) === '["undo"]'), await page.evaluate(() => window.__ordinaryEvents));
  await page.getByRole('button', {name: 'Закрыть обычное сообщение', exact: true}).click();
  check('ordinary close enters token exit state', await page.locator('#ordinary-action').evaluate(node => node.classList.contains('closing')));
  await page.waitForFunction(() => !document.getElementById('ordinary-action'));
  check('ordinary close emits once and removes after motion', await page.evaluate(() => window.__ordinaryEvents.closes === 1), await page.evaluate(() => window.__ordinaryEvents));
  check('close event identifies only its real activating control', await page.evaluate(() => window.__ordinaryEvents.closeTriggers[0] === 'Закрыть обычное сообщение'), await page.evaluate(() => window.__ordinaryEvents.closeTriggers));

  await page.evaluate(() => {
    const timed = window.SF.Toast.create({title: 'Временное', duration: 800});
    timed.id = 'timed';
    document.getElementById('ordinary').append(timed);
  });
  await page.locator('#timed').dispatchEvent('pointerenter');
  await page.waitForTimeout(900);
  check('pointer presence pauses the remaining lifetime', await page.locator('#timed').count() === 1);
  await page.locator('#timed').dispatchEvent('pointerleave');
  await page.waitForFunction(() => !document.getElementById('timed'));
  check('timer resumes and dismisses after pointer leaves', await page.locator('#timed').count() === 0);
  check('zero duration remains persistent', await page.locator('#persistent').count() === 1);

  await page.evaluate(() => {
    const focused = window.SF.Toast.create({
      title: 'Фокус удерживает сообщение',
      duration: 600,
      closeLabel: 'Закрыть сообщение с фокусом',
    });
    focused.id = 'focus-timed';
    document.getElementById('ordinary').append(focused);
  });
  await page.getByRole('button', {name: 'Закрыть сообщение с фокусом', exact: true}).focus();
  await page.waitForTimeout(700);
  check('keyboard focus pauses the remaining lifetime', await page.locator('#focus-timed').count() === 1);
  await page.locator('#before').focus();
  await page.waitForFunction(() => !document.getElementById('focus-timed'));
  check('timer resumes after keyboard focus leaves', await page.locator('#focus-timed').count() === 0);

  await page.evaluate(() => {
    const host = document.createElement('sf-toast');
    host.id = 'smart-action';
    for (const [name, value] of Object.entries({
      type: 'warning',
      icon: 'warning',
      title: 'Требуется внимание',
      'supporting-text': 'Проверьте подключение.',
      'action-text': 'Повторить',
      action: 'retry',
      role: 'status',
      'close-label': 'Закрыть Smart сообщение',
    })) host.setAttribute(name, value);
    host.__events = {actions: [], closes: 0};
    host.onAction(action => host.__events.actions.push(action));
    host.onClose(() => host.__events.closes++);
    window.__smartToast = host;
    document.getElementById('smart').append(host);
  });
  await page.waitForFunction(() => document.querySelector('#smart-action [data-action="retry"]'));
  check('Smart propagates its live-region role to the visual owner', await page.locator('#smart-action .sf-toast').getAttribute('role') === 'status');
  check('Smart generates concise hooks with compatibility aliases', await page.locator('#smart-action [data-action="retry"][data-toast-action="retry"]').count() === 1 && await page.locator('#smart-action [data-close][data-toast-close]').count() === 1);
  await page.getByRole('button', {name: 'Повторить', exact: true}).click();
  await page.getByRole('button', {name: 'Закрыть Smart сообщение', exact: true}).click();
  check('Smart close animates its visual root', await page.locator('#smart-action .sf-toast').evaluate(node => node.classList.contains('closing')));
  await page.waitForFunction(() => !document.getElementById('smart-action'));
  check('Smart events fire once and removal owns the host', await page.evaluate(() => JSON.stringify(window.__smartToast.__events) === '{"actions":["retry"],"closes":1}'), await page.evaluate(() => window.__smartToast.__events));

  const roleColors = {};
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => { document.documentElement.className = theme; }, theme);
    roleColors[theme] = await page.evaluate(() => Object.fromEntries(
      ['primary', 'error', 'warning', 'success'].map(type => [
        type,
        getComputedStyle(document.querySelector(`[data-type="${type}"] .sf-icon`)).color,
      ]),
    ));
    check(`${theme} keeps four distinct role graphics`, new Set(Object.values(roleColors[theme])).size === 4, roleColors[theme]);
  }

  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  check('mobile RTL has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
  check('forced colors preserves a visible boundary', await page.locator('[data-type="success"]').evaluate(node => getComputedStyle(node).borderTopWidth !== '0px'));
  check('all resources stay local', requests.every(url => url.startsWith('http://127.0.0.1:8768/')), requests.filter(url => !url.startsWith('http://127.0.0.1:8768/')));
  check('no runtime errors', errors.length === 0, errors);

  if (failures.length || errors.length) throw new Error(`Failed checks: ${failures.map(item => item.id).join(', ')}`);
  return {status: 'passed', checks: results.length, results, errors, roleColors};
}
