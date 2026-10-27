#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [folder | probe.json ...]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The conformance probes of standard simai.smart-component 1.3.8 §12 (gate
// 20): every src/smart/<folder>/probe.json, run on the built bytes with the
// real Loader. This is the one runner for them all: a component that gains a
// probe.json is probed without a change here. Folders given after the output
// root narrow the run; a path to a .json file adds that probe (the stand's own
// modal probe, for one).
//
// A probe is in a format of ui-control control/smart-architecture/stands/
// 15-scenarios. Two shapes exist, told apart by what the file holds:
//
// 1. checks (the A2 quantity probe; the form fields): a fresh page per check.
//      page    {lang, markup with {{field}}, listen: [event names], box?: selector}
//      checks  [{id, covers, field, target?, box?, listen?, given?: [steps], <trigger>, expect}]
//    `field` is the markup put in place of {{field}}; `given` steps run first and
//    the event log is cleared after them; then exactly one trigger runs and
//    `expect` is compared. A step or trigger:
//      setting {name, value}  an attribute; true/false for a boolean; null removes it
//      property {name, value} a property of the element
//      action {name, with}    the kebab name called as the camelCase method (§3.2)
//      user                   one string or a list: type:<text> (into the box when
//                             the probe names one), keyboard:<Key> (in the box when
//                             the focus is outside the element), tab,
//                             click:<selector>, focus:<selector>,
//                             files:<selector>=<name>|<type>[,...]
//      form                   submit (requestSubmit) | reset (form.reset())
//      script                 JavaScript run in the page with `el` and `form`
//      wait                   ms to wait after the step (default 120)
//    expect (all optional):
//      value                  the element's value property
//      host                   {attributes: {name: value|null}, properties|props: {name: value}}
//      box                    {text, attributes} of the box inside the element
//      formData               new FormData(form) after the trigger, or at the
//                             submit event on submit; null = the name is absent;
//                             a list = every entry of that name
//      formNames              the names FormData holds, in order
//      submitted              whether requestSubmit reached the submit event
//      checkValidity          form.checkValidity()
//      validity               {flag: bool} of the element's validity, or {host: {flag: bool}}
//      events                 the exact ordered list of the listened events on the
//                             element, each {type, ...a subset of its detail}; [] = none
//      returns                what the action or script returned (element = the element)
//      deprecations           records in SF.deprecations.list() (subset each)
//      journal                [{from, ...}]: exactly one SF.deprecations note from each
//      evaluate               {<expression>: expected}, each run in the page with `el`
//      fileChooser            whether the trigger opened the platform file dialog
//      disabled               {selector: bool} inside the element
//      focus                  a selector the focused element matches
//      texts                  {selector: text} of parts inside the element
//      innerNames             the name attributes of the inner input/textarea/select
//      listed                 how many of the form's elements are this element
//
// 2. probes in steps (the A4 modal probe; the overlays): one page of several
//    elements, a fresh page per probe.
//      page    {lang?, body: [lines]}
//      probes  [{id, title, covers?, steps: [step]}]
//    A step does one of
//      user    click:<selector> (focuses and clicks it) | keyboard:<Key>
//      action  {name, with}, target  the kebab name called as the camelCase method
//      script  a JavaScript expression run in the page (awaited)
//      focus   "expect inside" (target holds the focus) | "expect returned to <selector>"
//      check   a JavaScript expression that must hold
//    and expects (all optional)
//      event / detail     a name heard on the window and a subset of its detail
//      events             [{name, count?, detail?}]: each heard, `count` times
//      values             {"<selector>.<property>": value}; a value named like an
//                         action is read from <property>State
//      returns            what the action or the script answered (a subset)
//      journal            [{from, kind?, ...}]: SF.deprecations notes made during the step
import {createServer} from 'node:http';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const args = process.argv.slice(3);
const only = args.filter((one) => !one.endsWith('.json'));
const extra = args.filter((one) => one.endsWith('.json')).map((file) => resolve(file));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const smartRoot = join(repo, 'src', 'smart');
const probes = [
  ...readdirSync(smartRoot)
    .filter((folder) => (!only.length || only.includes(folder)) && existsSync(join(smartRoot, folder, 'probe.json')))
    .sort()
    .map((folder) => ({folder, file: join(smartRoot, folder, 'probe.json')})),
  ...extra.map((file) => ({folder: null, file})),
].map((one) => ({...one, probe: JSON.parse(readFileSync(one.file, 'utf8'))}));

