#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Gate 20 of standard simai.smart-component 1.3.8 for the field family built
// from its component.json (group A: sf-toggle, sf-checkbox, sf-radio,
// sf-input, sf-textarea, sf-quantity, sf-code-input): each component's
// probe.json, in the format of ui-control stands/15-scenarios (the A2
// quantity probe), runs on the built bytes with the real Loader.
//
// A probe.json:
//   page    {lang, markup with {{field}}, listen: [event names], box: selector}
//   checks  [{id, covers, field, target?, given?: [steps], <trigger>, expect}]
// A step or trigger is one of
//   setting {name, value}  an attribute; true sets it empty, false removes it
//   property {name, value} a property of the element
//   action {name, with}    the kebab name called as the camelCase method
//   user                   one string or a list: type:<text>, keyboard:<Key>
//                          (pressed in the box), click:<selector in the element>
//   form                   submit (requestSubmit) or reset (form.reset())
// expect (all optional):
//   value                  the element's value property
//   host                   {attributes: {name: value | null}, props: {name: value}}
//   box                    {text, attributes} of page.box inside the element
//   formData               {name: value | null}: at the submit event for
//                          form: submit, else new FormData(form) at the end
//   formNames              the names FormData holds, in order
//   submitted              whether requestSubmit reached the submit event
//   checkValidity          form.checkValidity()
//   validity               {flag: bool} of the element's own validity
//   events                 the exact ordered list of listened events on the
//                          element, each {type, ...a subset of its detail}
//   returns                what the action returned (element = the element)
//   disabled               {selector: bool} inside the element
//   focus                  a selector the focused element matches
//   journal                [{from, to, since, remove_after}]: SF.deprecations
//                          notes heard during the trigger
//   texts                  {selector: text} of parts inside the element
//   innerNames             the name attributes of the element's inner
//                          input/textarea/select, in order
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const FOLDERS = (process.env.SF_FIELDS || 'toggle,checkbox,radio,input,textarea,quantity,code-input').split(',').filter(Boolean);
const probes = FOLDERS.map((folder) => {
  const file = join(root, 'src', 'smart', folder, 'probe.json');
  const manifest = JSON.parse(readFileSync(join(root, 'src', 'smart', folder, 'component.json'), 'utf8'));
  return {folder, tag: manifest.tag, probe: JSON.parse(readFileSync(file, 'utf8'))};
});

