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
  await page.goto('http://127.0.0.1:8768/tests/fixtures/alert-method-lab.html');
  await page.waitForFunction(() => customElements.get('sf-alert'));

  await page.evaluate(() => {
    const types = ['clear', 'info', 'warning', 'danger', 'success'];
    const variants = ['default', 'outlined', 'flat'];
    const icons = {clear: 'info', info: 'info', warning: 'warning', danger: 'error', success: 'check_circle'};
    const root = document.getElementById('ordinary');
    for (const type of types) for (const variant of variants) {
      root.insertAdjacentHTML('beforeend', `
        <div class="sf-alert sf-alert--${type} sf-alert--${variant} flex items-start" data-type="${type}" data-variant="${variant}">
          <i class="sf-icon" aria-hidden="true">${icons[type]}</i>
          <div class="sf-alert-wrap flex flex-col flex-1">
            <div class="sf-alert-content flex flex-col flex-1">
              <div class="sf-alert-text">${type}</div>
              <div class="sf-alert-supporting-text">${variant}</div>
            </div>
          </div>
        </div>`);
    }
    root.insertAdjacentHTML('beforeend', `
      <div id="ordinary-action" class="sf-alert sf-alert--success sf-alert--default flex items-start">
        <i class="sf-icon" aria-hidden="true">check_circle</i>
        <div class="sf-alert-wrap flex flex-col flex-1">
          <div class="sf-alert-content flex flex-col flex-1">
            <div class="sf-alert-text">Готово</div>
            <div class="sf-alert-supporting-text">Можно продолжить.</div>
          </div>
          <div class="sf-alert-buttons flex flex-wrap items-center">
            <button type="button" data-action="continue">Продолжить</button>
            <button type="button" data-action="blocked" disabled>Недоступно</button>
          </div>
        </div>
        <button type="button" data-close aria-label="Закрыть уведомление">Закрыть</button>
      </div>`);
    window.__ordinaryEvents = {actions: [], closes: 0};
    root.addEventListener('sf-alert-action', event => window.__ordinaryEvents.actions.push(event.detail.action));
    root.addEventListener('sf-alert-close', () => window.__ordinaryEvents.closes++);
  });

  const presentation = await page.evaluate(() => {
    const sample = document.querySelector('[data-type="info"][data-variant="default"]');
    const title = sample.querySelector('.sf-alert-text');
    const supporting = sample.querySelector('.sf-alert-supporting-text');
    const outlined = document.querySelector('[data-type="info"][data-variant="outlined"]');
    const style = getComputedStyle(sample);
    const probe = document.createElement('span');
    probe.style.color = 'var(--sf-on-info-container)';
    probe.style.borderStartStartRadius = 'var(--sf-radius--surface)';
    document.body.append(probe);
    const expectedColor = getComputedStyle(probe).color;
    const radiusToken = getComputedStyle(probe).borderStartStartRadius;
    probe.remove();
    return {
      radius: style.borderStartStartRadius,
      radiusToken,
      borderWidth: style.borderTopWidth,
      titleSize: getComputedStyle(title).fontSize,
      supportingSize: getComputedStyle(supporting).fontSize,
      titleWeight: getComputedStyle(title).fontWeight,
      actualColor: getComputedStyle(title).color,
      expectedColor,
      outlinedBackground: getComputedStyle(outlined).backgroundColor,
      transitionDuration: style.transitionDuration,
    };
  });
  check('surface radius follows default token', presentation.radius === presentation.radiusToken, presentation);
  check('border uses one-pixel Framework token result', presentation.borderWidth === '1px', presentation.borderWidth);
  check('title and supporting text keep the normal body size', presentation.titleSize === '16px' && presentation.supportingSize === '16px', presentation);
  check('title hierarchy uses medium weight only', Number(presentation.titleWeight) >= 500, presentation.titleWeight);
  check('semantic container owns readable text role', presentation.actualColor === presentation.expectedColor, presentation);
  check('outlined treatment stays transparent', presentation.outlinedBackground === 'rgba(0, 0, 0, 0)', presentation.outlinedBackground);
  check('exit motion uses the normal duration token', presentation.transitionDuration === '0.3s', presentation.transitionDuration);

  await page.getByRole('button', {name: 'Продолжить', exact: true}).click();
  await page.getByRole('button', {name: 'Недоступно', exact: true}).click({force: true});
  check('ordinary action emits one stable value and disabled action is silent', await page.evaluate(() => JSON.stringify(window.__ordinaryEvents.actions) === '["continue"]'), await page.evaluate(() => window.__ordinaryEvents));
  await page.getByRole('button', {name: 'Закрыть уведомление', exact: true}).click();
  check('ordinary close enters token exit state', await page.locator('#ordinary-action').evaluate(node => node.classList.contains('closing')));
  await page.waitForFunction(() => !document.getElementById('ordinary-action'));
  check('ordinary close emits once and removes after motion', await page.evaluate(() => window.__ordinaryEvents.closes === 1), await page.evaluate(() => window.__ordinaryEvents));

  await page.evaluate(() => {
    const host = document.createElement('sf-alert');
    host.id = 'smart-action';
    for (const [name, value] of Object.entries({
      type: 'warning',
      variant: 'flat',
      icon: 'none',
      title: 'Требуется решение',
      'supporting-text': 'Выберите дальнейшее действие.',
      'action-text': 'Исправить',
      action: 'repair',
      closable: '',
      'close-label': 'Закрыть Smart уведомление',
    })) host.setAttribute(name, value);
    host.__events = {actions: [], closes: 0};
    host.onAction(action => host.__events.actions.push(action));
    host.onClose(() => host.__events.closes++);
    window.__smartAlert = host;
    document.getElementById('smart').append(host);
  });
  await page.waitForFunction(() => document.querySelector('#smart-action [data-action="repair"]'));
  check('Smart icon can be explicitly omitted', await page.locator('#smart-action .sf-icon').count() === 0);
  check('Smart generates canonical short behavior hooks', await page.locator('#smart-action [data-action="repair"]').count() === 1 && await page.locator('#smart-action [data-close]').count() === 1);
  await page.getByRole('button', {name: 'Исправить', exact: true}).click();
  await page.getByRole('button', {name: 'Закрыть Smart уведомление', exact: true}).click();
  check('Smart close animates its visual root', await page.locator('#smart-action .sf-alert').evaluate(node => node.classList.contains('closing')));
  await page.waitForFunction(() => !document.getElementById('smart-action'));
  check('Smart action and close fire once without ordinary duplicates', await page.evaluate(() => JSON.stringify(window.__smartAlert.__events) === '{"actions":["repair"],"closes":1}'), await page.evaluate(() => window.__smartAlert.__events));

  const roleColors = {};
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => { document.documentElement.className = theme; }, theme);
    roleColors[theme] = await page.evaluate(() => Object.fromEntries(
      ['info', 'warning', 'danger', 'success'].map(type => [
        type,
        getComputedStyle(document.querySelector(`[data-type="${type}"][data-variant="default"] .sf-icon`)).color,
      ]),
    ));
    check(`${theme} keeps four distinct semantic icon roles`, new Set(Object.values(roleColors[theme])).size === 4, roleColors[theme]);
  }

  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  check('mobile RTL has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

  await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
  const forced = await page.locator('[data-type="success"][data-variant="flat"]').evaluate(node => ({
    borderStyle: getComputedStyle(node).borderStyle,
    borderWidth: getComputedStyle(node).borderTopWidth,
  }));
  check('forced colors preserves a visible boundary', forced.borderStyle !== 'none' && forced.borderWidth !== '0px', forced);

  check('all resources stay local', requests.every(url => url.startsWith('http://127.0.0.1:8768/')), requests.filter(url => !url.startsWith('http://127.0.0.1:8768/')));
  check('no runtime errors', errors.length === 0, errors);

  if (failures.length || errors.length) {
    throw new Error(`Failed checks: ${failures.map(item => item.id).join(', ')}`);
  }
  return {status: 'passed', checks: results.length, results, errors, roleColors};
}
