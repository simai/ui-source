#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The inherited-value state of the input family (simai/ui-source#28), on the
// built bytes with core.css and the field sheets, UTF-8, at 1000px and 390px.
// For sf-input (text and numeric), sf-textarea, sf-dropdown, sf-color and
// sf-switch:
// - display: while the field holds nothing of its own, the host says
//   data-inherited, the «наследуется» marker shows and the reset does not, the
//   text fields show the inherited value as their placeholder (a dropdown, its
//   option's label), the form value is empty, and the control carries the
//   inherited value as aria-description;
// - a value of its own (typed, picked, flipped) swaps the marker for the reset,
//   names the reset «Сбросить к наследуемому», drops the description and
//   reaches the form;
// - reset, from the keyboard: Enter on the reset fires sf-field:reset once with
//   {value, inheritedValue, name}, then the control's ordinary change; the field
//   is empty, inherited again, and focus is back on the control;
// - a host that calls preventDefault on sf-field:reset keeps the value;
// - geometry: in sf-input and sf-dropdown at 1/2, 1 and 2 the reset is the
//   control height of one step down, stands with the same gap above, below and
//   after it, and the field keeps the height of the same field without the
//   state; the marker is one text step down; nothing leaves the field and the
//   page does not scroll sideways.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/textarea/css/textarea.css',
  'component/component/dropdown/css/dropdown.css', 'component/component/switch/css/switch.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/icons/css/icons.css',
  'smart/smart/input/css/input.css', 'smart/smart/textarea/css/textarea.css', 'smart/smart/dropdown/css/dropdown.css',
  'smart/smart/color/css/color.css', 'smart/smart/switch/css/switch.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/icon-button/js/icon-button.js', 'smart/smart/list-item/js/list-item.js',
  'smart/smart/input/js/input.js', 'smart/smart/textarea/js/textarea.js', 'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/color/js/color.js', 'smart/smart/switch/js/switch.js'];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const origin = 'http://probe.test';
const CITIES = JSON.stringify([{value: 'kazan', text: 'Казань'}, {value: 'moscow', text: 'Москва'}]);

const markup = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head>
<body style="margin:16px"><form id="form" style="display:flex;flex-direction:column;gap:16px;max-inline-size:480px">
  <sf-input id="text" name="site" label="Сайт" inherited-value="https://brand.example"></sf-input>
  <sf-input id="number" name="count" label="Количество" inputmode="numeric" inherited-value="12"></sf-input>
  <sf-textarea id="area" name="sign" label="Подпись" inherited-value="Команда бренда"></sf-textarea>
  <sf-dropdown id="select" name="city" label="Город" inherited-value="moscow" portal="false"></sf-dropdown>
  <sf-color id="color" name="brand" label="Цвет" inherited-value="#336699"></sf-color>
  <sf-switch id="toggle" name="notify" value="yes" label="Уведомления" inherited-value="true"></sf-switch>
  ${['1/2', '1', '2'].map((size) => `
  <sf-input id="input-${size.replace('/', '-')}" size="${size}" label="Поле" inherited-value="По умолчанию" value="Своё"></sf-input>
  <sf-input id="plain-${size.replace('/', '-')}" size="${size}" label="Поле" value="Своё"></sf-input>
  <sf-dropdown id="dropdown-${size.replace('/', '-')}" size="${size}" label="Город" inherited-value="moscow" value="kazan" portal="false"></sf-dropdown>
  <sf-dropdown id="dropdown-plain-${size.replace('/', '-')}" size="${size}" label="Город" value="kazan" portal="false"></sf-dropdown>`).join('')}
