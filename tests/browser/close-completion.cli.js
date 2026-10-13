// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });

  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/close-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelector('#smart-action button'));

  check('five native action sizes and one disabled state render', await page.locator('#actions button').count() === 6);
  check('every action owns a distinct accessible name', await page.locator('#actions button').evaluateAll(buttons => new Set(buttons.map(button => button.getAttribute('aria-label'))).size === buttons.length));
  check('ordinary glyphs are hidden from the accessibility tree', await page.locator('#actions .sf-close').evaluateAll(glyphs => glyphs.every(glyph => glyph.getAttribute('aria-hidden') === 'true')));

  const first = page.getByRole('button', {name: 'Закрыть уведомление, размер 1/3'});
  await first.focus();
  check('keyboard focus belongs to native button and is visible', await first.evaluate(button => button.matches(':focus-visible') && getComputedStyle(button).boxShadow !== 'none'));
  await page.keyboard.press('Enter');
  check('native keyboard activation reaches host action once', await page.locator('#activation-count').textContent() === 'Активаций: 1');
  await page.mouse.click(1, 1);
  await first.click();
  check('pointer activation remains visually quiet', await first.evaluate(button => !button.matches(':focus-visible')));

  const actionSizes = await page.locator('#actions button:not(:disabled)').evaluateAll(buttons => buttons.map(button => ({width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height})));
  check('interactive targets are square and strictly ordered', actionSizes.every(size => Math.abs(size.width - size.height) < 0.1) && actionSizes.every((size, index) => index === 0 || size.width > actionSizes[index - 1].width), actionSizes);
  const glyphSizes = await page.locator('#glyphs .sf-close-icon').evaluateAll(glyphs => glyphs.map(glyph => glyph.getBoundingClientRect().width));
  check('all ten glyph sizes are strictly ordered', glyphSizes.length === 10 && glyphSizes.every((size, index) => index === 0 || size > glyphSizes[index - 1]), glyphSizes);
  check('glyph uses a local mask without icon-font dependency', await page.locator('#glyphs .sf-close-icon').first().evaluate(glyph => {
    const style = getComputedStyle(glyph);
    return style.maskImage.startsWith('url("data:image/svg+xml') && !style.fontFamily.toLowerCase().includes('material symbols');
  }));

  check('Smart Close stays decorative and hidden', await page.locator('#smart-glyph').evaluate(host => {
    const root = host.querySelector('.sf-close');
    return root?.getAttribute('aria-hidden') === 'true' && !host.querySelector('button,[tabindex]');
  }));
  check('invalid Smart size falls back to 1/3', await page.locator('#smart-invalid').evaluate(host => host.querySelector('.sf-close')?.classList.contains('sf-close--size-1/3')));
  check('Smart action owns one named native button', await page.locator('#smart-action').evaluate(host => {
    const button = host.querySelector('button');
    const glyph = host.querySelector('sf-close .sf-close');
    return host.querySelectorAll('button').length === 1 && button?.getAttribute('aria-label') === 'Закрыть Smart уведомление' && glyph?.getAttribute('aria-hidden') === 'true';
  }));

  await page.setViewportSize({width: 390, height: 844});
  check('mobile layout does not overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.evaluate(() => document.documentElement.className = 'theme-dark');
  check('dark theme preserves a visible close glyph', await page.locator('#smart-glyph .sf-close-icon').evaluate(glyph => getComputedStyle(glyph).backgroundColor !== 'rgba(0, 0, 0, 0)'));

  await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
  await page.reload({waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelector('#smart-action button'));
  check('forced colours keep glyph paint and keyboard focus', await page.evaluate(() => {
    const button = document.querySelector('#actions button');
    button.focus();
    const glyph = button.querySelector('.sf-close-icon');
    return button.matches(':focus-visible') && getComputedStyle(glyph).backgroundColor !== 'rgba(0, 0, 0, 0)';
  }));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
