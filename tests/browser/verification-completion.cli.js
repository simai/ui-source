async page => {
  const results = [];
  const errors = [];
  const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:8768/tests/fixtures/verification-method-lab.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.SF?.Verification?.contract === 'single-input');

  const form = page.locator('#code-form .sf-verification-form');
  const input = form.locator('.sf-verification-input');
  check('one native input creates six decorative cells', await form.evaluate(root =>
    root.querySelectorAll('input').length === 1
    && root.querySelectorAll('.sf-verification-cell').length === 6
    && root.querySelector('.sf-verification-cells').getAttribute('aria-hidden') === 'true'));

  let completions = 0;
  await form.evaluate(root => root.addEventListener('verification:complete', () => window.__verificationCompletions = (window.__verificationCompletions || 0) + 1));
  await input.evaluate(inputNode => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', '12 x34-56');
    inputNode.dispatchEvent(new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData: clipboard}));
  });
  completions = await page.evaluate(() => window.__verificationCompletions || 0);
  check('numeric value normalizes as one complete code', await form.evaluate(root =>
    SF.Verification.getValue(root) === '123456'
    && [...root.querySelectorAll('.sf-verification-cell')].map(cell => cell.textContent).join('') === '123456'), completions);
  check('completion intent fires once and never submits', completions === 1 && page.url().includes('verification-method-lab'));

  await input.fill('12345');
  await input.fill('123456');
  check('same complete value can complete after editing', await page.evaluate(() => window.__verificationCompletions === 2));

  await form.locator('input').focus();
  check('keyboard focus belongs to one joined boundary', await form.evaluate(root => {
    const control = root.querySelector('.sf-verification');
    const inputNode = root.querySelector('input');
    return document.activeElement === inputNode && getComputedStyle(control).boxShadow !== 'none';
  }));

  await page.getByRole('button', {name: 'Сбросить'}).click();
  await page.waitForTimeout(50);
  check('native form reset clears value and cells', await form.evaluate(root =>
    SF.Verification.getValue(root) === ''
    && [...root.querySelectorAll('.sf-verification-cell')].every(cell => cell.textContent === '')));

  const rtl = page.locator('[dir="rtl"].sf-verification-form');
  check('RTL labels remain RTL while code cells remain LTR', await rtl.evaluate(root =>
    getComputedStyle(root).direction === 'rtl'
    && getComputedStyle(root.querySelector('.sf-verification-cells')).direction === 'ltr'
    && SF.Verification.getValue(root) === 'A7B2'));

  const invalidInput = page.getByLabel('Неверный код');
  await invalidInput.fill('1234');
  check('editing clears host error state deterministically', await invalidInput.evaluate(inputNode => {
    const root = inputNode.closest('.sf-verification-form');
    return !root.classList.contains('error') && !inputNode.hasAttribute('aria-invalid');
  }));

  const lifecycle = await page.evaluate(async () => {
    const late = document.createElement('label');
    late.className = 'sf-verification-form';
    late.dataset.length = '3';
    late.innerHTML = '<span class="sf-verification"><input class="sf-verification-input" aria-label="Поздний код"></span>';
    document.body.appendChild(late);
    await new Promise(resolve => setTimeout(resolve, 50));
    const initialized = late.querySelectorAll('.sf-verification-cell').length === 3;
    late.remove();
    return initialized;
  });
  check('dynamically added roots initialize', lifecycle);

  check('mobile layout has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('no runtime errors', errors.length === 0, errors);
  if (results.some(result => !result.pass)) throw new Error(`Failed checks: ${results.filter(result => !result.pass).map(result => result.name).join(', ')}`);
  return {results, errors};
}
