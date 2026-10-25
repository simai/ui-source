#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-quantity (owner, 2026-10-25), measured on the built bytes, with the class
// component's script loaded beside it as a page has it:
// - the box is a spinbutton named by the label, with aria-valuenow, -min, -max
//   and -valuetext, described by the help or error; «−» and «+» are named
//   buttons out of the tab order, so Tab crosses one stop per field;
// - ArrowUp/ArrowDown step, PageUp/PageDown move ten steps, Home/End go to the
//   bounds; a stepper is disabled at its bound; each key and each click sends
//   input and change once, with the number in detail;
// - typing is strict: letters and a decimal mark in an integer field are
//   refused, a Russian page takes a comma, a value past the bound is clamped on
//   Enter, Escape takes typing back;
// - a held stepper repeats, with input per step and one change at the end;
// - the class binder does not bind the Smart field a second time (one click is
//   one step), the form submits the number with a point, a required empty field
//   holds the form, disabled and read-only do not step, the inherited value
//   shows and resets;
// - at 1000 and 390 wide each size draws exactly what the class markup draws
//   (box height, padding, steppers), and nothing overflows;
// - the size ladder: a field of each size is exactly as tall as sf-input of
//   that size (the control height), its steppers are icon buttons one rung
//   down, and the value's text stands on the same line as sf-input's (1px).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/quantity/css/quantity.css', 'smart/smart/quantity/css/quantity.css',
  'component/component/inputs/css/inputs.css', 'smart/smart/inputs/css/inputs.css',
  // The layout utilities the templates write (flex, flex-col, items-center…):
  // the Loader would bring them; this page adds the modules by hand.
  ...['display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'place-items']
    .map((name) => `utility/utility/${name}/default/css/default.css`)];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'component/component/quantity/js/quantity.js', 'smart/smart/quantity/js/quantity.js',
  'smart/smart/inputs/js/inputs.js'];
const failures = [];
const note = (detail) => failures.push(detail);

