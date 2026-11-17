#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Owner decision C291 (2) and (3), 2026-11-17, on the built set.
// (2) money and percent are the Framework's in every mode: the view and the
// cell in the page's language, the editor with its sign in the field and the
// decimal keyboard, writing decimal strings and saying what is wrong (digits,
// bounds, a missing currency), the filter with the sign, and the registry
// listing both with every mode. (3) sf-form apply="answer": «Отправить» and
// «Отмена» at size 1/2, pending while the answer is on its way, the read view
// with «Отправлено» and no «Изменить» after it, nothing after a decline, the
// line alone when the time ran out, set-errors reopening a pending answer.
// Run on an English page and on a Russian one (core/lang/ru.js before core).
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/dropdown/css/dropdown.css',
  'component/component/buttons/css/buttons.css', 'smart/smart/form/css/form.css',
].map((p) => join(out, p));
const ruPack = join(out, 'core/core/lang/ru.js');
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/list-item/js/list-item.js', 'smart/smart/input/js/input.js',
  'smart/smart/dropdown/js/dropdown.js', 'smart/smart/input-textarea/js/input-textarea.js',
  'smart/smart/field-renderers/js/field-renderers.js', 'smart/smart/form/js/form.js',
].map((p) => join(out, p));
const absent = [...styles, ruPack, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const failures = [];
const expect = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push({case: name, got, want});
};
const browser = await chromium.launch({headless: true});
const nbsp = (text) => (typeof text === 'string' ? text.replace(/[  ]/gu, ' ') : text);