const shell = (lang, body) => `<!doctype html><html lang="${lang || 'ru'}" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
${body}
</body></html>`;
const checkPage = (probe, check) => shell(probe.page?.lang, String(probe.page?.markup || '<form id="f">{{field}}<button type="submit">OK</button></form>').replace('{{field}}', check.field));
const stepsPage = (probe) => shell(probe.page?.lang, [].concat(probe.page?.body ?? []).join('\n'));

let current = null;
const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe' && current) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  // A page a probe loads into a region (the overlays' remote content).
  if (path.startsWith('/fixture/')) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(`<p id="fixture-${path.slice('/fixture/'.length)}">Загружено</p>`);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const camel = (name) => String(name).replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A subset match: an expected object names the keys it cares about; a list
// is matched item by item and must be as long; null matches absent.
function matches(actual, expected) {
  if (expected === null) return actual === null || actual === undefined;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((one, index) => matches(actual[index], one));
  }
  if (expected && typeof expected === 'object') {
    return actual !== null && typeof actual === 'object' && Object.entries(expected).every(([key, one]) => matches(actual[key], one));
  }
  return actual === expected;
}

// ---- shape 1: checks -------------------------------------------------------

const VALIDITY = ['valid', 'valueMissing', 'tooShort', 'tooLong', 'patternMismatch', 'typeMismatch', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'];

async function runCheck(page, probe, check, tag) {
  const target = check.target || tag;
  const box = check.box || probe.page?.box || null;
  const listen = check.listen || probe.page?.listen || [];
  const problems = [];
  await page.waitForFunction(({name, target, box}) => {
    const el = document.querySelector(name);
    const ready = Boolean(customElements.get(name) && el && (el.hasAttribute('data-sf-started') || !el.constructor.manifest) && el.children.length);
    return ready && (!box || document.querySelector(`${target} ${box}`));
  }, {name: tag, target, box}, {timeout: 20000});
  await page.waitForTimeout(200);
  await page.evaluate(({target, listen}) => {
    const el = document.querySelector(target);
    const form = document.getElementById('f') || document.querySelector('form');
    const plain = (value, depth = 0) => {
      if (value === null || value === undefined) return value ?? null;
      if (typeof File === 'function' && value instanceof File) return {name: value.name, size: value.size, type: value.type};
      if (typeof Element === 'function' && value instanceof Element) return '<element>';
      if (typeof Event === 'function' && value instanceof Event) return '<event>';
      if (Array.isArray(value)) return depth > 4 ? '[…]' : value.map((one) => plain(one, depth + 1));
      if (typeof value === 'object') {
        if (depth > 4) return '{…}';
        return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, plain(one, depth + 1)]));
      }
      return value;
    };
    window.__log = [];
    for (const type of listen) {
      el.addEventListener(type, (event) => {
        const detail = event.detail && typeof event.detail === 'object' ? plain(event.detail) : {};
        window.__log.push({type, ...detail});
      });
    }
    window.__submits = [];
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      window.__submits.push([...new FormData(form)].map(([key, value]) => [key, typeof value === 'string' ? value : {name: value.name}]));
    });
  }, {target, listen});

  const run = async (step) => {
    let returns;
    if (step.setting) {
      await page.evaluate(({target, setting}) => {
        const el = document.querySelector(target);
        if (setting.value === true) el.setAttribute(setting.name, '');
        else if (setting.value === false || setting.value === null) el.removeAttribute(setting.name);
        else el.setAttribute(setting.name, String(setting.value));
      }, {target, setting: step.setting});
    }
    if (step.property) {
      await page.evaluate(({target, property}) => {
        document.querySelector(target)[property.name] = property.value;
      }, {target, property: {...step.property, name: camel(step.property.name)}});
    }
    if (step.action) {
      returns = await page.evaluate(async ({target, method, args}) => {
        const el = document.querySelector(target);
        if (typeof el[method] !== 'function') return `no method ${method}`;
        let result = el[method](...args);
        if (result && typeof result.then === 'function') result = await result;
        return result === el ? 'element' : (result === undefined ? null : JSON.parse(JSON.stringify(result)));
      }, {target, method: camel(step.action.name), args: step.action.with === undefined ? [] : [step.action.with]});
    }
    for (const user of [].concat(step.user || [])) {
      const [kind, ...rest] = user.split(':');
      const argument = rest.join(':');
      const inside = () => page.evaluate((selector) => Boolean(document.querySelector(selector)?.contains(document.activeElement)), target);
      if (kind === 'type') {
        if (box) await page.locator(`${target} ${box}`).first().focus();
        await page.keyboard.type(argument);
      }
      if (kind === 'keyboard') {
        if (box && !(await inside())) await page.locator(`${target} ${box}`).first().focus();
        await page.keyboard.press(argument);
      }
      if (kind === 'tab') await page.keyboard.press('Tab');
      if (kind === 'click') await page.locator(`${target} ${argument}`).first().click();
      if (kind === 'focus') await page.locator(`${target} ${argument}`).first().focus();
      if (kind === 'files') {
        const cut = argument.lastIndexOf('=');
        const [selector, list] = [argument.slice(0, cut), argument.slice(cut + 1)];
        const files = list.split(',').map((one) => {
          const [fileName, mimeType = 'application/octet-stream'] = one.split('|');
          return {name: fileName, mimeType, buffer: Buffer.from(`probe ${fileName}`)};
        });
        await page.locator(`${target} ${selector}`).first().setInputFiles(files);
      }
      await page.waitForTimeout(60);
    }
    if (step.form === 'submit') await page.evaluate(() => (document.getElementById('f') || document.querySelector('form')).requestSubmit());
    if (step.form === 'reset') await page.evaluate(() => (document.getElementById('f') || document.querySelector('form')).reset());
    if (step.script) {
      returns = await page.evaluate(async ({target, script}) => {
        const el = document.querySelector(target);
        const form = document.getElementById('f') || document.querySelector('form');
        // eslint-disable-next-line no-new-func
        const result = await new Function('el', 'form', `return (async () => { ${script} })();`)(el, form);
        return result === el ? 'element' : (result === undefined ? null : JSON.parse(JSON.stringify(result)));
      }, {target, script: step.script});
    }
    // Two frames for a redraw, then the step's own wait.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.waitForTimeout(step.wait ?? 120);
    return returns;
  };

  for (const step of [].concat(check.given || [])) await run(step);
  await page.evaluate(() => { window.__log = []; window.__submits = []; globalThis.SF?.deprecations?.clear?.(); });
  const chooser = 'fileChooser' in (check.expect || {})
    ? page.waitForEvent('filechooser', {timeout: 2000}).then(() => true, () => false)
    : null;
  const returns = await run(check);
  const chose = chooser ? await chooser : null;
  const expect = check.expect || {};
  const seen = await page.evaluate(({target, box, expect, VALIDITY}) => {
    const el = document.querySelector(target);
    const form = document.getElementById('f') || document.querySelector('form');
    const json = (value) => {
      if (value === undefined) return null;
      try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
    };
    const evaluated = {};
    for (const expression of Object.keys(expect.evaluate || {})) {
      try {
        // eslint-disable-next-line no-new-func
        evaluated[expression] = json(new Function('el', 'form', `return (${expression});`)(el, form));
      } catch (error) {
        evaluated[expression] = `throws ${error.message}`;
      }
    }
    const props = {...(expect.host?.properties || {}), ...(expect.host?.props || {})};
    const boxNode = box ? el.querySelector(box) : null;
    return {
      value: json(el.value),
      entries: form ? [...new FormData(form)].map(([key, value]) => [key, typeof value === 'string' ? value : {name: value.name}]) : [],
      submits: window.__submits,
      checkValidity: form ? form.checkValidity() : null,
      validity: el.validity ? Object.fromEntries(VALIDITY.map((flag) => [flag, el.validity[flag]])) : null,
      attributes: Object.fromEntries(Object.keys(expect.host?.attributes || {}).map((name) => [name, el.getAttribute(name)])),
      properties: Object.fromEntries(Object.keys(props).map((name) => [name, json(el[name])])),
      box: boxNode ? {
        text: 'value' in boxNode ? boxNode.value : boxNode.textContent,
        attributes: Object.fromEntries(Object.keys(expect.box?.attributes || {}).map((name) => [name, boxNode.getAttribute(name)])),
      } : null,
      evaluated,
      log: window.__log,
      deprecations: globalThis.SF?.deprecations?.list?.() || [],
      disabled: Object.fromEntries(Object.keys(expect.disabled || {}).map((selector) => [selector, el.querySelector(selector)?.disabled ?? null])),
      focus: expect.focus ? Boolean(document.activeElement?.matches(expect.focus)) : null,
      innerNames: [...el.querySelectorAll('input, textarea, select')].map((node) => node.getAttribute('name')),
      texts: Object.fromEntries(Object.keys(expect.texts || {}).map((selector) => [selector, el.querySelector(selector)?.textContent ?? null])),
      listed: form ? [...form.elements].filter((node) => node.localName === el.localName).length : 0,
    };
  }, {target, box, expect, VALIDITY});

  const entries = check.form === 'submit' ? (seen.submits[0] ?? null) : seen.entries;
  if ('value' in expect && !matches(seen.value, expect.value)) problems.push(`value ${JSON.stringify(seen.value)} != ${JSON.stringify(expect.value)}`);
  if (expect.formData) {
    for (const [key, one] of Object.entries(expect.formData)) {
      const got = (entries || []).filter(([name]) => name === key).map(([, value]) => value);
      const actual = got.length === 0 ? null : got.length === 1 ? got[0] : got;
      if (!matches(actual, one)) problems.push(`formData ${key} ${JSON.stringify(actual)} != ${JSON.stringify(one)}`);
    }
  }
  if (expect.formNames && !same((entries || []).map(([key]) => key), expect.formNames)) problems.push(`formNames ${JSON.stringify((entries || []).map(([key]) => key))} != ${JSON.stringify(expect.formNames)}`);
  if ('submitted' in expect && (seen.submits.length > 0) !== expect.submitted) problems.push(`submitted ${seen.submits.length > 0} != ${expect.submitted}`);
  if ('checkValidity' in expect && seen.checkValidity !== expect.checkValidity) problems.push(`checkValidity ${seen.checkValidity} != ${expect.checkValidity}`);
  if (expect.validity) {
    const want = expect.validity.host || expect.validity;
    if (!matches(seen.validity, want)) problems.push(`validity ${JSON.stringify(seen.validity)} != ${JSON.stringify(want)}`);
  }
  if (expect.host?.attributes && !matches(seen.attributes, expect.host.attributes)) problems.push(`attributes ${JSON.stringify(seen.attributes)} != ${JSON.stringify(expect.host.attributes)}`);
  const props = {...(expect.host?.properties || {}), ...(expect.host?.props || {})};
  if (Object.keys(props).length && !matches(seen.properties, props)) problems.push(`properties ${JSON.stringify(seen.properties)} != ${JSON.stringify(props)}`);
  if (expect.box?.text !== undefined && !same(seen.box?.text, expect.box.text)) problems.push(`box text ${JSON.stringify(seen.box?.text)} != ${JSON.stringify(expect.box.text)}`);
  for (const [name, value] of Object.entries(expect.box?.attributes || {})) if (!same(seen.box?.attributes[name], value)) problems.push(`box[${name}] ${JSON.stringify(seen.box?.attributes[name])} != ${JSON.stringify(value)}`);
  for (const [expression, one] of Object.entries(expect.evaluate || {})) {
    if (!matches(seen.evaluated[expression], one)) problems.push(`${expression} = ${JSON.stringify(seen.evaluated[expression])} != ${JSON.stringify(one)}`);
  }
  if (expect.events) {
    const ok = seen.log.length === expect.events.length && expect.events.every((one, index) => matches(seen.log[index], one));
    if (!ok) problems.push(`events ${JSON.stringify(seen.log)} != ${JSON.stringify(expect.events)}`);
  }
  if ('fileChooser' in expect && chose !== expect.fileChooser) problems.push(`fileChooser ${chose} != ${expect.fileChooser}`);
  if ('returns' in expect && !matches(returns, expect.returns)) problems.push(`returns ${JSON.stringify(returns)} != ${JSON.stringify(expect.returns)}`);
  for (const one of expect.deprecations || []) {
    if (!seen.deprecations.some((note) => matches(note, one))) problems.push(`deprecation ${JSON.stringify(one)} not in ${JSON.stringify(seen.deprecations)}`);
  }
  for (const want of expect.journal || []) {
    const found = seen.deprecations.filter((note) => note.from === want.from);
    if (found.length !== 1) problems.push(`journal ${want.from}: ${found.length} notes`);
    else for (const [key, value] of Object.entries(want)) if (!same(found[0][key], value)) problems.push(`journal ${want.from}.${key} ${JSON.stringify(found[0][key])}`);
  }
  for (const [selector, value] of Object.entries(expect.disabled || {})) if (seen.disabled[selector] !== value) problems.push(`${selector} disabled ${seen.disabled[selector]}`);
  if (expect.focus && !seen.focus) problems.push(`focus not on ${expect.focus}`);
  if (expect.innerNames && !same(seen.innerNames, expect.innerNames)) problems.push(`innerNames ${JSON.stringify(seen.innerNames)}`);
  for (const [selector, text] of Object.entries(expect.texts || {})) if (!same(seen.texts[selector], text)) problems.push(`${selector} text ${JSON.stringify(seen.texts[selector])}`);
  if (expect.listed !== undefined && seen.listed !== expect.listed) problems.push(`listed ${seen.listed}`);
  return problems;
}

