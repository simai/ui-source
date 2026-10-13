// Run with playwright-cli run-code using this file's contents as the argument.
async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });

  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/checkbox-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelector('#smart-default input'));
  await page.waitForTimeout(400);

  check('ordinary group exposes three native checkboxes', await page.locator('#ordinary-group input[type="checkbox"]').count() === 3);
  check('declarative mixed state initializes native property and mark', await page.locator('#mixed-root').evaluate(root => {
    const input = root.querySelector('input');
    return input.indeterminate && root.querySelector('.sf-checkbox-box .sf-icon').textContent.trim() === 'remove';
  }));

  const email = page.getByRole('checkbox', {name: 'Электронная почта', exact: true});
  await email.focus();
  await page.keyboard.press('Space');
  check('Space toggles the focused native checkbox', await email.isChecked());
  check('keyboard focus is visible', await email.evaluate(input => input.matches(':focus-visible') && getComputedStyle(input.closest('.sf-checkbox').querySelector('.sf-checkbox-box')).boxShadow !== 'none'));
  await page.mouse.click(1, 1);
  await email.click();
  check('pointer activation remains visually quiet', await email.evaluate(input => !input.matches(':focus-visible')));

  check('ordinary form owns submitted checked values', await page.locator('#ordinary-form').evaluate(form => {
    const values = new FormData(form).getAll('channels[]');
    return values.length === 1 && values[0] === 'push';
  }));

  const smartDefault = page.locator('#smart-default');
  check('Smart projection owns one native checkbox', await smartDefault.locator('input[type="checkbox"]').count() === 1);
  check('Smart native form fields preserve name value and checked state', await smartDefault.evaluate(host => {
    const input = host.querySelector('input');
    return input.name === 'smart-choice' && input.value === 'news' && input.checked;
  }));
  check('Smart mixed state uses the native property', await page.locator('#smart-mixed input').evaluate(input => input.indeterminate));
  check('Smart error publishes native invalid semantics and visible text', await page.locator('#smart-error').evaluate(host => host.querySelector('input')?.getAttribute('aria-invalid') === 'true' && host.textContent.includes('Выберите вариант')));
  await page.locator('#smart-end').evaluate(host => {
    host.setAttribute('size', 'unknown');
    host.setAttribute('position', 'unknown');
  });
  await page.waitForFunction(() => document.querySelector('#smart-end .sf-checkbox--size-1'));
  check('invalid Smart axes fall back to normal size and logical start', await page.locator('#smart-end').evaluate(host => {
    const root = host.querySelector('.sf-checkbox');
    return root.classList.contains('sf-checkbox--size-1') && root.firstElementChild.classList.contains('sf-checkbox-box');
  }));

  await smartDefault.getByRole('checkbox').uncheck();
  await page.locator('#smart-reset').click();
  await page.waitForFunction(() => document.querySelector('#smart-default input')?.checked);
  check('native reset restores the initial Smart checked state', await smartDefault.getByRole('checkbox').isChecked());

  const sizes = await page.locator('#sizes .sf-checkbox-box').evaluateAll(nodes => nodes.map(node => ({width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height})));
  check('normal and compact sizes are square and strictly ordered', sizes.length === 2 && sizes.every(size => size.width === size.height) && sizes[0].width > sizes[1].width, sizes);
  check('end placement follows the physical side implied by LTR', await page.locator('#position .sf-checkbox').evaluate(root => root.querySelector('.sf-checkbox-box').getBoundingClientRect().left > root.querySelector('.sf-checkbox-container').getBoundingClientRect().left));

  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  check('logical end placement mirrors in RTL', await page.locator('#position .sf-checkbox').evaluate(root => root.querySelector('.sf-checkbox-box').getBoundingClientRect().left < root.querySelector('.sf-checkbox-container').getBoundingClientRect().left));

  await page.setViewportSize({width: 390, height: 844});
  check('long labels fit mobile without shrinking the indicator', await page.locator('#long-label').evaluate(root => {
    const box = root.querySelector('.sf-checkbox-box').getBoundingClientRect();
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && box.width === box.height && box.width > 0;
  }));
  check('reduced motion stops indicator transitions', await page.locator('#long-label .sf-checkbox-box').evaluate(box => getComputedStyle(box).transitionDuration === '0s'));

  await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
  await page.reload({waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelector('#smart-default input'));
  const forced = page.getByRole('checkbox', {name: 'Электронная почта', exact: true});
  await forced.focus();
  check('forced colours retain keyboard focus and mixed state', await page.evaluate(() => {
    const input = document.querySelector('#ordinary-group input');
    const mixed = document.querySelector('#mixed-root input');
    const box = input.closest('.sf-checkbox').querySelector('.sf-checkbox-box');
    return input.matches(':focus-visible') && getComputedStyle(box).outlineStyle !== 'none' && mixed.indeterminate;
  }));
  check('no runtime errors', errors.length === 0, errors);

  if (results.some(result => !result.pass)) {
    throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  }
  return {results, errors};
}