async function run(lang) {
  const page = await browser.newPage({viewport: {width: 900, height: 1400}});
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => { if (!String(error).includes('Automatic publicPath')) errors.push(String(error)); });
  await page.setContent(`<!doctype html><html class="theme-light" lang="${lang}"><head><meta charset="utf-8"></head>`
    + '<body style="margin:0"><div id="host" style="width:600px"></div><div id="forms" style="width:480px"></div></body></html>');
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  if (lang === 'ru') await page.addScriptTag({path: ruPack});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => Boolean(window.SF?.fieldRenderers?.renderEditField && window.SF?.render
    && customElements.get('sf-form') && customElements.get('sf-input')), null, {timeout: 10000});

  // (2) the renderers, driven through their host interface.
  const set = await page.evaluate(async () => {
    const set = window.SF.fieldRenderers;
    const {render} = window.SF;
    const holder = document.getElementById('host');
    const settle = () => new Promise((done) => setTimeout(done, 300));
    const draw = (content) => {
      const box = document.createElement('div');
      holder.append(box);
      render(content, box);
      return box;
    };
    const text = (field, value) => draw(set.renderViewField(field, value, null)).textContent.trim();
    const report = {};
    report.registry = Object.fromEntries(set.registry.filter((entry) => ['money', 'percent'].includes(entry.type))
      .map((entry) => [entry.type, {set: entry.set ?? null, modes: entry.modes, params: entry.params}]));
    report.view = {
      money: text({key: 'p', propertyType: 'money'}, {amount: '1500.5', currency: 'RUB'}),
      moneyUsd: text({key: 'p', propertyType: 'money'}, {amount: '1500.5', currency: 'USD'}),
      moneyFixed: text({key: 'p', propertyType: 'money', currency: 'JPY'}, '1200'),
      percent: text({key: 'd', propertyType: 'percent'}, '12.5'),
      host: draw(set.renderViewField({key: 'd', propertyType: 'percent'}, '12.5', {formatFieldValue: () => 'host'})).textContent.trim(),
      empty: text({key: 'd', propertyType: 'percent'}, null),
    };
    report.cell = {
      money: set.renderCellField({key: 'p', propertyType: 'money'}, {amount: '1500.5', currency: 'RUB'}, null),
      percent: set.renderCellField({key: 'd', propertyType: 'percent'}, '12.5', null),
    };

    // An editor and what it wrote: the last value and error per field.
    const host = () => {
      const log = {value: undefined, error: undefined};
      return {log, setFieldValue: (field, value) => { log.value = value; }, setFieldError: (field, message) => { log.error = message; }};
    };
    const type = async (box, typed) => {
      const input = box.querySelector('sf-input');
      // No editor (a set without one) writes nothing.
      if (!input) return null;
      input.value = typed;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      await settle();
      return input;
    };
    const percentHost = host();
    const percent = draw(set.renderEditField({key: 'd', label: 'Discount', propertyType: 'percent', precision: 1}, '12.5', percentHost));
    await settle();
    const percentInput = percent.querySelector('sf-input');
    report.percentEdit = {
      shown: percentInput?.getAttribute('value'),
      end: percentInput?.getAttribute('text-end'),
      keyboard: percentInput?.getAttribute('inputmode'),
    };
    await type(percent, '12,75');
    report.percentEdit.digits = {...percentHost.log};
    await type(percent, '150');
    report.percentEdit.bound = {...percentHost.log};
    await type(percent, '7,5');
    report.percentEdit.ok = {...percentHost.log};
    await type(percent, 'abc');
    report.percentEdit.notNumber = {...percentHost.log, invalid: percent.querySelector('sf-input')?.hasAttribute('invalid') ?? null};

    const fixedHost = host();
    const fixed = draw(set.renderEditField({key: 'p', label: 'Price', propertyType: 'money', currency: 'RUB'}, {amount: '1500.5', currency: 'RUB'}, fixedHost));
    await settle();
    const fixedInput = fixed.querySelector('sf-input');
    report.moneyFixed = {shown: fixedInput?.getAttribute('value'), end: fixedInput?.getAttribute('text-end'),
      start: fixedInput?.getAttribute('text-start'), dropdown: Boolean(fixed.querySelector('sf-dropdown'))};
    await type(fixed, '10.555');
    report.moneyFixed.minor = {...fixedHost.log};
    await type(fixed, '1 500,5');
    report.moneyFixed.ok = {...fixedHost.log};

    const usdHost = host();
    const usd = draw(set.renderEditField({key: 'p', label: 'Price', propertyType: 'money', currency: 'USD'}, null, usdHost));
    await settle();
    report.moneyUsd = {start: usd.querySelector('sf-input')?.getAttribute('text-start'), end: usd.querySelector('sf-input')?.getAttribute('text-end')};

    const freeHost = host();
    const free = draw(set.renderEditField({key: 'p', label: 'Price', propertyType: 'money'}, null, freeHost));
    await settle();
    const dropdown = free.querySelector('sf-dropdown');
    report.moneyFree = {dropdown: Boolean(dropdown), first: dropdown?.options?.[0]?.value ?? null, count: dropdown?.options?.length ?? 0,
      label: dropdown?.getAttribute('aria-label')};
    const rect = (node) => node?.getBoundingClientRect?.();
    const amountBox = rect(free.querySelector('.sf-input'));
    const currencyBox = rect(free.querySelector('.sf-dropdown'));
    report.moneyFree.row = amountBox && currencyBox ? {sameTop: Math.round(amountBox.top) === Math.round(currencyBox.top),
      sameHeight: Math.round(amountBox.height) === Math.round(currencyBox.height), gap: Math.round(currencyBox.left - amountBox.right),
      heights: [Math.round(amountBox.height), Math.round(currencyBox.height)]} : null;
    await type(free, '100');
    report.moneyFree.noCurrency = {...freeHost.log};

    const patched = [];
    const filterHost = (operator) => ({
      getFilterControlValue: () => ({operator, value: ''}),
      patchTempFilterValue: (key, patch) => patched.push(patch.value),
      getFilterOperatorLabel: (one) => one,
    });
    const moneyFilter = draw(set.renderFilterField({key: 'p', propertyType: 'money', currency: 'USD', filter: {operators: ['gte']}}, filterHost('gte')));
    const percentFilter = draw(set.renderFilterField({key: 'd', propertyType: 'percent', filter: {operators: ['gte']}}, filterHost('gte')));
    await settle();
    const pf = percentFilter.querySelector('sf-input');
    report.filter = {
      moneyStart: moneyFilter.querySelector('sf-input')?.getAttribute('text-start'),
      percentEnd: pf?.getAttribute('text-end'),
      keyboard: pf?.getAttribute('inputmode'),
    };
    if (pf) {
      pf.value = '12,5';
      pf.dispatchEvent(new Event('change', {bubbles: true}));
    }
    report.filter.written = patched.at(-1);
    return report;
  });

  // (3) sf-form apply="answer", pressed through the page.
  const form = async (settings, steps) => page.evaluate(async ({settings, steps}) => {
    const settle = () => new Promise((done) => setTimeout(done, 350));
    const box = document.getElementById('forms');
    box.replaceChildren();
    const form = document.createElement('sf-form');
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'object') form[key] = value;
      else form.setAttribute(key, String(value));
    }
    const heard = [];
    form.addEventListener('sf-form-answer', (event) => {
      heard.push(event.detail);
      if (steps.onAnswer === 'accept') form.state = 'accepted';
      if (steps.onAnswer === 'decline') form.state = 'declined';
      if (steps.onAnswer === 'refuse') event.preventDefault();
    });
    box.append(form);
    await settle();
    const read = () => {
      const submit = form.querySelector('.sf-form-submit');
      const cancel = form.querySelector('.sf-form-cancel');
      const line = form.querySelector('.sf-form-mark');
      const input = form.querySelector('.sf-form-control sf-input');
      const button = submit?.querySelector('button');
      const field = input?.querySelector('input');
      return {
        state: form.getAttribute('data-state'),
        fields: form.querySelectorAll('.sf-form-field').length,
        submit: submit?.getAttribute('text') ?? null,
        cancel: cancel?.getAttribute('text') ?? null,
        edit: Boolean(form.querySelector('.sf-form-edit')),
        sizes: [...form.querySelectorAll('.sf-form-control sf-input, .sf-form-control sf-dropdown, .sf-form-actions sf-button')].map((node) => node.getAttribute('size')),
        line: line ? [...line.querySelectorAll('span')].map((node) => node.textContent.trim()).join('') : null,
        glyph: line?.querySelector('sf-icon')?.getAttribute('icon') ?? null,
        loading: submit?.hasAttribute('loading') ?? null,
        inert: form.querySelector('.sf-form-body')?.hasAttribute('inert') ?? null,
        heights: button && field ? [Math.round(button.getBoundingClientRect().height), Math.round(input.querySelector('.sf-input')?.getBoundingClientRect().height ?? 0)] : null,
        views: [...form.querySelectorAll('.sf-field-view')].map((node) => node.textContent.trim()),
      };
    };
    const steps_ = [];
    steps_.push({at: 'drawn', ...read()});
    for (const step of steps.do || []) {
      const press = (selector) => {
        const button = form.querySelector(selector);
        button?.focus();
        button?.click();
      };
      if (step === 'send') press('.sf-form-submit button');
      if (step === 'cancel') press('.sf-form-cancel button');
      if (step === 'fill') {
        form.value = {...form.value, company: 'Acme', budget: {amount: '1500000.5', currency: 'RUB'}, discount: '12.5'};
      }
      if (step === 'errors') form.setErrors({errors: {company: 'Taken'}});
      await settle();
      steps_.push({at: step, ...read(), heard: heard.length, last: heard.at(-1) ?? null, focusLine: document.activeElement?.classList?.contains('sf-form-mark') ?? false});
    }
    return steps_;
  }, {settings, steps});

  const fields = [
    {key: 'company', label: 'Company', propertyType: 'string', required: true},
    {key: 'budget', label: 'Budget', propertyType: 'money', currency: 'RUB', required: true},
    {key: 'discount', label: 'Discount', propertyType: 'percent', precision: 1, width: 's'},
  ];
  const base = {label: 'Request', apply: 'answer', size: '1/2', fields};
  const forms = {
    accept: await form(base, {onAnswer: 'accept', do: ['send', 'fill', 'send']}),
    pending: await form(base, {do: ['fill', 'send', 'errors']}),
    refuse: await form(base, {onAnswer: 'refuse', do: ['fill', 'send']}),
    decline: await form(base, {onAnswer: 'decline', do: ['cancel']}),
    expired: await form({...base, state: 'expired'}, {do: []}),
    sizeOne: await form({...base, size: '1'}, {do: []}),
  };
  await page.close();
  return {set, forms, errors};
}