</form></body></html>`;

const browser = await chromium.launch();
try {
  for (const width of [1000, 390]) {
    const page = await browser.newPage({viewport: {width, height: 1400}});
    await page.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
      const path = join(out, url.pathname);
      return existsSync(path)
        ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
        : route.fulfill({status: 404, body: ''});
    });
    page.on('pageerror', (error) => failures.push({name: `${width}: page error`, said: error.message}));
    const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 40)))));

    await page.goto(`${origin}/`);
    await page.setContent(markup);
    for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
    await page.evaluate((cities) => {
      for (const node of document.querySelectorAll('sf-dropdown')) node.options = JSON.parse(cities);
    }, CITIES);
    for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
    await page.waitForFunction(() => ['sf-input', 'sf-textarea', 'sf-dropdown', 'sf-color', 'sf-switch']
      .every((tag) => customElements.get(tag)) && document.querySelector('#toggle .sf-switch')
      && document.querySelector('#select .sf-dropdown-field') && document.querySelector('#color .sf-color'), null, {timeout: 10000});
    await page.evaluate(() => document.fonts.ready);
    await settle();

    // The control each host names, focuses and describes.
    const CONTROL = {
      text: '#text input', number: '#number input', area: '#area textarea',
      select: '#select .sf-dropdown-field > button', color: '#color .sf-color-input', toggle: '#toggle input[type="checkbox"]',
    };
    const NAMES = {text: 'site', number: 'count', area: 'sign', select: 'city', color: 'brand', toggle: 'notify'};
    const read = () => page.evaluate(({CONTROL, NAMES}) => {
      const form = new FormData(document.getElementById('form'));
      return Object.fromEntries(Object.entries(CONTROL).map(([id, selector]) => {
        const host = document.getElementById(id);
        const control = document.querySelector(selector);
        const marker = host.querySelector('[data-inherited-marker]');
        const reset = host.querySelector('[data-inherited-reset]');
        const visible = (node) => Boolean(node) && !node.hidden && node.getClientRects().length > 0;
        return [id, {
          inherited: host.getAttribute('data-inherited'),
          marker: visible(marker) ? marker.textContent.trim() : null,
          markerHidden: marker?.getAttribute('aria-hidden'),
          reset: visible(reset) ? reset.getAttribute('aria-label') : null,
          resetTag: reset?.tagName,
          placeholder: control?.getAttribute('placeholder') ?? host.querySelector('.sf-dropdown-field input:not([type="hidden"])')?.getAttribute('placeholder') ?? null,
          shown: host.querySelector('.sf-dropdown-field input:not([type="hidden"])')?.value ?? null,
          described: control?.getAttribute('aria-description') ?? null,
          form: form.has(NAMES[id]) ? form.get(NAMES[id]) : null,
          checked: control?.type === 'checkbox' ? control.checked : null,
        }];
      }));
    }, {CONTROL, NAMES});

    const initial = await read();
    const expectedShown = {text: 'https://brand.example', number: '12', area: 'Команда бренда', select: 'Москва'};
    const expectedDescribed = {text: 'https://brand.example', number: '12', area: 'Команда бренда', select: 'Москва', color: '#336699', toggle: 'включено'};
    for (const [id, state] of Object.entries(initial)) {
      check(`${width} ${id}: inherited on the host`, state.inherited === 'true', state);
      check(`${width} ${id}: the marker says «наследуется», hidden from the reader`, state.marker === 'наследуется' && state.markerHidden === 'true', state);
      check(`${width} ${id}: no reset while inherited`, state.reset === null, state);
      check(`${width} ${id}: the control is described as inherited`, state.described === `Наследуется: ${expectedDescribed[id]}`, state);
      check(`${width} ${id}: the form value is empty`, state.form === null || state.form === '', state);
      if (expectedShown[id]) check(`${width} ${id}: the inherited value is the placeholder`, state.placeholder === expectedShown[id], state);
    }
    check(`${width} select: the inherited label is not drawn as a choice`, initial.select.shown === '', initial.select);
    check(`${width} toggle: the knob stands where the inherited value puts it`, initial.toggle.checked === true, initial.toggle);

    // A value of its own, the way a person gives one.
    await page.locator('#text input').pressSequentially('https://mail.example');
    await page.locator('#number input').pressSequentially('7');
    await page.locator('#area textarea').pressSequentially('Своя подпись');
    await page.locator('#select .sf-dropdown-field').click();
    await settle();
    await page.locator('#select .sf-list-item[data-value="kazan"]').click();
    await page.evaluate(() => {
      const picker = document.querySelector('#color .sf-color-input');
      picker.value = '#aa0000';
      picker.dispatchEvent(new Event('input', {bubbles: true}));
      picker.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await page.locator('#toggle .sf-switch-inner').click();
    await settle();
    const own = await read();
    const expectedForm = {text: 'https://mail.example', number: '7', area: 'Своя подпись', select: 'kazan', color: '#aa0000', toggle: null};
    for (const [id, state] of Object.entries(own)) {
      check(`${width} ${id}: a value of its own is not inherited`, state.inherited === null, state);
      check(`${width} ${id}: the marker gives way to the reset`, state.marker === null && state.reset === 'Сбросить к наследуемому' && state.resetTag === 'BUTTON', state);
      check(`${width} ${id}: no inherited description on an own value`, state.described === null, state);
      check(`${width} ${id}: the form carries the own value`, state.form === expectedForm[id], state);
    }
    check(`${width} toggle: flipped off is a value of its own`, own.toggle.checked === false
      && await page.evaluate(() => document.getElementById('toggle').getAttribute('checked')) === 'false', own.toggle);

    // A host that refuses the reset keeps the value.
    const refused = await page.evaluate(() => {
      const host = document.getElementById('text');
      const refuse = (event) => event.preventDefault();
      host.addEventListener('sf-field:reset', refuse);
      host.querySelector('[data-inherited-reset]').click();
      host.removeEventListener('sf-field:reset', refuse);
      return {value: host.value, inherited: host.getAttribute('data-inherited')};
    });
    check(`${width}: preventDefault on sf-field:reset keeps the value`, refused.value === 'https://mail.example' && refused.inherited === null, refused);

    // Reset from the keyboard, each control in turn.
    const OWN = {text: 'https://mail.example', number: '7', area: 'Своя подпись', select: 'kazan', color: '#aa0000', toggle: 'off'};
    const INHERITED = {text: 'https://brand.example', number: '12', area: 'Команда бренда', select: 'moscow', color: '#336699', toggle: 'true'};
    for (const id of Object.keys(CONTROL)) {
      await page.evaluate((id) => {
        const host = document.getElementById(id);
        window.__said = [];
        host.addEventListener('sf-field:reset', (event) => window.__said.push(['sf-field:reset', event.detail, event.cancelable]), {once: true});
        host.addEventListener('change', () => window.__said.push(['change']), {once: true});
        host.querySelector('[data-inherited-reset]').focus();
      }, id);
      const focusedReset = await page.evaluate(() => document.activeElement?.hasAttribute?.('data-inherited-reset'));
      check(`${width} ${id}: the reset is reached by focus`, focusedReset);
      await page.keyboard.press('Enter');
      await settle();
      const after = await page.evaluate(({id, selector}) => ({
        said: window.__said,
        focus: document.activeElement === document.querySelector(selector),
        value: document.getElementById(id).value,
      }), {id, selector: CONTROL[id]});
      const [first, second] = after.said;
      check(`${width} ${id}: sf-field:reset first, cancellable, with the detail`, first?.[0] === 'sf-field:reset' && first?.[2] === true
        && first?.[1]?.value === OWN[id] && first?.[1]?.inheritedValue === INHERITED[id] && first?.[1]?.name === NAMES[id], after);
      check(`${width} ${id}: then the control's change`, second?.[0] === 'change' && after.said.length === 2, after);
      check(`${width} ${id}: focus is back on the control`, after.focus, after);
    }
    const reset = await read();
    for (const [id, state] of Object.entries(reset)) {
      check(`${width} ${id}: inherited again after the reset`, state.inherited === 'true' && state.marker === 'наследуется' && state.reset === null
        && state.described === `Наследуется: ${expectedDescribed[id]}` && (state.form === null || state.form === ''), state);
    }
    check(`${width} toggle: back to the inherited knob, no checked attribute`, reset.toggle.checked === true
      && await page.evaluate(() => !document.getElementById('toggle').hasAttribute('checked')), reset.toggle);

    // Geometry on the ladder.
    const geometry = await page.evaluate(() => {
      const STEP = {'1/2': '1/3', '1': '1/2', '2': '1'};
      const probe = document.createElement('div');
      document.body.append(probe);
      const length = (name) => { probe.style.blockSize = `var(${name})`; return probe.getBoundingClientRect().height; };
      const text = (name) => { probe.style.fontSize = `var(${name})`; return parseFloat(getComputedStyle(probe).fontSize); };
      const rows = [];
      for (const kind of ['input', 'dropdown']) {
        for (const size of ['1/2', '1', '2']) {
          const key = size.replace('/', '-');
          const host = document.getElementById(`${kind}-${key}`);
          const plain = document.getElementById(`${kind === 'input' ? 'plain' : 'dropdown-plain'}-${key}`);
          const field = host.querySelector(kind === 'input' ? '.sf-input-field' : '.sf-dropdown-field');
          const plainField = plain.querySelector(kind === 'input' ? '.sf-input-field' : '.sf-dropdown-field');
          const button = host.querySelector('[data-inherited-reset]');
          const f = field.getBoundingClientRect();
          const b = button.getBoundingClientRect();
          const border = parseFloat(getComputedStyle(field).borderTopWidth);
          const chevron = kind === 'dropdown' ? host.querySelector('.sf-dropdown-field > button').getBoundingClientRect() : null;
          // The chevron's glyph keeps its axis: where it ends, from the field's
          // end, is what it is on the same dropdown without the state.
          const glyphEnd = (node) => node.querySelector('.sf-dropdown-field > button .sf-icon').getBoundingClientRect().right
            - node.querySelector('.sf-dropdown-field').getBoundingClientRect().right;
          rows.push({
            kind, size,
            field: f.height, plainField: plainField.getBoundingClientRect().height,
            button: b.height, buttonWidth: b.width, ladder: length(`--sf-ui-${STEP[size].replace('/', '\\/')}--control-height`),
            above: b.top - f.top - border, below: f.bottom - b.bottom - border,
            after: kind === 'input' ? f.right - b.right - border : null,
            clearOfChevron: chevron ? b.right <= chevron.left + 0.5 : true,
            inside: b.left >= f.left && b.right <= f.right + 0.5,
            glyph: kind === 'dropdown' ? [glyphEnd(host), glyphEnd(plain)] : null,
          });
        }
      }
      const marker = document.querySelector('#text [data-inherited-marker]');
      const markerSize = marker ? parseFloat(getComputedStyle(marker).fontSize) : null;
      const markerLadder = text('--sf-text-size-1\\/2');
      probe.remove();
      return {rows, markerSize, markerLadder, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth};
    });
    for (const row of geometry.rows) {
      const name = `${width} ${row.kind} ${row.size}`;
      check(`${name}: the reset is one step down the ladder`, Math.abs(row.button - row.ladder) < 0.5, row);
      check(`${name}: the field keeps its height`, Math.abs(row.field - row.plainField) < 0.5, row);
      check(`${name}: the same gap above and below`, Math.abs(row.above - row.below) < 0.75, row);
      if (row.after !== null) check(`${name}: the same gap after as above`, Math.abs(row.after - row.above) < 0.75, row);
      check(`${name}: the reset stays inside the field and clear of the chevron`, row.inside && row.clearOfChevron, row);
      if (row.glyph) check(`${name}: the chevron keeps its axis`, Math.abs(row.glyph[0] - row.glyph[1]) < 0.5, row);
    }
    check(`${width}: the marker is one text step down`, Math.abs(geometry.markerSize - geometry.markerLadder) < 0.5, geometry);
    check(`${width}: the page does not scroll sideways`, geometry.scroll <= 0, geometry);
    if (process.env.PROBE_SHOTS) await page.screenshot({path: join(process.env.PROBE_SHOTS, `inherited-${width}.png`), fullPage: true});
    console.log(JSON.stringify({width, initial: initial.text, rows: geometry.rows.map((row) => [row.kind, row.size, row.field, row.button, row.above, row.below, row.after])}));
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('INHERITED_VALUE_OK');
