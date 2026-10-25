#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-code-input (owner, 2026-10-25), measured on the built bytes, with the
// class verification's runtime loaded beside it as the loader loads it:
// - the class markup: a group named by its label, one native input
//   (one-time-code, inputmode, pattern, name) over six aria-hidden cells; the
//   class runtime binds nothing to it;
// - typing fills the next cell and moves on, a character the mode does not
//   keep is not written, a character typed into a filled cell takes its
//   place, Backspace clears the cell before the caret and steps back, the
//   arrows, Home and End move the caret's cell, a click lands in the cell
//   clicked;
// - each move says «цифра N из M» on the polite line the input is described
//   by, «digit N of M» on an English page, «символ» for an alphanumeric code;
// - input from the native input (already kept to the mode), change once on
//   leaving, sf-code-input:complete {value} once per whole code;
// - a pasted code fills every cell, filtered to the mode; the form value and
//   a form reset; a controlled value follows the person, a value set from
//   code sends nothing;
// - mask, invalid with its message, required, disabled and readonly;
// - at 1000 and 390 wide: each size's cells are the class's size and square,
//   both appearances draw as the class's, and nothing scrolls sideways.
import {resolve, join} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/verification/css/verification.css', 'smart/smart/code-input/css/code-input.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js',
  'component/component/verification/js/verification.js', 'smart/smart/code-input/js/code-input.js'];
