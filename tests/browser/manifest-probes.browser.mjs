#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [folder ...]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The conformance probes of standard simai.smart-component 1.3.8 §12 (gate
// 20): every src/smart/<folder>/probe.json, run on the built bytes with the
// real Loader. A probe is in the format of ui-control
// control/smart-architecture/stands/15-scenarios (page, format, checks); its
// `format` says what each field of a check means. This runner reads them
// all, so a component that gains a probe.json is probed without a change
// here. Folders given after the output root narrow the run.
//
// A check: `field` is the markup put in place of {{field}} in the page;
// `given` steps run first and the event log is cleared after them; then
// exactly one trigger (setting | action | user | form | script) runs; then
// `expect` is compared. Steps:
//   setting {name, value}  an attribute; true/false for a boolean; null removes it
//   property {name, value} a property of the element
//   action {name, with}    the kebab name called as the camelCase method (§3.2)
//   user                   one string or a list: type:<text>, keyboard:<Key>,
//                          click:<selector>, focus:<selector>, files:<selector>=<name>|<type>[,...]
//   form                   submit (requestSubmit) | reset (form.reset())
//   script                 JavaScript run in the page with `el` and `form`
// Expectations:
//   value                  the element's value property (deep equal)
//   host                   {attributes: {name: value|null}, properties: {name: value}}
//   formData               new FormData(form) after the trigger, or at the
//                          submit event on submit; null = the name is absent;
//                          a list = every entry of that name
//   submitted              whether requestSubmit reached the submit event
//   checkValidity          form.checkValidity()
//   validity               {host: {<ValidityState field>: bool}}
//   events                 the exact ordered list of the listened events on the
//                          element, each with a subset of its detail; [] = none
//   returns                what the action returned (subset for an object)
//   deprecations           records in SF.deprecations.list() (subset each)
//   evaluate               {<expression>: expected}, each run in the page with `el`
//   fileChooser            whether the trigger opened the platform file dialog
import {createServer} from 'node:http';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const only = process.argv.slice(3);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const smartRoot = join(repo, 'src', 'smart');
const probes = readdirSync(smartRoot)
  .filter((folder) => (!only.length || only.includes(folder)) && existsSync(join(smartRoot, folder, 'probe.json')))
  .sort()
  .map((folder) => ({folder, probe: JSON.parse(readFileSync(join(smartRoot, folder, 'probe.json'), 'utf8'))}));

const pageFor = (probe, check) => `<!doctype html><html lang="${probe.page?.lang || 'ru'}" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
${String(probe.page?.markup || '<form id="f">{{field}}<button type="submit">OK</button></form>').replace('{{field}}', check.field)}
</body></html>`;

let current = null;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe' && current) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${['.js', '.css', '.json', '.svg'].includes(extname(file)) ? '; charset=utf-8' : ''}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const camel = (name) => String(name).replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());

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