let current = '';
const page = (probe, field) => `<!doctype html><html lang="${probe.page.lang || 'ru'}" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
${(probe.page.markup || '<form id="f">{{field}}<button type="submit">OK</button></form>').replace('{{field}}', field)}
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${['.js', '.css', '.json'].includes(extname(file)) ? '; charset=utf-8' : ''}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const failures = [];
const results = {};
const browser = await chromium.launch();

// Runs in the page: one step on the element.
async function step(tab, spec, {tag, target, box}) {
  let returns;
  if (spec.setting) {
    await tab.evaluate(({selector, name, value}) => {
      const el = document.querySelector(selector);
      if (value === true) el.setAttribute(name, '');
      else if (value === false || value === null) el.removeAttribute(name);
      else el.setAttribute(name, String(value));
    }, {selector: target, ...spec.setting});
  }
  if (spec.property) {
    await tab.evaluate(({selector, name, value}) => { document.querySelector(selector)[name] = value; }, {selector: target, ...spec.property});
  }
  if (spec.action) {
    returns = await tab.evaluate(async ({selector, name, args}) => {
      const el = document.querySelector(selector);
      const method = name.replace(/-([a-z])/gu, (_, c) => c.toUpperCase());
      if (typeof el[method] !== 'function') return `no method ${method}`;
      const result = await el[method](...args);
      return result === el ? 'element' : result;
    }, {selector: target, name: spec.action.name, args: spec.action.with === undefined ? [] : [spec.action.with]});
  }
  for (const user of [].concat(spec.user ?? [])) {
    const [kind, ...rest] = user.split(':');
    const arg = rest.join(':');
    const boxLocator = tab.locator(`${target} ${box}`).first();
    if (kind === 'type') { await boxLocator.focus(); await tab.keyboard.type(arg); }
    if (kind === 'keyboard') { if (!(await tab.evaluate((s) => document.querySelector(s)?.contains(document.activeElement), target))) await boxLocator.focus(); await tab.keyboard.press(arg); }
    if (kind === 'click') await tab.locator(`${target} ${arg}`).first().click();
    if (kind === 'tab') await tab.keyboard.press('Tab');
  }
  if (spec.form === 'submit') await tab.evaluate(() => { document.getElementById('f').requestSubmit(); });
  if (spec.form === 'reset') await tab.evaluate(() => document.getElementById('f').reset());
  await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 80)))));
  return returns;
}

try {
  for (const {folder, tag, probe} of probes) {
    const passed = [];
    for (const check of probe.checks) {
      current = page(probe, check.field);
      const tab = await browser.newPage({locale: 'ru-RU'});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      const target = check.target || tag;
      const box = check.box || probe.page.box || 'input';
      const listen = check.listen || probe.page.listen || ['input', 'change'];
      const notes = [];
      try {
        await tab.goto(`${base}/page`);
        await tab.waitForFunction(({target, box}) => document.querySelector(`${target} ${box}`), {target, box}, {timeout: 20000});
        await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 120))));
        await tab.evaluate(({target, listen}) => {
          const el = document.querySelector(target);
          window.__log = [];
          window.__submits = [];
          for (const type of listen) el.addEventListener(type, (event) => window.__log.push({type, ...(event.detail && typeof event.detail === 'object' ? event.detail : {})}));
          document.getElementById('f')?.addEventListener('submit', (event) => {
            event.preventDefault();
            window.__submits.push([...new FormData(event.target).entries()]);
          });
        }, {target, listen});
        for (const given of check.given ?? []) await step(tab, given, {tag, target, box});
        await tab.evaluate(() => { window.__log = []; window.__submits = []; window.SF?.deprecations?.clear?.(); });
        const returns = await step(tab, check, {tag, target, box});
        const seen = await tab.evaluate(({target, box, expect}) => {
          const el = document.querySelector(target);
          const form = document.getElementById('f');
          const boxNode = el.querySelector(box);
          const read = (value) => (value === undefined ? null : value);
          return {
            value: read(el.value),
            host: {
              attributes: Object.fromEntries(Object.keys(expect.host?.attributes ?? {}).map((name) => [name, el.getAttribute(name)])),
              props: Object.fromEntries(Object.keys(expect.host?.props ?? {}).map((name) => [name, read(el[name])])),
            },
            box: boxNode ? {
              text: 'value' in boxNode ? boxNode.value : boxNode.textContent,
              attributes: Object.fromEntries(Object.keys(expect.box?.attributes ?? {}).map((name) => [name, boxNode.getAttribute(name)])),
            } : null,
            formEntries: form ? [...new FormData(form).entries()] : [],
            submits: window.__submits,
            checkValidity: form ? form.checkValidity() : null,
            validity: el.validity ? Object.fromEntries(['valid', 'valueMissing', 'tooShort', 'tooLong', 'patternMismatch', 'typeMismatch', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'].map((flag) => [flag, el.validity[flag]])) : null,
            events: window.__log,
            disabled: Object.fromEntries(Object.keys(expect.disabled ?? {}).map((selector) => [selector, el.querySelector(selector)?.disabled ?? null])),
            focus: expect.focus ? Boolean(document.activeElement?.matches(expect.focus)) : null,
            journal: window.SF?.deprecations?.list?.() ?? [],
            innerNames: [...el.querySelectorAll('input, textarea, select')].map((node) => node.getAttribute('name')),
            texts: Object.fromEntries(Object.keys(expect.texts ?? {}).map((selector) => [selector, el.querySelector(selector)?.textContent ?? null])),
            listed: form ? [...form.elements].filter((node) => node.localName === el.localName).length : 0,
          };
        }, {target, box, expect: check.expect ?? {}});
        const expect = check.expect ?? {};
        const entries = check.form === 'submit' ? (seen.submits[0] ?? null) : seen.formEntries;
        if ('value' in expect && !same(seen.value, expect.value)) notes.push(`value ${JSON.stringify(seen.value)} ≠ ${JSON.stringify(expect.value)}`);
        for (const [name, value] of Object.entries(expect.host?.attributes ?? {})) if (!same(seen.host.attributes[name], value)) notes.push(`host[${name}] ${JSON.stringify(seen.host.attributes[name])} ≠ ${JSON.stringify(value)}`);
        for (const [name, value] of Object.entries(expect.host?.props ?? {})) if (!same(seen.host.props[name], value)) notes.push(`host.${name} ${JSON.stringify(seen.host.props[name])} ≠ ${JSON.stringify(value)}`);
        if (expect.box?.text !== undefined && !same(seen.box?.text, expect.box.text)) notes.push(`box text ${JSON.stringify(seen.box?.text)} ≠ ${JSON.stringify(expect.box.text)}`);
        for (const [name, value] of Object.entries(expect.box?.attributes ?? {})) if (!same(seen.box?.attributes[name], value)) notes.push(`box[${name}] ${JSON.stringify(seen.box?.attributes[name])} ≠ ${JSON.stringify(value)}`);
        if (expect.submitted !== undefined && (seen.submits.length > 0) !== expect.submitted) notes.push(`submitted ${seen.submits.length > 0}`);
        if (expect.formData) {
          if (!entries) notes.push('no form data: the form did not submit');
          else for (const [name, value] of Object.entries(expect.formData)) {
            const got = entries.filter(([key]) => key === name).map(([, v]) => v);
            const actual = got.length === 0 ? null : got.length === 1 ? got[0] : got;
            if (!same(actual, value)) notes.push(`form ${name} ${JSON.stringify(actual)} ≠ ${JSON.stringify(value)}`);
          }
        }
        if (expect.formNames && entries && !same(entries.map(([key]) => key), expect.formNames)) notes.push(`form names ${JSON.stringify(entries.map(([key]) => key))}`);
        if (expect.checkValidity !== undefined && seen.checkValidity !== expect.checkValidity) notes.push(`checkValidity ${seen.checkValidity}`);
        for (const [flag, value] of Object.entries(expect.validity ?? {})) if (seen.validity?.[flag] !== value) notes.push(`validity.${flag} ${seen.validity?.[flag]}`);
        if (expect.events) {
          if (seen.events.length !== expect.events.length) notes.push(`events ${JSON.stringify(seen.events.map((e) => e.type))} ≠ ${JSON.stringify(expect.events.map((e) => e.type))}`);
          else expect.events.forEach((want, index) => {
            for (const [key, value] of Object.entries(want)) if (!same(seen.events[index][key], value)) notes.push(`events[${index}].${key} ${JSON.stringify(seen.events[index][key])} ≠ ${JSON.stringify(value)}`);
          });
        }
        if (expect.returns !== undefined && !same(returns, expect.returns)) notes.push(`returns ${JSON.stringify(returns)}`);
        for (const [selector, value] of Object.entries(expect.disabled ?? {})) if (seen.disabled[selector] !== value) notes.push(`${selector} disabled ${seen.disabled[selector]}`);
        if (expect.focus && !seen.focus) notes.push(`focus not on ${expect.focus}`);
        for (const want of expect.journal ?? []) {
          const found = seen.journal.filter((note) => note.from === want.from);
          if (found.length !== 1) notes.push(`journal ${want.from}: ${found.length} notes`);
          else for (const [key, value] of Object.entries(want)) if (!same(found[0][key], value)) notes.push(`journal ${want.from}.${key} ${JSON.stringify(found[0][key])}`);
        }
        if (expect.innerNames && !same(seen.innerNames, expect.innerNames)) notes.push(`inner names ${JSON.stringify(seen.innerNames)}`);
        for (const [selector, text] of Object.entries(expect.texts ?? {})) if (!same(seen.texts[selector], text)) notes.push(`${selector} text ${JSON.stringify(seen.texts[selector])}`);
        if (expect.listed !== undefined && seen.listed !== expect.listed) notes.push(`listed ${seen.listed}`);
      } catch (error) {
        notes.push(`error: ${error.message.split('\n')[0]}`);
      }
      if (errors.length) notes.push(`page errors: ${errors.join(' | ')}`);
      if (notes.length) failures.push({component: tag, check: check.id, notes});
      else passed.push(check.id);
      await tab.close();
    }
    results[tag] = `${passed.length}/${probe.checks.length}`;
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({results}, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('FIELDS_MANIFEST_OK');
