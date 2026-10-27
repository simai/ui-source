#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// An error a host takes back leaves no trace (Larena acceptance, 2026-10-22:
// the datetime's time field said «Укажите время»; 10:30 cleared the text, but
// the red border and aria-invalid="true" stayed). On the built bytes, with
// core.css and the field sheets, UTF-8:
// - sf-input: `invalid`, `error` and setState({invalid}) each draw the error
//   border and aria-invalid="true" on the native input; taking them back
//   (removing the attribute, setState({invalid: false})) restores the valid
//   border and leaves no aria-invalid -- also after a re-render in between and
//   with error-message set;
// - sf-textarea: the same, on the textarea;
// - sf-datepicker: `invalid` and `error-message` reach its field and go away
//   with the attribute;
// - the field set's datetime editor: a cleared time marks the time control,
//   a time put right takes the mark off -- border and aria-invalid both; a day
//   missing marks the day control and putting it right clears it.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/textarea/css/textarea.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/datepicker/css/datepicker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/icon-button/js/icon-button.js', 'smart/smart/input/js/input.js', 'smart/smart/textarea/js/textarea.js',
  'smart/smart/datepicker/js/datepicker.js', 'smart/smart/field-renderers/js/field-renderers.js'];

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();
const origin = 'http://probe.test';

const page = await browser.newPage({viewport: {width: 600, height: 900}});
await page.route(`${origin}/**`, (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
  const path = join(out, url.pathname);
  return existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''});
});
page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));

const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 30)))));

