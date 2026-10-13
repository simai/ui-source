async page => {
  const base = 'http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const positions = [
    'inline-start', 'inline-start-top', 'inline-start-bottom',
    'inline-end', 'inline-end-top', 'inline-end-bottom',
    'top', 'top-inline-start', 'top-inline-end',
    'bottom', 'bottom-inline-start', 'bottom-inline-end'
  ];
  const aliases = {
    start: 'inline-start', end: 'inline-end',
    'top-start': 'top-inline-start', 'top-end': 'top-inline-end',
    'bottom-start': 'bottom-inline-start', 'bottom-end': 'bottom-inline-end',
    'left-start': 'left-top', 'left-end': 'left-bottom',
    'right-start': 'right-top', 'right-end': 'right-bottom'
  };
  const errors = [], failures = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => {
    if (event.type() === 'error') errors.push(event.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

  for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
    await page.setViewportSize({width: 1280, height: 900});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for (const name of ['buttons', 'context-menu']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['buttons', 'context-menu']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(({theme, dir, positions, aliases}) => {
      document.documentElement.className = `theme-${theme}`;
      document.documentElement.dir = dir;
      const main = document.querySelector('main');
      main.innerHTML = '<div id="matrix" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:64px;padding:64px"></div><div id="aliases"></div><div id="plain"></div>';
      for (const position of positions) {
        const menu = document.createElement('sf-context-menu');
        menu.setAttribute('position', position);
        menu.setAttribute('aria-label', position);
        menu.innerHTML = `<button slot="content" type="button" class="sf-button sf-button--link sf-button--on-surface"><span class="sf-button-text-container">${position}</span></button>`;
        main.querySelector('#matrix').append(menu);
      }
      for (const alias of Object.keys(aliases)) {
        const menu = document.createElement('sf-context-menu');
        menu.setAttribute('position', alias);
        menu.setAttribute('aria-label', alias);
        menu.innerHTML = '<button slot="content" type="button" class="sf-button sf-button--link sf-button--on-surface"><span class="sf-button-text-container">alias</span></button>';
        main.querySelector('#aliases').append(menu);
      }
      const plain = document.createElement('sf-context-menu');
      plain.setAttribute('position', 'bottom-inline-start');
      plain.setAttribute('aria-label', 'Без указателя');
      // Legacy markup with a tail: the stylesheet must hide it.
      plain.innerHTML = '<div class="sf-context-menu"><div class="relative"><div class="sf-context-menu-tooltip"></div><div class="sf-context-menu-content"></div></div></div>';
      main.querySelector('#plain').append(plain);
    }, {theme, dir, positions, aliases});
    await page.waitForFunction(count => document.querySelectorAll('#matrix > sf-context-menu > .sf-context-menu').length === count, positions.length);

    const normal = await page.evaluate(({positions, aliases}) => {
      const matrix = [...document.querySelectorAll('#matrix > sf-context-menu')].map((host, index) => {
        const root = host.querySelector(':scope > .sf-context-menu');
        const position = positions[index];
        // Tail-to-edge placement dropped: no tail since 2026-10-12.
        return {position, normalized: host.position, positionClass: root.classList.contains(`sf-context-menu--position-${position}`), tailRendered: Boolean(root.querySelector('.sf-context-menu-tooltip'))};
      });
      const aliasValues = [...document.querySelectorAll('#aliases > sf-context-menu')].map(host => ({alias: host.getAttribute('position'), normalized: host.position}));
      return {
        matrix,
        aliases: aliasValues,
        positionsCorrect: matrix.every(item => item.normalized === item.position && item.positionClass),
        aliasesCorrect: aliasValues.every(item => aliases[item.alias] === item.normalized),
        noTail: matrix.every(item => !item.tailRendered) && [...document.querySelectorAll('.sf-context-menu-tooltip')].every(tail => getComputedStyle(tail).display === 'none' && tail.getClientRects().length === 0)
      };
    }, {positions, aliases});

    if (dir === 'ltr') await page.screenshot({path: `output/playwright/context-menu-completion-${theme}.png`, fullPage: true});

    await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
    await page.waitForFunction(() => matchMedia('(forced-colors: active)').matches);
    const forced = await page.evaluate(() => {
      const menu = document.querySelector('#matrix > sf-context-menu');
      const content = menu.querySelector('.sf-context-menu-content');
      const contentStyle = getComputedStyle(content);
      // Tail border and shadow checks dropped: no tail since 2026-10-12.
      return {
        contentBorder: parseFloat(contentStyle.borderTopWidth) > 0 && contentStyle.borderTopColor !== 'rgba(0, 0, 0, 0)',
        noForcedTail: [...document.querySelectorAll('.sf-context-menu-tooltip')].every(tail => tail.getClientRects().length === 0)
      };
    });
    const row = {theme, dir, positionsCorrect: normal.positionsCorrect, aliasesCorrect: normal.aliasesCorrect, noTail: normal.noTail, ...forced};
    if (Object.entries(row).some(([key, value]) => !['theme', 'dir'].includes(key) && value !== true)) failures.push({...row, normal});
    results.push(row);
    if (theme === 'light' && dir === 'ltr') await page.screenshot({path: 'output/playwright/context-menu-completion-forced-colors.png', fullPage: true});
  }

  await page.emulateMedia({forcedColors: 'none'});
  return {status: errors.length || failures.length ? 'failed' : 'passed', cases: results.length, errors, failures, results};
}