try {
  const en = await run('en');
  const ru = await run('ru');
  console.log(JSON.stringify({en, ru}, null, 1));
  for (const [lang, {set, forms, errors}] of [['en', en], ['ru', ru]]) {
    const at = (name) => `${lang}: ${name}`;
    const ru_ = lang === 'ru';
    const all = {view: true, edit: true, cell: 'own', filter: 'own'};
    expect(at('(2) money and percent are the Framework\'s in every mode'), [set.registry.money.set, set.registry.money.modes,
      set.registry.percent.set, set.registry.percent.modes], [null, all, null, all]);
    expect(at('(2) the view in the page language'), Object.fromEntries(Object.entries(set.view).map(([k, v]) => [k, nbsp(v)])), ru_
      ? {money: '1 500,50 ₽', moneyUsd: '1 500,50 $', moneyFixed: '1 200 ¥', percent: '12,5 %', host: 'host', empty: ''}
      // C294: the standard sign -- an English page writes «RUB» for the rouble and «¥» for the yen.
      : {money: 'RUB 1,500.50', moneyUsd: '$1,500.50', moneyFixed: '¥1,200', percent: '12.5 %', host: 'host', empty: ''});
    expect(at('(2) the cell reads as the view'), [nbsp(set.cell.money), nbsp(set.cell.percent)], [nbsp(set.view.money), nbsp(set.view.percent)]);
    expect(at('(2) percent editor: shown in the page language, % and the decimal keyboard'), [set.percentEdit.shown, set.percentEdit.end, set.percentEdit.keyboard],
      [ru_ ? '12,5' : '12.5', '%', 'decimal']);
    expect(at('(2) percent: more digits than precision'), [set.percentEdit.digits.value, set.percentEdit.digits.error],
      ['12.75', ru_ ? 'Не больше 1 знака после запятой' : 'At most 1 digit after the point']);
    // C294 (MP-11): a percent is bounded only by the field's min and max; 150 is a percent.
    expect(at('(2) percent: no default bounds'), [set.percentEdit.bound.value, set.percentEdit.bound.error], ['150', null]);
    expect(at('(2) percent: a right value is a decimal string'), set.percentEdit.ok, {value: '7.5', error: null});
    expect(at('(2) percent: not a number'), [set.percentEdit.notNumber.value, set.percentEdit.notNumber.error, set.percentEdit.notNumber.invalid],
      ['abc', ru_ ? 'Введите число' : 'Enter a number', true]);
    // The sign stands where the page's language writes it: «1 500,50 ₽», «₽1,500.50».
    expect(at('(2) money fixed RUB: the sign where the language writes it, no dropdown'), [nbsp(set.moneyFixed.shown), set.moneyFixed.end, set.moneyFixed.start, set.moneyFixed.dropdown],
      // C294: at rest the amount shows its groups and the currency's digits; en writes «RUB» before it.
      [ru_ ? '1 500,50' : '1,500.50', ru_ ? '₽' : null, ru_ ? null : 'RUB', false]);
    expect(at('(2) money: the currency\'s minor units'), [set.moneyFixed.minor.value, set.moneyFixed.minor.error],
      [{amount: '10.555', currency: 'RUB'}, ru_ ? 'Не больше 2 знаков после запятой' : 'At most 2 digits after the point']);
    expect(at('(2) money: groups and a comma read'), set.moneyFixed.ok, {value: {amount: '1500.5', currency: 'RUB'}, error: null});
    expect(at('(2) money fixed USD: the sign before where the language writes it'), [set.moneyUsd.start, set.moneyUsd.end], ru_ ? [null, '$'] : ['$', null]);
    expect(at('(2) money without a currency: a dropdown of currencies'), [set.moneyFree.dropdown, set.moneyFree.first, set.moneyFree.count, set.moneyFree.label],
      // C294 (MP-10): without the field's currencies, every ISO 4217 code the browser knows.
      [true, set.moneyFree.first, Math.max(set.moneyFree.count, 100), ru_ ? 'Валюта' : 'Currency']);
    expect(at('(2) money: an amount without a currency'), [set.moneyFree.noCurrency.value, set.moneyFree.noCurrency.error],
      [{amount: '100', currency: null}, ru_ ? 'Выберите валюту' : 'Choose a currency']);
    expect(at('(2) money: amount and currency on one row, one height, 8 apart'), [set.moneyFree.row?.sameTop, set.moneyFree.row?.sameHeight, set.moneyFree.row?.gap], [true, true, 8]);
    expect(at('(2) filter: the sign and the decimal keyboard'), set.filter.moneyStart === (ru_ ? null : '$') && set.filter.percentEnd === '%' && set.filter.keyboard === 'decimal', true);
    expect(at('(2) filter: the bound written as a decimal string'), set.filter.written, '12.5');

    const {accept, pending, refuse, decline, expired, sizeOne} = forms;
    expect(at('(3) open: Send and Cancel, money and percent drawn, size 1/2'), [accept[0].state, accept[0].fields, accept[0].submit, accept[0].cancel,
      accept[0].sizes.every((size) => size === '1/2'), accept[0].line],
    ['open', 3, ru_ ? 'Отправить' : 'Send', ru_ ? 'Отмена' : 'Cancel', true, '']);
    expect(at('(3) one ladder: the button and the field of 1/2 are one height'), accept[0].heights?.[0] === accept[0].heights?.[1], true);
    expect(at('(3) Send with a required field empty stays open, no answer'), [accept[1].state, accept[1].heard], ['open', 0]);
    expect(at('(3) accepted in the handler: the read view with «Sent», no Edit, no buttons'), [accept[3].state, accept[3].submit, accept[3].edit,
      accept[3].line, accept[3].glyph, accept[3].fields, accept[3].focusLine],
    ['accepted', null, false, ru_ ? 'Отправлено' : 'Sent', 'check_circle', 3, true]);
    expect(at('(3) the answer carries the values as decimal strings'), accept[3].last,
      {accepted: true, value: {company: 'Acme', budget: {amount: '1500000.5', currency: 'RUB'}, discount: '12.5'}});
    expect(at('(3) the read view prints them in the page language'), accept[3].views.map(nbsp),
      ['Acme', ru_ ? '1 500 000,50 ₽' : 'RUB 1,500,000.50', ru_ ? '12,5 %' : '12.5 %']);
    expect(at('(3) pending: locked, the pressed button waits, «Sending…»'), [pending[2].state, pending[2].inert, pending[2].loading, pending[2].line, pending[2].glyph],
      ['pending', true, true, ru_ ? 'Отправляем…' : 'Sending…', 'schedule']);
    expect(at('(3) set-errors reopens a pending answer'), [pending[3].state, pending[3].inert, pending[3].line], ['open', false, '']);
    expect(at('(3) a cancelled answer event leaves the form open'), [refuse[2].state, refuse[2].heard], ['open', 1]);
    expect(at('(3) declined draws nothing'), [decline[1].state, decline[1].fields, decline[1].submit, decline[1].line, decline[1].last],
      ['declined', 0, null, null, {accepted: false}]);
    expect(at('(3) expired: the line alone'), [expired[0].state, expired[0].fields, expired[0].submit, expired[0].line, expired[0].glyph],
      ['expired', 0, null, ru_ ? 'Время ответа истекло' : 'The time to answer has passed', 'timer_off']);
    expect(at('(3) size 1 writes no size'), sizeOne[0].sizes.every((size) => size === null || size === '1'), true);
    expect(at('no page errors'), errors, []);
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('FIELD_MONEY_PERCENT_C291_OK');