try {
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">
    <sf-input id="input" label="Имя" error-message="Укажите имя"></sf-input>
    <sf-input id="input-error" label="Почта"></sf-input>
    <sf-textarea id="textarea" label="Комментарий" error-message="Напишите комментарий"></sf-textarea>
    <sf-datepicker id="picker" label="Дата" value="2026-11-15"></sf-datepicker>
    <div id="set" style="max-inline-size:420px;margin-block-start:24px"></div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
  // Colours are read at rest: the field's border transition would otherwise
  // be caught half-way.
  await page.addStyleTag({content: '*, *::before, *::after { transition: none !important; }'});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => window.SF?.fieldRenderers?.renderEditField && window.SF?.render && customElements.get('sf-datepicker')
    && customElements.get('sf-input') && customElements.get('sf-textarea'), null, {timeout: 10000});
  await page.waitForFunction(() => document.querySelector('#input input') && document.querySelector('#textarea textarea')
    && document.querySelector('#picker input'), null, {timeout: 8000});
  await settle();

  // What a reader sees and what assistive technology hears, per control.
  const look = (selector) => page.evaluate((selector) => {
    const host = document.querySelector(selector);
    const control = host.querySelector('textarea') || host.querySelector('input');
    const box = host.querySelector('.sf-input-field') || control;
    const style = getComputedStyle(box);
    return {
      border: style.borderTopColor,
      ariaInvalid: control.getAttribute('aria-invalid'),
      controlError: control.classList.contains('error'),
      rootError: Boolean(control.closest('.sf-input, .sf-textarea')?.classList.contains('error')),
      message: host.querySelector('[data-field-message="error"]')?.textContent?.trim() || '',
    };
  }, selector);

  const cycle = async (label, selector, set, clear, message = '') => {
    const before = await look(selector);
    await page.evaluate(set);
    await settle();
    const shown = await look(selector);
    // A re-render while invalid: the clear must not depend on the order of renders.
    await page.evaluate((selector) => document.querySelector(selector).setAttribute('placeholder', 'x'), selector);
    await settle();
    await page.evaluate(clear);
    await settle();
    const after = await look(selector);
    check(`${label}: valid to begin with`, before.ariaInvalid === null && !before.rootError && !before.controlError, before);
    check(`${label}: set draws the error border and aria-invalid`, shown.ariaInvalid === 'true' && shown.rootError
      && shown.border !== before.border && (!message || shown.message === message), shown);
    check(`${label}: clear takes both away`, after.ariaInvalid === null && !after.rootError && !after.controlError
      && after.border === before.border && after.message === '', {before, after});
  };

  await cycle('sf-input invalid attribute', '#input',
    () => document.querySelector('#input').setAttribute('invalid', ''),
    () => document.querySelector('#input').removeAttribute('invalid'), 'Укажите имя');
  await cycle('sf-input error attribute', '#input-error',
    () => document.querySelector('#input-error').setAttribute('error', ''),
    () => document.querySelector('#input-error').removeAttribute('error'));
  await cycle('sf-input setState({invalid})', '#input',
    () => document.querySelector('#input').setState({invalid: true}),
    () => document.querySelector('#input').setState({invalid: false}), 'Укажите имя');
  await cycle('sf-input invalid twice, cleared once', '#input',
    () => { const el = document.querySelector('#input'); el.setAttribute('invalid', ''); el.setAttribute('error', ''); },
    () => { const el = document.querySelector('#input'); el.removeAttribute('invalid'); el.removeAttribute('error'); });
  await cycle('sf-textarea invalid attribute', '#textarea',
    () => document.querySelector('#textarea').setAttribute('invalid', ''),
    () => document.querySelector('#textarea').removeAttribute('invalid'), 'Напишите комментарий');
  await cycle('sf-textarea error attribute', '#textarea',
    () => document.querySelector('#textarea').setAttribute('error', ''),
    () => document.querySelector('#textarea').removeAttribute('error'));
  await cycle('sf-datepicker invalid attribute', '#picker',
    () => { const el = document.querySelector('#picker'); el.setAttribute('error-message', 'Укажите дату'); el.setAttribute('invalid', ''); },
    () => document.querySelector('#picker').removeAttribute('invalid'), 'Укажите дату');

  // The field set's own datetime editor, driven the way a person does it.
  await page.evaluate(() => {
    const set = window.SF.fieldRenderers;
    window.errors = [];
    const host = {
      getFieldValue: () => '2026-11-15T10:30:00',
      setFieldValue: () => {},
      setFieldError: (field, message) => { window.errors.push(message); },
    };
    window.SF.render(set.renderEditField({key: 'start', label: 'Начало', propertyType: 'datetime'}, '2026-11-15T10:30:00', host, {size: '1'}),
      document.getElementById('set'));
  });
  await page.waitForFunction(() => document.querySelector('#set sf-datepicker input') && document.querySelector('#set sf-input.sf-field-datetime-time input'),
    null, {timeout: 8000});
  await settle();
  const TIME = '#set sf-input.sf-field-datetime-time';
  const DAY = '#set sf-datepicker';
  const timeValid = await look(TIME);
  await page.fill(`${TIME} input`, '');
  await page.press(`${TIME} input`, 'Tab');
  await settle();
  const timeShown = await look(TIME);
  check('field set: a cleared time draws the error on the time', timeShown.ariaInvalid === 'true' && timeShown.rootError
    && timeShown.border !== timeValid.border, {timeValid, timeShown});
  await page.fill(`${TIME} input`, '10:30');
  await page.press(`${TIME} input`, 'Tab');
  await settle();
  const timeFixed = await look(TIME);
  const note = await page.evaluate(() => { const node = document.querySelector('#set .sf-field-datetime-message'); return node.hidden ? '' : node.textContent; });
  check('field set: 10:30 takes the border and aria-invalid away with the text', timeFixed.ariaInvalid === null && !timeFixed.rootError
    && !timeFixed.controlError && timeFixed.border === timeValid.border && note === '', {timeValid, timeFixed, note});

  const dayValid = await look(DAY);
  await page.fill(`${DAY} input`, '');
  await page.press(`${DAY} input`, 'Enter');
  await settle();
  const dayShown = await look(DAY);
  check('field set: a time without a day marks the day', dayShown.ariaInvalid === 'true' && dayShown.border !== dayValid.border, {dayValid, dayShown});
  await page.fill(`${DAY} input`, '16.11.2026');
  await page.press(`${DAY} input`, 'Enter');
  await settle();
  const dayFixed = await look(DAY);
  check('field set: a day put right clears its mark', dayFixed.ariaInvalid === null && !dayFixed.rootError && dayFixed.border === dayValid.border,
    {dayValid, dayFixed});
  const errors = await page.evaluate(() => window.errors);
  check('field set: the host hears the error and its end', JSON.stringify(errors) === JSON.stringify(['Укажите время', null, 'Укажите дату', null]), {errors});
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FIELD_ERROR_CLEAR_OK');