const browser = await chromium.launch();
const results = [];
let failed = 0;
try {
  for (const {folder, probe} of probes) {
    const tag = probe.component || `sf-${folder}`;
    for (const check of probe.checks) {
      const context = await browser.newContext({locale: probe.page?.lang === 'en' ? 'en-US' : 'ru-RU'});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      current = pageFor(probe, check);
      await page.goto(`${base}/probe`);
      const problems = [];
      try {
        await page.waitForFunction((name) => {
          const el = document.querySelector(name);
          return Boolean(customElements.get(name) && el && (el.hasAttribute('data-sf-started') || !el.constructor.manifest) && el.children.length);
        }, tag, {timeout: 20000});
        await page.waitForTimeout(200);
        await page.evaluate(({name, listen}) => {
          const el = document.querySelector(name);
          const form = document.querySelector('form');
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
            const data = {};
            for (const [key, value] of new FormData(form)) (data[key] ||= []).push(typeof value === 'string' ? value : {name: value.name});
            window.__submits.push(data);
          });
        }, {name: tag, listen: probe.page?.listen || []});

        const run = async (step) => {
          let returns;
          if (step.setting) {
            await page.evaluate(({name, setting}) => {
              const el = document.querySelector(name);
              if (setting.value === true) el.setAttribute(setting.name, '');
              else if (setting.value === false || setting.value === null) el.removeAttribute(setting.name);
              else el.setAttribute(setting.name, String(setting.value));
            }, {name: tag, setting: step.setting});
          }
          if (step.property) {
            await page.evaluate(({name, property}) => {
              document.querySelector(name)[property.name] = property.value;
            }, {name: tag, property: {...step.property, name: camel(step.property.name)}});
          }
          if (step.action) {
            returns = await page.evaluate(async ({name, method, args}) => {
              const el = document.querySelector(name);
              let result = el[method](...args);
              if (result && typeof result.then === 'function') result = await result;
              return result === el ? 'element' : (result === undefined ? null : JSON.parse(JSON.stringify(result)));
            }, {name: tag, method: camel(step.action.name), args: step.action.with === undefined ? [] : [step.action.with]});
          }
          for (const user of [].concat(step.user || [])) {
            const [kind, ...rest] = user.split(':');
            const argument = rest.join(':');
            if (kind === 'type') await page.keyboard.type(argument);
            if (kind === 'keyboard') await page.keyboard.press(argument);
            if (kind === 'click') await page.locator(`${tag} ${argument}`).first().click();
            if (kind === 'focus') await page.locator(`${tag} ${argument}`).first().focus();
            if (kind === 'files') {
              const [selector, list] = argument.split('=');
              const files = list.split(',').map((one) => {
                const [fileName, mimeType = 'application/octet-stream'] = one.split('|');
                return {name: fileName, mimeType, buffer: Buffer.from(`probe ${fileName}`)};
              });
              await page.locator(`${tag} ${selector}`).first().setInputFiles(files);
            }
            await page.waitForTimeout(60);
          }
          if (step.form === 'submit') await page.evaluate(() => document.querySelector('form').requestSubmit());
          if (step.form === 'reset') await page.evaluate(() => document.querySelector('form').reset());
          if (step.script) {
            returns = await page.evaluate(async ({name, script}) => {
              const el = document.querySelector(name);
              const form = document.querySelector('form');
              // eslint-disable-next-line no-new-func
              const result = await new Function('el', 'form', `return (async () => { ${script} })();`)(el, form);
              return result === undefined ? null : JSON.parse(JSON.stringify(result));
            }, {name: tag, script: step.script});
          }
          await page.waitForTimeout(step.wait ?? 120);
          return returns;
        };

        for (const step of [].concat(check.given || [])) await run(step);
        await page.evaluate(() => { window.__log = []; window.__submits = []; globalThis.SF?.deprecations?.clear?.(); });
        // expect.fileChooser: whether the trigger opened the platform file dialog.
        const chooser = 'fileChooser' in (check.expect || {})
          ? page.waitForEvent('filechooser', {timeout: 2000}).then(() => true, () => false)
          : null;
        const returns = await run(check);
        const chose = chooser ? await chooser : null;
        const expect = check.expect || {};
        const seen = await page.evaluate(({name, expect}) => {
          const el = document.querySelector(name);
          const form = document.querySelector('form');
          const data = {};
          if (form) for (const [key, value] of new FormData(form)) (data[key] ||= []).push(typeof value === 'string' ? value : {name: value.name});
          const validity = {};
          if (el.validity) for (const key of ['valid', 'valueMissing', 'customError', 'typeMismatch', 'badInput']) validity[key] = el.validity[key];
          const attributes = {};
          for (const key of Object.keys(expect.host?.attributes || {})) attributes[key] = el.getAttribute(key);
          const properties = {};
          for (const key of Object.keys(expect.host?.properties || {})) {
            const value = el[key];
            properties[key] = value === undefined ? null : JSON.parse(JSON.stringify(value));
          }
          const evaluated = {};
          for (const expression of Object.keys(expect.evaluate || {})) {
            try {
              // eslint-disable-next-line no-new-func
              const value = new Function('el', 'form', `return (${expression});`)(el, form);
              evaluated[expression] = value === undefined ? null : JSON.parse(JSON.stringify(value));
            } catch (error) {
              evaluated[expression] = `throws ${error.message}`;
            }
          }
          let value = el.value;
          try { value = value === undefined ? null : JSON.parse(JSON.stringify(value)); } catch { value = String(value); }
          return {
            value,
            data,
            submits: window.__submits,
            checkValidity: form ? form.checkValidity() : null,
            validity,
            attributes,
            properties,
            evaluated,
            log: window.__log,
            deprecations: globalThis.SF?.deprecations?.list?.() || [],
          };
        }, {name: tag, expect});

        const formData = (source) => Object.fromEntries(Object.entries(source).map(([key, list]) => [key, list.length === 1 ? list[0] : list]));
        if ('value' in expect && !matches(seen.value, expect.value)) problems.push(`value ${JSON.stringify(seen.value)} != ${JSON.stringify(expect.value)}`);
        if (expect.formData) {
          const data = check.form === 'submit' ? formData(seen.submits[0] || {}) : formData(seen.data);
          for (const [key, one] of Object.entries(expect.formData)) {
            if (!matches(data[key] ?? null, one)) problems.push(`formData ${key} ${JSON.stringify(data[key] ?? null)} != ${JSON.stringify(one)}`);
          }
        }
        if ('submitted' in expect && (seen.submits.length > 0) !== expect.submitted) problems.push(`submitted ${seen.submits.length > 0} != ${expect.submitted}`);
        if ('checkValidity' in expect && seen.checkValidity !== expect.checkValidity) problems.push(`checkValidity ${seen.checkValidity} != ${expect.checkValidity}`);
        if (expect.validity?.host && !matches(seen.validity, expect.validity.host)) problems.push(`validity ${JSON.stringify(seen.validity)} != ${JSON.stringify(expect.validity.host)}`);
        if (expect.host?.attributes && !matches(seen.attributes, expect.host.attributes)) problems.push(`attributes ${JSON.stringify(seen.attributes)} != ${JSON.stringify(expect.host.attributes)}`);
        if (expect.host?.properties && !matches(seen.properties, expect.host.properties)) problems.push(`properties ${JSON.stringify(seen.properties)} != ${JSON.stringify(expect.host.properties)}`);
        if (expect.evaluate) {
          for (const [expression, one] of Object.entries(expect.evaluate)) {
            if (!matches(seen.evaluated[expression], one)) problems.push(`${expression} = ${JSON.stringify(seen.evaluated[expression])} != ${JSON.stringify(one)}`);
          }
        }
        if (expect.events) {
          const ok = seen.log.length === expect.events.length && expect.events.every((one, index) => matches(seen.log[index], one));
          if (!ok) problems.push(`events ${JSON.stringify(seen.log)} != ${JSON.stringify(expect.events)}`);
        }
        if ('fileChooser' in expect && chose !== expect.fileChooser) problems.push(`fileChooser ${chose} != ${expect.fileChooser}`);
        if ('returns' in expect && !matches(returns, expect.returns)) problems.push(`returns ${JSON.stringify(returns)} != ${JSON.stringify(expect.returns)}`);
        if (expect.deprecations) {
          for (const one of expect.deprecations) {
            if (!seen.deprecations.some((note) => matches(note, one))) problems.push(`deprecation ${JSON.stringify(one)} not in ${JSON.stringify(seen.deprecations)}`);
          }
        }
      } catch (error) {
        problems.push(String(error?.message || error).split('\n')[0]);
      }
      if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`);
      if (problems.length) failed += 1;
      results.push({component: tag, check: check.id, ok: !problems.length, problems});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const summary = {probes: probes.map((one) => one.folder), checks: results.length, passed: results.length - failed, failed, failures: results.filter((one) => !one.ok)};
console.log(JSON.stringify(summary, null, 2));
if (failed || !probes.length) process.exitCode = 1;