// ---- shape 2: probes in steps ---------------------------------------------

const loose = (a, b) => same(a, b) || String(a) === String(b);
const subset = (actual, want) => {
  if (want === null || typeof want !== 'object') return loose(actual, want);
  if (actual === null || typeof actual !== 'object') return false;
  return Object.entries(want).every(([key, value]) => subset(actual[key], value));
};

async function runSteps(page, pr) {
  const notes = [];
  for (const [n, step] of pr.steps.entries()) {
    const at = `step ${n + 1}`;
    const expect = step.expect ?? {};
    const names = [...new Set([...[].concat(expect.event ?? []), ...[].concat(expect.events ?? []).map((one) => one.name)])];
    await page.evaluate(({names, clear}) => {
      window.__heard = [];
      window.__listen?.();
      const listeners = names.map((name) => [name, (event) => window.__heard.push({name: event.type, detail: event.detail})]);
      for (const [name, fn] of listeners) window.addEventListener(name, fn);
      window.__listen = () => { for (const [name, fn] of listeners) window.removeEventListener(name, fn); };
      // A step that expects journal notes reads only the ones it made.
      if (clear) window.SF?.deprecations?.clear?.();
    }, {names, clear: Boolean(expect.journal)});
    let returns;
    if (step.user) {
      const [kind, ...rest] = step.user.split(':');
      const arg = rest.join(':');
      if (kind === 'click') {
        const found = await page.evaluate((selector) => {
          const target = document.querySelector(selector);
          if (!target) return false;
          target.focus?.();
          target.click();
          return true;
        }, arg);
        if (!found) { notes.push(`${at}: no «${arg}»`); continue; }
      }
      if (kind === 'keyboard') await page.keyboard.press(arg);
    }
    if (step.action) {
      returns = await page.evaluate(async ({selector, name, given}) => {
        const element = document.querySelector(selector);
        const method = name.replace(/-([a-z])/gu, (_, c) => c.toUpperCase());
        if (typeof element?.[method] !== 'function') return `no method ${method}`;
        const result = await element[method](...(given === undefined ? [] : [given]));
        return result === element ? 'element' : result;
      }, {selector: step.target, name: step.action.name, given: step.action.with});
    }
    if (step.script) {
      returns = await page.evaluate(async (code) => {
        // eslint-disable-next-line no-new-func
        return await new Function(`return (async () => (${code}))();`)();
      }, step.script);
    }
    await page.waitForTimeout(step.wait ?? 450);
    const seen = await page.evaluate(({values, focus, target, check}) => {
      const read = (path) => {
        const selector = path.slice(0, path.lastIndexOf('.'));
        const prop = path.slice(path.lastIndexOf('.') + 1).replace(/-([a-z])/gu, (_, c) => c.toUpperCase());
        const element = document.querySelector(selector);
        let actual = element?.[prop];
        if (typeof actual === 'function') actual = element[`${prop}State`];
        return actual === undefined ? null : actual;
      };
      let held = null;
      if (check) {
        // eslint-disable-next-line no-new-func
        try { held = Boolean(new Function('document', 'window', `return (${check});`)(document, window)); } catch (error) { held = `error: ${error.message}`; }
      }
      const active = document.activeElement;
      return {
        values: Object.fromEntries(Object.keys(values).map((path) => [path, read(path)])),
        heard: window.__heard.map(({name, detail}) => ({name, detail: detail && typeof detail === 'object' ? JSON.parse(JSON.stringify(detail, (key, value) => (value instanceof Node ? `<${value.localName ?? '#node'}>` : value))) : detail})),
        journal: window.SF?.deprecations?.list?.() ?? [],
        inside: focus === 'expect inside' ? Boolean(document.querySelector(target)?.contains(active)) : null,
        returned: focus && focus.startsWith('expect returned to ') ? document.querySelector(focus.slice('expect returned to '.length)) === active : null,
        active: active ? `${active.localName}${active.id ? `#${active.id}` : ''}` : null,
        held,
      };
    }, {values: expect.values ?? {}, focus: step.focus ?? null, target: step.target ?? null, check: step.check ?? null});
    for (const [path, value] of Object.entries(expect.values ?? {})) if (!loose(seen.values[path], value)) notes.push(`${at}: ${path} = ${JSON.stringify(seen.values[path])}, expected ${JSON.stringify(value)}`);
    for (const name of [].concat(expect.event ?? [])) {
      const got = seen.heard.find((one) => one.name === name);
      if (!got) { notes.push(`${at}: no ${name}`); continue; }
      for (const [key, value] of Object.entries(expect.detail ?? {})) if (!loose(got.detail?.[key], value)) notes.push(`${at}: ${name}.${key} = ${JSON.stringify(got.detail?.[key] ?? null)}, expected ${JSON.stringify(value)}`);
    }
    for (const want of [].concat(expect.events ?? [])) {
      const got = seen.heard.filter((one) => one.name === want.name);
      const count = want.count ?? 1;
      if (got.length !== count) notes.push(`${at}: ${want.name} heard ${got.length} times, expected ${count}`);
      else if (want.detail && !subset(got[0].detail, want.detail)) notes.push(`${at}: ${want.name} detail ${JSON.stringify(got[0].detail)}`);
    }
    if (expect.returns !== undefined && !subset(returns, expect.returns)) notes.push(`${at}: returned ${JSON.stringify(returns)}, expected ${JSON.stringify(expect.returns)}`);
    for (const want of [].concat(expect.journal ?? [])) {
      const found = seen.journal.filter((note) => note.from === want.from && (!want.kind || note.kind === want.kind));
      if (found.length !== 1) notes.push(`${at}: journal ${want.from}: ${found.length} notes`);
      else for (const [key, value] of Object.entries(want)) if (!loose(found[0][key], value)) notes.push(`${at}: journal ${want.from}.${key} ${JSON.stringify(found[0][key])}`);
    }
    if (seen.inside === false) notes.push(`${at}: focus not inside ${step.target} (${seen.active})`);
    if (seen.returned === false) notes.push(`${at}: focus on ${seen.active}, expected ${step.focus.slice('expect returned to '.length)}`);
    if (step.check && seen.held !== true) notes.push(`${at}: does not hold${typeof seen.held === 'string' ? ` (${seen.held})` : ''}: ${step.check}`);
  }
  return notes;
}