const SIZES = [['1/2', '--sf-title-height-4'], ['1', '--sf-title-height-6'], ['2', '--sf-title-height-7']];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  const sized = SIZES.map(([size]) => `<div data-row="${size}" style="display:grid;gap:16px">
      ${['bordered', 'filled'].map((appearance) => `<sf-code-input data-size="${size}" data-appearance="${appearance}" size="${size}" appearance="${appearance}" label="Код" value="12"></sf-code-input>`).join('')}
    </div>`).join('');
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;display:grid;gap:24px">
    <form id="form">
      <sf-code-input id="basic" label="Код из сообщения" name="code" required hint="Шесть цифр из сообщения"></sf-code-input>
      <button id="after" type="button">Дальше</button>
    </form>
    <sf-code-input id="alpha" label="Код из письма" mode="alphanumeric" length="4"></sf-code-input>
    <sf-code-input id="masked" label="Код" mask value="12"></sf-code-input>
    <sf-code-input id="invalid" label="Код" value="111111" invalid error-message="Неверный код" hint="Шесть цифр"></sf-code-input>
    <sf-code-input id="controlled" label="Код" value="12"></sf-code-input>
    <sf-code-input id="disabled" label="Код" disabled value="12"></sf-code-input>
    <sf-code-input id="readonly" label="Код" readonly value="12"></sf-code-input>
    <div lang="en"><sf-code-input id="en" length="4" aria-label="Sign-in code"></sf-code-input></div>
    <span id="error-ink" style="color:var(--sf-error)">x</span>
    ${sized}
  </body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-code-input')
    && document.querySelectorAll('#basic .sf-verification-cell').length === 6
    && document.querySelectorAll('#en .sf-verification-cell').length === 4, null, {timeout: 8000});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__events = [];
    window.__classEvents = 0;
    document.addEventListener('verification:complete', () => { window.__classEvents += 1; });
    for (const type of ['input', 'change', 'sf-code-input:complete']) {
      document.addEventListener(type, (event) => {
        const host = event.target.closest?.('sf-code-input');
        window.__events.push({type, host: host?.id ?? null, value: event.detail?.value ?? host?.querySelector('input')?.value ?? null,
          target: event.target.localName});
      });
    }
  });
  const events = () => page.evaluate(() => window.__events.splice(0));
  const settle = () => page.waitForTimeout(60);

  const state = (id) => page.evaluate((key) => {
    const host = document.getElementById(key);
    const root = host.querySelector('.sf-verification-form');
    const input = host.querySelector('input');
    const cells = [...host.querySelectorAll('.sf-verification-cell')];
    const described = (input.getAttribute('aria-describedby') || '').split(/\s+/u).filter(Boolean).map((id) => document.getElementById(id)?.textContent.trim());
    const labelled = root.getAttribute('aria-labelledby');
    return {
      value: input.value, attribute: host.getAttribute('value'), property: host.value, complete: host.complete,
      cells: cells.map((cell) => cell.textContent), current: cells.findIndex((cell) => cell.classList.contains('current')),
      caret: input.selectionStart, focused: document.activeElement === input,
      group: root.getAttribute('role'), groupName: labelled ? document.getElementById(labelled)?.textContent.replace('*', '').trim() : root.getAttribute('aria-label'),
      labelFor: host.querySelector('label')?.htmlFor === input.id, inputName: input.getAttribute('aria-label'),
      type: input.type, inputmode: input.inputMode, autocomplete: input.autocomplete, pattern: input.pattern, name: input.name,
      dir: input.dir, cellsHidden: host.querySelector('.sf-verification-cells')?.getAttribute('aria-hidden'),
      described, position: host.querySelector('.sf-code-input-position')?.textContent, live: host.querySelector('.sf-code-input-position')?.getAttribute('aria-live'),
      invalid: input.getAttribute('aria-invalid'), errormessage: input.getAttribute('aria-errormessage') ? document.getElementById(input.getAttribute('aria-errormessage'))?.textContent.trim() : null,
      error: root.classList.contains('error'), owner: root.dataset.sfVerificationOwner,
      required: input.required, valueMissing: input.validity.valueMissing, patternMismatch: input.validity.patternMismatch,
    };
  }, id);

  // The markup.
  const basic = await state('basic');
  evidence.basic = basic;
  check('markup: a group named by the label, the field labelled by it', basic.group === 'group' && basic.groupName === 'Код из сообщения' && basic.labelFor, {basic});
  check('markup: one native input for a one-time code', basic.type === 'text' && basic.inputmode === 'numeric' && basic.autocomplete === 'one-time-code'
    && basic.pattern === '[0-9]{6}' && basic.name === 'code' && basic.dir === 'ltr', {basic});
  check('markup: six empty cells hidden from assistive technology', basic.cells.length === 6 && basic.cells.every((cell) => cell === '') && basic.cellsHidden === 'true', {basic});
  check('markup: described by the caret\'s cell, then the hint', basic.described.join('|') === 'цифра 1 из 6|Шесть цифр из сообщения' && basic.live === 'polite', {basic});
  check('markup: the class runtime left the field to the element', basic.owner === 'smart'
    && await page.evaluate(() => document.querySelectorAll('#basic .sf-verification-cells').length === 1), {basic});
  check('markup: required and empty is missing', basic.required && basic.valueMissing, {basic});

  // Typing.
  await page.focus('#basic input');
  await page.keyboard.type('12');
  await settle();
  const typed = await state('basic');
  const typedEvents = await events();
  check('typing: each character fills the next cell', typed.value === '12' && typed.cells.join(',') === '1,2,,,,' && typed.current === 2, {typed});
  check('typing: the caret\'s cell is spoken', typed.position === 'цифра 3 из 6', {typed});
  check('typing: an input event from the native input for each character', typedEvents.length === 2
    && typedEvents.every((event) => event.type === 'input' && event.host === 'basic' && event.target === 'input'), {typedEvents});
  check('typing: a partial code does not match the pattern', typed.patternMismatch, {typed});
  await page.keyboard.type('a- ');
  await settle();
  check('typing: what the mode does not keep is not written', (await state('basic')).value === '12' && (await events()).length === 0);
  await page.keyboard.press('Backspace');
  await settle();
  const back = await state('basic');
  check('Backspace: clears the cell before the caret and steps back', back.value === '1' && back.cells.join(',') === '1,,,,,' && back.current === 1 && back.position === 'цифра 2 из 6', {back});
  await page.keyboard.type('2345');
  await settle();
  const moves = [];
  for (const key of ['ArrowLeft', 'ArrowLeft', 'Home', 'ArrowRight', 'End']) {
    await page.keyboard.press(key);
    await settle();
    const now = await state('basic');
    moves.push(`${now.current}:${now.position}`);
  }
  evidence.moves = moves;
  check('keyboard: the arrows, Home and End move the caret\'s cell, and each is spoken',
    moves.join() === '4:цифра 5 из 6,3:цифра 4 из 6,0:цифра 1 из 6,1:цифра 2 из 6,5:цифра 6 из 6', {moves});
  await page.keyboard.press('Home');
  await page.keyboard.type('9');
  await settle();
  const over = await state('basic');
  check('typing: a character in a filled cell takes its place', over.value === '92345' && over.caret === 1 && over.current === 1, {over});
  await events();
  await page.keyboard.press('End');
  await page.keyboard.type('6');
  await page.waitForTimeout(100);
  const whole = await state('basic');
  const completeEvents = await events();
  check('complete: the sixth character completes the code', whole.value === '923456' && whole.complete && !whole.patternMismatch && whole.current === 5, {whole});
  check('complete: one sf-code-input:complete {value} after the input event', JSON.stringify(completeEvents.map((event) => [event.type, event.value]))
    === JSON.stringify([['input', '923456'], ['sf-code-input:complete', '923456']]), {completeEvents});
  await page.keyboard.type('7');
  await page.waitForTimeout(100);
  const replaced = await state('basic');
  const replacedEvents = await events();
  check('typing after a whole code takes the last cell, and that new code completes once', replaced.value === '923457'
    && replacedEvents.filter((event) => event.type === 'sf-code-input:complete').length === 1, {replaced, replacedEvents});
  await page.keyboard.press('Tab');
  await settle();
  const changeEvents = (await events()).filter((event) => event.type === 'change');
  check('change: once, from the native input, on leaving', changeEvents.length === 1 && changeEvents[0].target === 'input' && changeEvents[0].value === '923457', {changeEvents});

  // A click puts the caret in the cell clicked.
  const box = await page.evaluate(() => {
    const rect = document.querySelectorAll('#basic .sf-verification-cell')[2].getBoundingClientRect();
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
  });
  await page.mouse.click(box.x, box.y);
  await settle();
  const clicked = await state('basic');
  check('click: the caret lands in the cell under the pointer', clicked.focused && clicked.caret === 2 && clicked.current === 2 && clicked.position === 'цифра 3 из 6', {clicked});
  await page.keyboard.press('Tab');
  await events();

  // Paste.
  const paste = (id, text) => page.evaluate(({key, value}) => {
    const input = document.querySelector(`#${key} input`);
    input.focus();
    input.setSelectionRange(1, 1);
    const data = new DataTransfer();
    data.setData('text/plain', value);
    return input.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
  }, {key: id, value: text});
  await paste('basic', 'Ваш код: 654-321. Никому не сообщайте.');
  await page.waitForTimeout(100);
  const pasted = await state('basic');
  const pasteEvents = await events();
  check('paste: a whole code fills every cell, filtered to the mode, wherever the caret was', pasted.value === '654321'
    && pasted.cells.join('') === '654321' && pasted.caret === 6, {pasted});
  check('paste: input, then complete', JSON.stringify(pasteEvents.map((event) => [event.type, event.value]))
    === JSON.stringify([['input', '654321'], ['sf-code-input:complete', '654321']]), {pasteEvents});
  check('form: the code is the form value', await page.evaluate(() => new FormData(document.getElementById('form')).get('code')) === '654321');
  await page.evaluate(() => document.getElementById('form').reset());
  await page.waitForTimeout(100);
  const reset = await state('basic');
  check('form: a reset empties the code and its cells', reset.value === '' && reset.cells.every((cell) => cell === ''), {reset});
  await page.keyboard.press('Tab');
  await events();

  // Alphanumeric.
  await paste('alpha', 'ab-1Ц2-zz');
  await page.waitForTimeout(100);
  const alpha = await state('alpha');
  check('alphanumeric: Latin letters and digits, four cells, a text keyboard', alpha.value === 'ab12' && alpha.cells.length === 4
    && alpha.inputmode === 'text' && alpha.pattern === '[A-Za-z0-9]{4}', {alpha});
  await page.keyboard.press('Home');
  await settle();
  check('alphanumeric: the cell is spoken as a character', (await state('alpha')).position === 'символ 1 из 4');
  await page.keyboard.press('Tab');
  await events();

  // English, mask, invalid.
  const en = await state('en');
  check('English page: «digit N of M», the group named by aria-label', en.position === 'digit 1 of 4' && en.groupName === 'Sign-in code' && en.inputName === 'Sign-in code', {en});
  const masked = await state('masked');
  check('mask: dots in the cells, a password field', masked.cells.join('') === '••' && masked.type === 'password' && masked.value === '12', {masked});
  const invalid = await state('invalid');
  const ink = await page.evaluate(() => ({
    error: getComputedStyle(document.getElementById('error-ink')).color,
    cell: getComputedStyle(document.querySelector('#invalid .sf-verification-cell')).borderTopColor,
    hint: getComputedStyle(document.querySelector('#invalid .sf-verification-form-hint')).color,
  }));
  check('invalid: the error message replaces the hint and names the error', invalid.invalid === 'true' && invalid.errormessage === 'Неверный код'
    && invalid.described.join('|') === 'цифра 6 из 6|Неверный код' && invalid.error, {invalid});
  check('invalid: cells and message in the error colour', ink.cell === ink.error && ink.hint === ink.error, {ink});

  // Controlled value, a value set from code, disabled, readonly.
  await page.focus('#controlled input');
  await page.keyboard.press('End');
  await page.keyboard.type('3');
  await settle();
  check('controlled: the attribute follows the person', (await state('controlled')).attribute === '123');
  await page.keyboard.press('Tab');
  await events();
  await page.evaluate(() => { document.getElementById('controlled').value = '99-88-77'; });
  await page.waitForTimeout(100);
  const fromCode = await state('controlled');
  check('value from code: kept to the mode, drawn, no event', fromCode.value === '998877' && fromCode.cells.join('') === '998877'
    && fromCode.property === '998877' && (await events()).length === 0, {fromCode});
  const disabled = await page.evaluate(() => {
    const input = document.querySelector('#disabled input');
    const cell = getComputedStyle(document.querySelector('#disabled .sf-verification-cell'));
    const plain = getComputedStyle(document.querySelector('#controlled .sf-verification-cell'));
    return {disabled: input.disabled, background: cell.backgroundColor, plain: plain.backgroundColor};
  });
  check('disabled: a disabled field, cells on the disabled fill', disabled.disabled && disabled.background !== disabled.plain, {disabled});
  await page.focus('#readonly input');
  await page.keyboard.type('5');
  await paste('readonly', '123456');
  await settle();
  check('readonly: neither typing nor a paste changes it', (await state('readonly')).value === '12');
  await page.keyboard.press('Tab');
  await events();

  // Sizes and appearances, at two widths.
  for (const width of [1000, 390]) {
    await page.setViewportSize({width, height: 900});
    await page.waitForTimeout(300);
    const measured = await page.evaluate((sizes) => {
      const token = (name) => {
        const probe = document.createElement('div');
        probe.style.blockSize = `var(${name})`;
        document.body.append(probe);
        const value = probe.getBoundingClientRect().height;
        probe.remove();
        return value;
      };
      const rows = sizes.map(([size, name]) => {
        const row = document.querySelector(`[data-row="${size}"]`);
        const fields = [...row.querySelectorAll('sf-code-input')].map((host) => {
          const cells = [...host.querySelectorAll('.sf-verification-cell')].map((cell) => cell.getBoundingClientRect());
          const style = getComputedStyle(host.querySelector('.sf-verification-cell'));
          const group = host.querySelector('.sf-verification-form').getBoundingClientRect();
          return {appearance: host.dataset.appearance, width: cells[0].width, height: cells[0].height,
            same: cells.every((cell) => Math.abs(cell.height - cells[0].height) < 0.01 && Math.abs(cell.width - cells[0].width) < 0.01),
            background: style.backgroundColor, border: style.borderTopColor, right: Math.max(...cells.map((cell) => cell.right)), group: group.right};
        });
        return {size, token: token(name), fields};
      });
      return {rows, scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, viewport: document.documentElement.clientWidth};
    }, SIZES);
    evidence[width] = measured.rows.map((row) => ({size: row.size, token: row.token, cells: row.fields.map((field) => `${field.width}x${field.height}`)}));
    for (const row of measured.rows) {
      for (const field of row.fields) {
        check(`${width}px size ${row.size} ${field.appearance}: square cells of the class size`, near(field.height, row.token) && near(field.width, row.token) && field.same,
          {field, token: row.token});
        check(`${width}px size ${row.size} ${field.appearance}: the cells stay inside the page`, field.right <= measured.viewport, {right: field.right, viewport: measured.viewport});
      }
      const [bordered, filled] = row.fields;
      check(`${width}px size ${row.size}: bordered cells on the surface, filled ones on a fill without a border`,
        bordered.background !== filled.background && bordered.border !== 'rgba(0, 0, 0, 0)' && filled.border === 'rgba(0, 0, 0, 0)', {bordered, filled});
    }
    check(`${width}px: the page does not scroll sideways`, !measured.scroll);
  }
  const classEvents = await page.evaluate(() => window.__classEvents);
  check('the class runtime sent no event of its own', classEvents === 0, {classEvents});
} finally {
  await browser.close();
}
console.log(JSON.stringify(evidence, null, 1));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('CODE_INPUT_SMART_OK');
