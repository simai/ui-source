#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [result.json]
// The inherited sentence in the accessibility tree, on the built bytes, read
// through the Chrome DevTools Protocol (Accessibility.getPartialAXTree): the
// name and the description a screen reader is given for each field's control.
//
// A browser reads aria-describedby instead of aria-description, so a field
// that had a hint and an inherited value said the hint and dropped
// «Наследуется: …». The family's helper (helpers/inherited-value.js,
// syncInheritedNote) names a hidden note with the sentence after the hint.
// For sf-input (text and numeric), sf-input-textarea, sf-input-quantity and
// sf-switch, each in four states:
//   hint      -- a hint, no inherited value: the description is the hint;
//   inherited -- an inherited value, no hint: the description is the sentence;
//   both      -- a hint and an inherited value: the hint, then the sentence;
//   own       -- a hint, an inherited value and a value of its own: the hint
//                alone, and no note is left in the element;
// plus an error in place of the hint (sf-input), sf-dropdown inherited (its
// button is described by its summary, so the sentence follows the summary) and
// sf-input-color inherited (nothing else describes it: aria-description alone). The name is the label in
// every state. After a reset from «own», the sentence comes back after the
// hint. No page errors.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const report = process.argv[3] || '';
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/textarea/css/textarea.css',
  'component/component/dropdown/css/dropdown.css', 'component/component/switch/css/switch.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/icons/css/icons.css',
  'component/component/quantity/css/quantity.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/list-item/js/list-item.js',
  'smart/smart/input/js/input.js', 'smart/smart/input-textarea/js/input-textarea.js', 'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/input-color/js/input-color.js', 'smart/smart/switch/js/switch.js', 'smart/smart/input-quantity/js/input-quantity.js'];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const origin = 'http://probe.test';
const HINT = 'Подсказка поля';
const ERROR = 'Ошибка поля';
// tag, attributes of the hint, the inherited value as it is read, the control.
const FIELDS = {
  text: {tag: 'sf-input', label: 'Сайт', hint: `hint="${HINT}"`, inherited: 'https://brand.example', own: 'value="https://own.example"', control: 'input'},
  number: {tag: 'sf-input', extra: 'inputmode="numeric"', label: 'Количество', hint: `hint="${HINT}"`, inherited: '12', own: 'value="7"', control: 'input'},
  area: {tag: 'sf-input-textarea', label: 'Подпись', hint: `hint="${HINT}"`, inherited: 'Команда бренда', own: 'value="Своя подпись"', control: 'textarea'},
  quantity: {tag: 'sf-input-quantity', label: 'Штук', hint: `hint="${HINT}"`, inherited: '3', own: 'value="5"', control: 'input'},
  toggle: {tag: 'sf-switch', extra: 'value="yes"', label: 'Уведомления', hint: `description="${HINT}"`, inherited: 'true', said: 'включено', own: 'checked', control: 'input[type="checkbox"]'},
};
const STATES = ['hint', 'inherited', 'both', 'own'];
const host = (id, field, state) => {
  const parts = [`id="${id}-${state}"`, `label="${field.label}"`, field.extra || ''];
  if (state !== 'inherited') parts.push(field.hint);
  if (state !== 'hint') parts.push(`inherited-value="${field.inherited}"`);
  if (state === 'own') parts.push(field.own);
  return `<${field.tag} ${parts.join(' ')}></${field.tag}>`;
};
const markup = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head>
<body style="margin:16px"><form id="form" style="display:flex;flex-direction:column;gap:12px;max-inline-size:480px">
${Object.entries(FIELDS).flatMap(([id, field]) => STATES.map((state) => host(id, field, state))).join('\n')}
  <sf-input id="error-both" label="Сайт" invalid error-message="${ERROR}" hint="${HINT}" inherited-value="https://brand.example"></sf-input>
  <sf-dropdown id="select-inherited" name="city" label="Город" inherited-value="moscow" portal="false"></sf-dropdown>
  <sf-input-color id="color-inherited" name="brand" label="Цвет" inherited-value="#336699"></sf-input-color>