// ---- the run ---------------------------------------------------------------

const browser = await chromium.launch();
const results = [];
const perProbe = {};
let failed = 0;
try {
  for (const {folder, file, probe} of probes) {
    const label = probe.component || (folder ? `sf-${folder}` : file);
    const shaped = Array.isArray(probe.probes);
    const list = shaped ? probe.probes : (probe.checks || []);
    let passed = 0;
    for (const check of list) {
      const lang = probe.page?.lang === 'en' ? 'en-US' : 'ru-RU';
      const context = await browser.newContext({locale: lang, viewport: {width: 1280, height: 800}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error?.message || error)));
      current = shaped ? stepsPage(probe) : checkPage(probe, check);
      let problems = [];
      try {
        await page.goto(`${base}/probe`);
        if (shaped) {
          const tags = [...new Set([...current.matchAll(/<(sf-[a-z-]+)/gu)].map((m) => m[1]))];
          await page.waitForFunction((tags) => tags.every((tag) => customElements.get(tag)), tags, {timeout: 20000});
          await page.waitForTimeout(400);
          problems = await runSteps(page, check);
        } else {
          problems = await runCheck(page, probe, check, probe.component || `sf-${folder}`);
        }
      } catch (error) {
        problems.push(String(error?.message || error).split('\n')[0]);
      }
      if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`);
      if (problems.length) failed += 1;
      else passed += 1;
      results.push({component: label, check: check.id, ok: !problems.length, problems});
      await context.close();
    }
    perProbe[label] = `${passed}/${list.length}`;
  }
} finally {
  await browser.close();
  server.close();
}

const summary = {probes: probes.map((one) => one.folder || one.file), results: perProbe, checks: results.length, passed: results.length - failed, failed, failures: results.filter((one) => !one.ok)};
console.log(JSON.stringify(summary, null, 2));
if (failed || !probes.length) process.exitCode = 1;
