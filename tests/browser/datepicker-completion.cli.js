async page => {
  const url = 'http://127.0.0.1:8766/ui-source/tests/fixtures/datepicker-loader-lab.html';
  const errors = [];
  const failures = [];
  const results = [];

  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => {
    if (event.type() === 'error') errors.push(event.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', request => {
    const requestUrl = request.url();
    if (/^https?:/.test(requestUrl) && !requestUrl.startsWith('http://127.0.0.1:8766/')) {
      errors.push(`external request: ${requestUrl}`);
    }
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  const load = async ({theme = 'light', dir = 'ltr'} = {}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(url);
    await page.evaluate(({theme, dir}) => {
      document.documentElement.className = `theme-${theme}`;
      document.documentElement.dir = dir;
    }, {theme, dir});
    await page.waitForFunction(() => document.querySelectorAll('sf-datepicker .sf-datepicker').length === 1);
    await page.waitForFunction(() => [...document.querySelectorAll('sf-datepicker .sf-icon')]
      .filter(icon => icon.textContent.trim())
      .every(icon => icon.classList.contains('sf-icon-loaded')));
  };

  for (const theme of ['light', 'dark']) {
    for (const dir of ['ltr', 'rtl']) {
      await load({theme, dir});
      const input = page.getByLabel('Дата публикации');
      await input.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.querySelector('sf-datepicker[open] .sf-datepicker-day:focus'));
      const before = await page.locator('sf-datepicker[open] .sf-datepicker-day:focus').getAttribute('data-date');
      await page.keyboard.press(dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
      await page.waitForFunction(previous => document.querySelector('sf-datepicker[open] .sf-datepicker-day:focus')?.dataset.date !== previous, before);
      const after = await page.locator('sf-datepicker[open] .sf-datepicker-day:focus').getAttribute('data-date');
      const datepicker = page.locator('sf-datepicker').first();
      await datepicker.locator('sf-icon-button[aria-label="Следующий месяц"] button').click();
      await page.waitForFunction(() => document.querySelector('sf-datepicker[open]')?.getAttribute('month') === '9');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);
      const row = await page.evaluate(({before, after}) => {
        const component = document.querySelector('sf-datepicker');
        const day = document.querySelectorAll('sf-datepicker')[2].querySelector('.sf-datepicker-day-date');
        return {
          before,
          after,
          chronologicalArrow: before === '2026-09-03' && after === '2026-09-04',
          closed: !component.hasAttribute('open'),
          focusReturned: document.activeElement === component.querySelector('input'),
          inputNamed: component.querySelector('input')?.getAttribute('aria-haspopup') === 'dialog',
          inputCollapsed: component.querySelector('input')?.getAttribute('aria-expanded') === 'false',
          dayTypography: getComputedStyle(day).fontSize === getComputedStyle(document.body).fontSize,
          noDocumentOverflow: document.documentElement.scrollWidth <= innerWidth,
          iconsRendered: [...document.querySelectorAll('sf-datepicker .sf-icon')]
            .filter(icon => icon.textContent.trim())
            .every(icon => icon.classList.contains('sf-icon-loaded') && parseFloat(getComputedStyle(icon).fontSize) > 0),
        };
      }, {before, after});
      if (Object.entries(row).some(([key, value]) => !['before', 'after'].includes(key) && value !== true)) failures.push({theme, dir, ...row});
      results.push({theme, dir, ...row});
    }
  }

  await load();
  const rangeResult = await page.evaluate(async () => {
    const component = document.querySelectorAll('sf-datepicker')[1];
    let changes = 0;
    component.addEventListener('sf-datepicker-change', () => changes += 1);
    component.openPanel();
    await new Promise(resolve => setTimeout(resolve, 80));
    component.querySelector('.sf-datepicker-day[data-date="2026-09-15"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    return {
      remainsOpen: component.hasAttribute('open'),
      rangeRestarted: component.startValue === '2026-09-15' && component.endValue === '',
      eventEmitted: changes === 1,
    };
  });
  if (Object.values(rangeResult).some(value => value !== true)) failures.push({rangeResult});
  results.push({range: rangeResult});

  await load();
  await page.evaluate(() => {
    const component = document.querySelector('sf-datepicker');
    component.setState({year: 2026, month: 0, minDate: '', maxDate: ''});
    component.setActiveDate('2026-01-31');
    component.openPanel({focusCalendar: true});
  });
  await page.waitForFunction(() => document.querySelector('sf-datepicker[open] .sf-datepicker-day:focus')?.dataset.date === '2026-01-31');
  await page.keyboard.press('PageDown');
  await page.waitForFunction(() => document.querySelector('sf-datepicker[open] .sf-datepicker-day:focus')?.dataset.date === '2026-02-28');
  const monthEdge = {
    clampedToLastDay: await page.locator('sf-datepicker[open] .sf-datepicker-day:focus').getAttribute('data-date') === '2026-02-28',
  };
  if (!monthEdge.clampedToLastDay) failures.push({monthEdge});
  results.push({monthEdge});

  const limitsAndInline = await page.evaluate(async () => {
    const component = document.querySelector('sf-datepicker');
    component.setAttribute('min-date', '2026-09-05');
    component.setState({year: 2026, month: 8});
    component.openPanel();
    await new Promise(resolve => setTimeout(resolve, 100));
    const inline = document.querySelectorAll('sf-datepicker')[2];
    return {
      updatedLimit: component.querySelector('[data-date="2026-09-04"]')?.disabled === true,
      inlineGroup: inline.querySelector('.sf-datepicker')?.getAttribute('role') === 'group',
      inlineNamed: Boolean(inline.querySelector('.sf-datepicker')?.getAttribute('aria-label')),
      weekdayCount: inline.querySelectorAll('.sf-datepicker-weekday').length === 7,
      dayCount: inline.querySelectorAll('.sf-datepicker-day').length === 42,
    };
  });
  if (Object.values(limitsAndInline).some(value => value !== true)) failures.push({limitsAndInline});
  results.push({limitsAndInline});

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', {pageScaleFactor: 2});
  await page.waitForFunction(() => visualViewport?.scale === 2);
  await page.waitForTimeout(120);
  const zoom = await page.evaluate(() => {
    const viewport = visualViewport;
    const panel = document.querySelector('sf-datepicker[open] .sf-datepicker');
    const rect = panel.getBoundingClientRect();
    return {
      scale: viewport.scale,
      fitsInline: rect.left >= viewport.offsetLeft - 1 && rect.right <= viewport.offsetLeft + viewport.width + 1,
      fitsBlock: rect.top >= viewport.offsetTop - 1 && rect.bottom <= viewport.offsetTop + viewport.height + 1,
    };
  });
  if (zoom.scale !== 2 || !zoom.fitsInline || !zoom.fitsBlock) failures.push({zoom});
  results.push({zoom});
  await cdp.send('Emulation.setPageScaleFactor', {pageScaleFactor: 1});

  return {
    status: errors.length || failures.length ? 'failed' : 'passed',
    cases: 8,
    errors,
    failures,
    results,
  };
}