</form></body></html>`;

const CONTROLS = {
  ...Object.fromEntries(Object.entries(FIELDS).flatMap(([id, field]) => STATES.map((state) => [`${id}-${state}`, `#${id}-${state} ${field.control}`]))),
  'error-both': '#error-both input',
  'select-inherited': '#select-inherited .sf-dropdown-field > button',
  'color-inherited': '#color-inherited .sf-color-input',
};
const said = (value) => `Наследуется: ${value}`;
const expected = {};
for (const [id, field] of Object.entries(FIELDS)) {
  const sentence = said(field.said || field.inherited);
  expected[`${id}-hint`] = {name: field.label, description: HINT};
  expected[`${id}-inherited`] = {name: field.label, description: sentence};
  expected[`${id}-both`] = {name: field.label, description: `${HINT} ${sentence}`};
  expected[`${id}-own`] = {name: field.label, description: HINT, note: false};
}
expected['error-both'] = {name: 'Сайт', description: `${ERROR} ${said('https://brand.example')}`};
// sf-dropdown's button is described by its summary (the shown option), so it
// too needs the note: the summary, then the sentence.
expected['select-inherited'] = {name: 'Город', description: `Москва ${said('Москва')}`, nameStartsWith: true};
expected['color-inherited'] = {name: 'Цвет', description: said('#336699')};

const failures = [];
const results = {};
const check = (name, pass, detail = {}) => { results[name] = pass; if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 2400}});
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    const path = join(out, url.pathname);
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await page.goto(`${origin}/`);
  await page.setContent(markup);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
  await page.evaluate(() => {
    document.getElementById('select-inherited').options = [{value: 'kazan', text: 'Казань'}, {value: 'moscow', text: 'Москва'}];
  });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction((controls) => Object.values(controls).every((selector) => document.querySelector(selector)), CONTROLS, {timeout: 15000});
  await page.waitForFunction(() => [...document.querySelectorAll('[inherited-value]')]
    .filter((node) => !node.id.endsWith('-own')).every((node) => node.getAttribute('data-inherited') === 'true'), null, {timeout: 10000});
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 80)))));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const tree = async () => {
    const {root} = await cdp.send('DOM.getDocument', {depth: 0});
    const seen = {};
    for (const [id, selector] of Object.entries(CONTROLS)) {
      const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector});
      const {nodes} = await cdp.send('Accessibility.getPartialAXTree', {nodeId, fetchRelatives: false});
      const node = nodes.find((one) => !one.ignored) || nodes[0];
      seen[id] = {role: node?.role?.value, name: node?.name?.value ?? '', description: node?.description?.value ?? ''};
    }
    const notes = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, document.getElementById(id)?.querySelectorAll(':scope > [data-sf-inherited-note]').length ?? 0])), Object.keys(CONTROLS));
    for (const id of Object.keys(seen)) seen[id].notes = notes[id];
    return seen;
  };

  const before = await tree();
  for (const [id, want] of Object.entries(expected)) {
    const got = before[id];
    const name = want.nameStartsWith ? got.name.startsWith(want.name) : got.name === want.name;
    check(`${id}: name is the label`, name, {got: got.name, want: want.name});
    check(`${id}: description`, got.description === want.description, {got: got.description, want: want.description});
    if (want.note === false) check(`${id}: no note left`, got.notes === 0, {notes: got.notes});
  }
  for (const id of Object.keys(FIELDS)) {
    check(`${id}-both: one note`, before[`${id}-both`].notes === 1, {notes: before[`${id}-both`].notes});
    check(`${id}-inherited: no note without a hint (aria-description alone)`, before[`${id}-inherited`].notes === 0, {notes: before[`${id}-inherited`].notes});
  }

  // A reset from «own» brings the sentence back after the hint; a value typed
  // again takes it away.
  await page.evaluate((ids) => { for (const id of ids) document.getElementById(`${id}-own`).resetToInherited(); }, Object.keys(FIELDS));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 80)))));
  const reset = await tree();
  for (const [id, field] of Object.entries(FIELDS)) {
    const want = `${HINT} ${said(field.said || field.inherited)}`;
    check(`${id}-own after reset: the hint, then the sentence`, reset[`${id}-own`].description === want, {got: reset[`${id}-own`].description, want});
    check(`${id}-own after reset: name unchanged`, reset[`${id}-own`].name === field.label, {got: reset[`${id}-own`].name});
  }
  await page.locator('#text-own input').fill('https://again.example');
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 80))));
  const typed = await tree();
  check('text-own typed again: the hint alone, no note', typed['text-own'].description === HINT && typed['text-own'].notes === 0, typed['text-own']);

  if (report) writeFileSync(report, `${JSON.stringify({before, reset, typed, results, failures}, null, 2)}\n`);
} finally {
  await browser.close();
}

const total = Object.keys(results).length;
const passed = Object.values(results).filter(Boolean).length;
if (failures.length) {
  console.error(`inherited-description: ${passed}/${total}`);
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exit(1);
}
console.log(`inherited-description: ${passed}/${total} OK`);
