async page => {
  const results = [];
  const failures = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  const url = 'http://127.0.0.1:8768/tests/fixtures/action-focus-lab.html';
  await page.goto(url);
  await page.waitForFunction(() => customElements.get('sf-icon-button'));
  await page.waitForFunction(() => document.querySelector('#smart-runtime-icon button'));

  const staticContract = await page.evaluate(() => {
    const dimensions = [...document.querySelectorAll('#sizes [data-size]')].map(button => {
      const rect = button.getBoundingClientRect();
      return {size: button.dataset.size, width: rect.width, height: rect.height};
    });
    const ordinary = document.querySelector('#ordinary-runtime-icon');
    const fab = document.querySelector('#ordinary-runtime-fab');
    const smart = document.querySelector('#smart-runtime-icon button');
    const backgrounds = Object.fromEntries(
      [...document.querySelectorAll('[data-fab-pair]')].map(button => [
        button.dataset.fabPair,
        getComputedStyle(button).backgroundColor,
      ]),
    );
    return {
      dimensions,
      ordinary: {
        type: ordinary.type,
        disabled: ordinary.disabled,
        busy: ordinary.getAttribute('aria-busy'),
        label: ordinary.getAttribute('aria-label'),
        origin: ordinary.dataset.origin,
        decorativeIcon: ordinary.querySelector('.sf-icon')?.getAttribute('aria-hidden'),
        hasIconVariant: ordinary.classList.contains('sf-icon-button--icon'),
      },
      fab: {
        type: fab.type,
        label: fab.getAttribute('aria-label'),
        origin: fab.dataset.origin,
        decorativeIcon: fab.querySelector('.sf-icon')?.getAttribute('aria-hidden'),
      },
      smart: {
        type: smart.type,
        disabled: smart.disabled,
        busy: smart.getAttribute('aria-busy'),
        label: smart.getAttribute('aria-label'),
        decorativeIcon: smart.querySelector('sf-icon')?.getAttribute('aria-hidden'),
      },
      backgrounds,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  results.push({id: 'static-and-runtime-contract', ...staticContract});

  const dimensions = staticContract.dimensions;
  if (!dimensions.every(({width, height}) => width > 0 && Math.abs(width - height) < 0.2)) {
    failures.push({id: 'square-sizes', dimensions});
  }
  if (!dimensions.every((item, index) => index === 0 || item.width > dimensions[index - 1].width)) {
    failures.push({id: 'monotonic-sizes', dimensions});
  }
  for (const [id, actual, expected] of [
    ['ordinary-type', staticContract.ordinary.type, 'button'],
    ['ordinary-busy', staticContract.ordinary.busy, 'true'],
    ['ordinary-label', staticContract.ordinary.label, 'Настройки'],
    ['ordinary-origin', staticContract.ordinary.origin, 'ordinary'],
    ['ordinary-icon', staticContract.ordinary.decorativeIcon, 'true'],
    ['fab-type', staticContract.fab.type, 'button'],
    ['fab-label', staticContract.fab.label, 'Наверх'],
    ['fab-origin', staticContract.fab.origin, 'legacy-scroll'],
    ['fab-icon', staticContract.fab.decorativeIcon, 'true'],
    ['smart-type', staticContract.smart.type, 'button'],
    ['smart-busy', staticContract.smart.busy, 'true'],
    ['smart-label', staticContract.smart.label, 'Скачать'],
    ['smart-icon', staticContract.smart.decorativeIcon, 'true'],
  ]) {
    if (actual !== expected) failures.push({id, actual, expected});
  }
  if (!staticContract.ordinary.disabled || !staticContract.ordinary.hasIconVariant) {
    failures.push({id: 'ordinary-loading-blocked', actual: staticContract.ordinary});
  }
  if (!staticContract.smart.disabled) {
    failures.push({id: 'smart-loading-blocked', actual: staticContract.smart});
  }
  if (new Set(Object.values(staticContract.backgrounds)).size !== 3) {
    failures.push({id: 'fab-role-colors', actual: staticContract.backgrounds});
  }
  if (staticContract.overflow > 0) failures.push({id: 'desktop-overflow', actual: staticContract.overflow});

  const primary = page.locator('[data-fab-pair="primary"]');
  const restingBackground = await primary.evaluate(element => getComputedStyle(element).backgroundColor);
  await primary.evaluate(element => element.classList.add('active'));
  const activeBackground = await primary.evaluate(element => getComputedStyle(element).backgroundColor);
  results.push({id: 'fab-active-role', restingBackground, activeBackground});
  if (restingBackground === activeBackground) failures.push({id: 'fab-active-role', restingBackground, activeBackground});

  const firstAction = page.locator('#actions .sf-icon-button').first();
  await firstAction.click();
  const clickShadow = await firstAction.evaluate(element => getComputedStyle(element).boxShadow);
  await page.locator('#start').focus();
  await page.keyboard.press('Tab');
  const keyboardShadow = await firstAction.evaluate(element => getComputedStyle(element).boxShadow);
  results.push({id: 'focus-modality', clickShadow, keyboardShadow});
  if (clickShadow !== 'none') failures.push({id: 'mouse-focus-visible', clickShadow});
  if (keyboardShadow === 'none') failures.push({id: 'keyboard-focus-visible', keyboardShadow});

  await page.locator('#theme').click();
  const darkColors = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('[data-fab-pair]')].map(button => [
      button.dataset.fabPair,
      getComputedStyle(button).backgroundColor,
    ]),
  ));
  results.push({id: 'dark-theme-colors', colors: darkColors});
  if (new Set(Object.values(darkColors)).size !== 3) failures.push({id: 'dark-fab-role-colors', actual: darkColors});

  await page.setViewportSize({width: 360, height: 800});
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  results.push({id: 'mobile-overflow', value: mobileOverflow});
  if (mobileOverflow > 0) failures.push({id: 'mobile-overflow', actual: mobileOverflow});

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    checks: results.length,
    errors,
    failures,
    results,
  };
}