// The class markup the docs give, for the parity measure.
const classMarkup = (size) => `<label class="sf-quantity sf-quantity--size-${size} flex flex-col flex-nowrap justify-start" data-class-size="${size}">
  <span class="sf-quantity-label flex flex-row flex-nowrap justify-start items-start"><span class="sf-quantity-text">Класс</span></span>
  <span class="sf-quantity-wrap flex flex-row flex-nowrap justify-center items-center">
    <button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3 flex flex-row flex-nowrap justify-start items-center"><i class="sf-icon">remove</i></button>
    <input type="text" class="flex" value="3">
    <button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3 flex flex-row flex-nowrap justify-start items-center"><i class="sf-icon">add</i></button>
  </span>
</label>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const errors = [];
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px">
    <button id="before" type="button">До</button>
    <form id="form" style="display:grid;gap:24px;max-width:640px">
      <sf-quantity id="count" label="Количество" name="count" value="3" min="0" max="10" hint="От 0 до 10"></sf-quantity>
      <sf-quantity id="price" label="Цена" name="price" value="2567.5" min="0" step="0.5" precision="2"></sf-quantity>
      <sf-quantity id="need" label="Обязательно" name="need" required></sf-quantity>
      <sf-quantity id="err" label="С ошибкой" value="12" invalid error-message="Не больше 10"></sf-quantity>
      <sf-quantity id="ro" label="Только чтение" value="4" readonly></sf-quantity>
      <sf-quantity id="dis" label="Отключено" name="dis" value="4" disabled></sf-quantity>
      <sf-quantity id="inh" label="Наследуется" name="inh" inherited-value="5"></sf-quantity>
      <sf-quantity id="s-half" size="1/2" label="1/2" value="3"></sf-quantity>
      <sf-quantity id="s-one" size="1" label="1" value="3"></sf-quantity>
      <sf-quantity id="s-two" size="2" label="2" value="3"></sf-quantity>
    </form>
 <div id="beside" style="display:grid;grid-template-columns:minmax(0,1fr);gap:16px;max-width:640px;margin-top:24px">${['1/2', '1', '2'].map((size) => `<div style="display:flex;gap:16px;align-items:flex-start">
      <sf-quantity data-beside="${size}" size="${size}" label="Число" value="3" style="flex:1;min-width:0"></sf-quantity>
      <sf-input data-beside="${size}" size="${size}" label="Число" value="3" style="flex:1;min-width:0"></sf-input></div>`).join('')}</div>
    <div id="classes" style="display:grid;gap:24px;max-width:640px;margin-top:24px">${['1/2', '1', '2'].map(classMarkup).join('')}</div>
    <button id="after" type="button">После</button>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => note({case: `no sheet ${path}`}));
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-quantity') && customElements.get('sf-input'), null, {timeout: 8000});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__events = [];
    for (const type of ['input', 'change']) {
      document.addEventListener(type, (event) => {
        const host = event.target.closest?.('sf-quantity');
        if (!host) return;
        window.__events.push({type, id: host.id, target: event.target === host, value: event.detail?.value, source: event.detail?.source ?? null});
      });
    }
  });
  const events = () => page.evaluate(() => window.__events.splice(0));
  const said = (list, id) => list.filter((event) => event.id === id).map((event) => `${event.type}:${event.value}:${event.source}`).join(',');

  const state = (id) => page.evaluate((key) => {
    const host = document.getElementById(key);
    const input = host.querySelector('.sf-quantity-wrap input');
    const [minus, plus] = host.querySelectorAll('.sf-quantity-count');
    const labelledby = input.getAttribute('aria-labelledby');
    const describedby = input.getAttribute('aria-describedby');
    return {
      value: host.value, text: input.value, role: input.getAttribute('role'),
      name: labelledby ? document.getElementById(labelledby)?.textContent.trim() : input.getAttribute('aria-label'),
      description: describedby ? document.getElementById(describedby)?.textContent.trim() : null,
      now: input.getAttribute('aria-valuenow'), min: input.getAttribute('aria-valuemin'), max: input.getAttribute('aria-valuemax'),
      valuetext: input.getAttribute('aria-valuetext'), invalid: input.getAttribute('aria-invalid'),
      minus: {name: minus.getAttribute('aria-label'), disabled: minus.disabled, tab: minus.tabIndex, controls: minus.getAttribute('aria-controls') === input.id},
      plus: {name: plus.getAttribute('aria-label'), disabled: plus.disabled, tab: plus.tabIndex},
      hidden: host.querySelector('.sf-quantity-value')?.value ?? null,
      placeholder: input.placeholder, inherited: host.getAttribute('data-inherited'),
      reset: (() => { const reset = host.querySelector('[data-inherited-reset]'); return reset ? !reset.hidden : null; })(),
      focused: document.activeElement === input,
      classBound: host.querySelector('.sf-quantity').dataset.sfQuantityBound ?? null,
    };
  }, id);

  // Names, roles, numbers and descriptions.
  const count = await state('count');
  if (count.role !== 'spinbutton' || count.name !== 'Количество' || count.description !== 'От 0 до 10' || count.now !== '3' || count.min !== '0'
    || count.max !== '10' || count.valuetext !== '3' || count.text !== '3' || count.minus.name !== 'Уменьшить значение'
    || count.plus.name !== 'Увеличить значение' || count.minus.tab !== -1 || count.plus.tab !== -1 || !count.minus.controls
    || count.hidden !== '3' || count.classBound !== null) note({case: 'spinbutton names and numbers', got: count});
  const price = await state('price');
  if (price.text !== '2 567,50' || price.valuetext !== '2 567,50' || price.hidden !== '2567.50' || price.value !== 2567.5) note({case: 'a Russian page writes 2 567,50 and submits 2567.50', got: price});
  const err = await state('err');
  if (err.invalid !== 'true' || err.description !== 'Не больше 10') note({case: 'error state', got: err});
  if (await page.evaluate(() => document.getElementById('form').checkValidity())) note({case: 'a required, empty field keeps the form from submitting'});
  const formData = await page.evaluate(() => Object.fromEntries(new FormData(document.getElementById('form'))));
  if (formData.count !== '3' || formData.price !== '2567.50' || 'dis' in formData || formData.inh !== '') note({case: 'form data', got: formData});

  // Tab: one stop per field; the steppers are not stops.
  await page.focus('#before');
  const order = [];
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const element = document.activeElement;
      const host = element?.closest?.('sf-quantity');
      return host ? `${host.id}:${element.getAttribute('role') ?? element.tagName.toLowerCase()}` : element?.id;
    }));
  }
  if (order.join(',') !== 'count:spinbutton,price:spinbutton,need:spinbutton') note({case: 'tab order', got: order});

  // The keys.
  await page.focus('#count .sf-quantity-wrap input');
  await events();
  const keyCase = async (key, expected, expectedEvents) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
    const got = await state('count');
    const list = said(await events(), 'count');
    if (got.value !== expected || got.now !== String(expected) || list !== expectedEvents) note({case: `key ${key}`, got: {value: got.value, now: got.now, list}, expected: {value: expected, list: expectedEvents}});
    return got;
  };
  await keyCase('ArrowUp', 4, 'input:4:keyboard,change:4:keyboard');
  await keyCase('ArrowDown', 3, 'input:3:keyboard,change:3:keyboard');
  const paged = await keyCase('PageUp', 10, 'input:10:keyboard,change:10:keyboard');
  if (!paged.plus.disabled || paged.minus.disabled) note({case: '«+» is disabled at the max', got: paged});
  await keyCase('ArrowUp', 10, '');
  await keyCase('Home', 0, 'input:0:keyboard,change:0:keyboard');
  const atMin = await state('count');
  if (!atMin.minus.disabled || atMin.plus.disabled) note({case: '«−» is disabled at the min', got: atMin});
  await keyCase('End', 10, 'input:10:keyboard,change:10:keyboard');
  await keyCase('PageDown', 0, 'input:0:keyboard,change:0:keyboard');

  // Typing: strict, clamped on Enter, Escape takes it back.
  await page.fill('#count .sf-quantity-wrap input', '');
  await events();
  await page.keyboard.type('7a,5');
  const typed = await state('count');
  const typeEvents = said(await events(), 'count');
  if (typed.text !== '75' || typed.value !== 75) note({case: 'a letter and a decimal mark are refused in an integer field', got: typed});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  const clamped = await state('count');
  const clampEvents = said(await events(), 'count');
  if (clamped.value !== 10 || clamped.text !== '10' || clampEvents !== 'input:10:commit,change:10:commit' || !typeEvents.startsWith('input:7:typing')) note({case: 'typed 75 past max 10 is clamped on Enter', got: {clamped, typeEvents, clampEvents}});
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('4');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  const escaped = await state('count');
  await events();
  if (escaped.value !== 10 || escaped.text !== '10') note({case: 'Escape takes typing back', got: escaped});
  await page.focus('#price .sf-quantity-wrap input');
  await page.fill('#price .sf-quantity-wrap input', '');
  await page.keyboard.type('12,345');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(80);
  const decimal = await state('price');
  const decimalEvents = (await events()).filter((event) => event.id === 'price' && event.type === 'change').map((event) => event.value);
  if (decimal.value !== 12.35 && decimal.value !== 12.34) note({case: 'a comma is the decimal mark, rounded to two digits on leaving', got: decimal});
  if (decimal.hidden !== decimal.value.toFixed(2) || decimalEvents.length !== 1) note({case: 'one change on leaving, the form gets a point', got: {decimal, decimalEvents}});
  // A paste of text that is not a number is refused whole.
  const pasted = await page.evaluate(() => {
    const input = document.querySelector('#count .sf-quantity-wrap input');
    input.focus();
    input.select();
    const data = new DataTransfer();
    data.setData('text', '12 apples');
    const event = new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true});
    input.dispatchEvent(event);
    return event.defaultPrevented;
  });
  if (!pasted) note({case: 'a paste that is not a number is refused'});

  // The steppers: one click is one step (the class binder does not bind it
  // too), focus stays in the box, input and change once each.
  await page.evaluate(() => document.getElementById('count').setValue(5));
  await page.focus('#count .sf-quantity-wrap input');
  await events();
  await page.click('#count .sf-quantity-count:last-of-type');
  await page.waitForTimeout(80);
  const clicked = await state('count');
  const clickEvents = said(await events(), 'count');
  if (clicked.value !== 6 || clickEvents !== 'input:6:button,change:6:button' || !clicked.focused) note({case: 'one click, one step, focus kept', got: {clicked, clickEvents}});
  // A screen reader's activation (a click with no pointer) steps too.
  await page.evaluate(() => document.querySelector('#count .sf-quantity-count').click());
  await page.waitForTimeout(80);
  const activated = await state('count');
  if (activated.value !== 5 || said(await events(), 'count') !== 'input:5:button,change:5:button') note({case: 'activation without a pointer steps', got: activated});

  // Held: repeats, one change when released, stops at the bound.
  const plus = await page.$('#count .sf-quantity-count:last-of-type');
  const box = await plus.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const held = await state('count');
  const holdEvents = (await events()).filter((event) => event.id === 'count');
  const holdInputs = holdEvents.filter((event) => event.type === 'input').length;
  const holdChanges = holdEvents.filter((event) => event.type === 'change');
  if (held.value < 7 || holdInputs !== held.value - 5 || holdChanges.length !== 1 || holdChanges[0].value !== held.value) note({case: 'a held stepper repeats, one change at the end', got: {held: held.value, holdInputs, holdChanges}});
  // From further down, held well past the time the bound takes to reach.
  await page.evaluate(() => document.getElementById('count').setValue(2));
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const toMax = await state('count');
  const maxChanges = (await events()).filter((event) => event.id === 'count' && event.type === 'change').length;
  if (toMax.value !== 10 || !toMax.plus.disabled || maxChanges !== 1) note({case: 'a hold stops at the bound', got: {toMax, maxChanges}});

  // Disabled and read-only do not step.
  for (const id of ['ro', 'dis']) {
    await page.evaluate((key) => document.querySelector(`#${key} .sf-quantity-wrap input`).focus(), id);
    await page.keyboard.press('ArrowUp');
    await page.evaluate((key) => document.querySelectorAll(`#${key} .sf-quantity-count`)[1].click(), id);
    const after = await state(id);
    if (after.value !== 4 || !after.plus.disabled || !after.minus.disabled) note({case: `${id} does not step`, got: after});
  }
  if ((await events()).length) note({case: 'disabled and read-only send nothing'});

  // The inherited value: shown, then a value of its own, then reset.
  const inherited = await state('inh');
  if (inherited.placeholder !== '5' || inherited.inherited !== 'true' || inherited.reset !== false || inherited.value !== null) note({case: 'inherited value shows', got: inherited});
  await page.focus('#inh .sf-quantity-wrap input');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(80);
  const own = await state('inh');
  if (own.inherited !== null || own.reset !== true || own.value !== 1) note({case: 'a value of its own shows the reset', got: own});
  await events();
  await page.evaluate(() => document.querySelector('#inh [data-inherited-reset]').click());
  await page.waitForTimeout(150);
  const reset = await state('inh');
  const resetEvents = said(await events(), 'inh');
  if (reset.value !== null || reset.inherited !== 'true' || resetEvents !== 'input:null:reset,change:null:reset' || !reset.focused) note({case: 'reset to inherited', got: {reset, resetEvents}});

  // A form reset puts the attribute's value back, without events.
  await page.evaluate(() => document.getElementById('form').reset());
  await page.waitForTimeout(150);
  const afterReset = await state('count');
  if (afterReset.value !== 3 || afterReset.text !== '3' || (await events()).length) note({case: 'form reset', got: afterReset});

  // Sizes: each draws what the class markup of its size draws, at 1000 and 390.
  const geometry = () => page.evaluate(() => {
    const round = (value) => Math.round(value * 100) / 100;
    const measure = (root) => {
      const wrap = root.querySelector('.sf-quantity-wrap');
      const style = getComputedStyle(wrap);
      const button = root.querySelector('.sf-quantity-count').getBoundingClientRect();
      const input = getComputedStyle(root.querySelector('.sf-quantity-wrap input'));
      return {height: round(wrap.getBoundingClientRect().height), padTop: style.paddingTop, padStart: style.paddingInlineStart,
        gap: style.columnGap, radius: style.borderTopLeftRadius, button: round(button.height), buttonWidth: round(button.width),
        font: input.fontSize, overflow: wrap.scrollWidth > wrap.clientWidth || wrap.getBoundingClientRect().right > document.documentElement.clientWidth};
    };
    const sizes = {'1/2': 's-half', 1: 's-one', 2: 's-two'};
    return {
      smart: Object.fromEntries(Object.entries(sizes).map(([size, id]) => [size, measure(document.querySelector(`#${id} .sf-quantity`))])),
      class: Object.fromEntries(Object.keys(sizes).map((size) => [size, measure(document.querySelector(`[data-class-size="${size}"]`))])),
      // Beside sf-input of the same size, tops aligned: the box heights, the
      // value's text line (the input's line box, as tall as its line height,
      // centred in the field) from the top of the field, and the ladder's
      // control heights the steppers must equal one rung down.
      ladder: Object.fromEntries(Object.keys(sizes).map((size) => {
        const quantity = document.querySelector(`sf-quantity[data-beside="${size}"]`);
        const input = document.querySelector(`sf-input[data-beside="${size}"]`);
        const line = (field, box) => {
          const rect = box.getBoundingClientRect();
          const height = parseFloat(getComputedStyle(box).lineHeight);
          return round(rect.top + (rect.height - height) / 2 + height - field.getBoundingClientRect().top);
        };
        const control = (rung) => {
          const probe = document.createElement('div');
          probe.style.blockSize = `var(--sf-ui-${rung.replace('/', '\\/')}--control-height)`;
          document.body.append(probe);
          const value = round(probe.getBoundingClientRect().height);
          probe.remove();
          return value;
        };
        const down = {'1/2': '1/3', 1: '1/2', 2: '1'}[size];
        const qWrap = quantity.querySelector('.sf-quantity-wrap');
        const iField = input.querySelector('.sf-input-field');
        const stepper = quantity.querySelector('.sf-quantity-count').getBoundingClientRect();
        const wrapRect = qWrap.getBoundingClientRect();
        return [size, {
          quantity: round(wrapRect.height), input: round(iField.getBoundingClientRect().height), control: control(String(size)),
          quantityLine: line(qWrap, qWrap.querySelector('input')), inputLine: line(iField, iField.querySelector('input')),
          fieldTop: round(wrapRect.top - iField.getBoundingClientRect().top),
          stepper: round(stepper.height), stepperWidth: round(stepper.width), stepperControl: control(down),
          stepperGapTop: round(stepper.top - wrapRect.top), stepperGapStart: round(stepper.left - wrapRect.left),
        }];
      })),
      scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  const measured = {};
  for (const width of [1000, 390]) {
    await page.setViewportSize({width, height: 900});
    await page.waitForTimeout(300);
    const got = await geometry();
    measured[width] = got;
    for (const size of ['1/2', '1', '2']) {
      const smart = got.smart[size];
      const drawn = got.class[size];
      for (const key of ['height', 'padTop', 'padStart', 'gap', 'radius', 'button', 'buttonWidth', 'font']) {
        if (smart[key] !== drawn[key]) note({case: `${width}: size ${size} ${key} differs from the class markup`, got: smart[key], expected: drawn[key]});
      }
      if (smart.overflow) note({case: `${width}: size ${size} overflows`});
    }
    for (const size of ['1/2', '1', '2']) {
      const rung = got.ladder[size];
      if (rung.quantity !== rung.input || rung.quantity !== rung.control) note({case: `${width}: size ${size} is as tall as sf-input and the control height`, got: rung});
      if (Math.abs(rung.quantityLine - rung.inputLine) > 1) note({case: `${width}: size ${size} value text stands on sf-input's line`, got: rung});
      if (rung.stepper !== rung.stepperControl || rung.stepperWidth !== rung.stepperControl) note({case: `${width}: size ${size} steppers are one rung down`, got: rung});
      if (Math.abs(rung.stepperGapTop - rung.stepperGapStart) > 0.5) note({case: `${width}: size ${size} steppers stand as far from the top as from the start`, got: rung});
    }
    if (!(got.smart['1/2'].height < got.smart['1'].height && got.smart['1'].height < got.smart['2'].height)) note({case: `${width}: the sizes climb the ladder`, got: got.smart});
    if (got.scroll) note({case: `${width}: the page scrolls sideways`});
  }
  if (errors.length) note({case: 'page errors', got: errors});
  console.log(JSON.stringify({count, price, order, held: held.value, measured}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('QUANTITY_SMART_OK');
