#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [more probe.json …]
// Gate 20 of standard simai.smart-component 1.3.8 for the overlay family built
// from its component.json (sf-modal, sf-drawer, sf-popover, sf-dropdown,
// sf-context-menu, sf-toast, sf-tooltip): each component's probe.json, in the
// format of ui-control stands/15-scenarios (the A4 modal probe: a page of
// several elements and probes in steps, a fresh page per probe), runs on the
// built bytes with the real Loader. Further probe files given on the command
// line run the same way (the stand's own modal probe, for one).
//
// A probe.json:
//   page    {lang?, body: [lines]}   (a `head` is the stand's and is replaced
//                                     by the build's core.css and core.js)
//   probes  [{id, title, covers?, steps: [step]}]
// A step does one of
//   user    click:<selector>  focuses and clicks it, as the stand does;
//           keyboard:<Key>    a real key press (Shift+Tab too)
//   action  {name, with}, target  the kebab name called as the camelCase
//           method; with an object, as one argument
//   script  a JavaScript expression run in the page (awaited)
//   focus   "expect inside" (target: a selector holding the focus) or
//           "expect returned to <selector>"
//   check   a JavaScript expression that must hold
// and expects (all optional)
//   event / detail     a name heard on the window (bubbling) and a subset of its detail
//   events             [{name, count?, detail?}]: each heard, `count` times
//   values             {"<selector>.<property>": value}; a value named like an
//                      action is read from <property>State, as the stand reads
//   returns            what the action or the script answered (a subset)
//   journal            [{from, to?, since?, remove_after?}]: SF.deprecations
//                      notes made during the step
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

const FOLDERS = (process.env.SF_OVERLAYS || 'modal,drawer,popover,dropdown,context-menu,toast,tooltip').split(',').filter(Boolean);
const files = [
  ...FOLDERS.map((folder) => join(root, 'src', 'smart', folder, 'probe.json')).filter((file) => existsSync(file)),
  ...process.argv.slice(3).map((file) => resolve(file)),
];
const probes = files.map((file) => ({file, probe: JSON.parse(readFileSync(file, 'utf8'))}));

let current = '';
const page = (probe) => `<!doctype html><html lang="${probe.page.lang || 'ru'}" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
${[].concat(probe.page.body).join('\n')}
</body></html>`;

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.html': 'text/html'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
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
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': `${type}${['.js', '.mjs', '.css', '.json', '.html'].includes(extname(file)) ? '; charset=utf-8' : ''}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b) || String(a) === String(b);
const subset = (actual, want) => {
  if (want === null || typeof want !== 'object') return same(actual, want);
  if (actual === null || typeof actual !== 'object') return false;
  return Object.entries(want).every(([key, value]) => subset(actual[key], value));
};
const failures = [];
const results = {};
const browser = await chromium.launch();

async function runProbe(tab, pr) {
  const notes = [];
  for (const [n, step] of pr.steps.entries()) {
    const at = `step ${n + 1}`;
    const expect = step.expect ?? {};
    const names = [...new Set([...[].concat(expect.event ?? []), ...[].concat(expect.events ?? []).map((one) => one.name)])];
    await tab.evaluate(({names, clear}) => {
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
        const found = await tab.evaluate((selector) => {
          const target = document.querySelector(selector);
          if (!target) return false;
          target.focus?.();
          target.click();
          return true;
        }, arg);
        if (!found) { notes.push(`${at}: no «${arg}»`); continue; }
      }
      if (kind === 'keyboard') await tab.keyboard.press(arg);
    }
    if (step.action) {
      returns = await tab.evaluate(async ({selector, name, given}) => {
        const element = document.querySelector(selector);
        const method = name.replace(/-([a-z])/gu, (_, c) => c.toUpperCase());
        if (typeof element?.[method] !== 'function') return `no method ${method}`;
        const result = await element[method](...(given === undefined ? [] : [given]));
        return result === element ? 'element' : result;
      }, {selector: step.target, name: step.action.name, given: step.action.with});
    }
    if (step.script) {
      returns = await tab.evaluate(async (code) => {
        // eslint-disable-next-line no-new-func
        return await new Function(`return (async () => (${code}))();`)();
      }, step.script);
    }
    await tab.waitForTimeout(step.wait ?? 450);
    const seen = await tab.evaluate(({values, focus, target, check}) => {
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
    for (const [path, value] of Object.entries(expect.values ?? {})) if (!same(seen.values[path], value)) notes.push(`${at}: ${path} = ${JSON.stringify(seen.values[path])}, expected ${JSON.stringify(value)}`);
    for (const name of [].concat(expect.event ?? [])) {
      const got = seen.heard.find((one) => one.name === name);
      if (!got) { notes.push(`${at}: no ${name}`); continue; }
      for (const [key, value] of Object.entries(expect.detail ?? {})) if (!same(got.detail?.[key], value)) notes.push(`${at}: ${name}.${key} = ${JSON.stringify(got.detail?.[key] ?? null)}, expected ${JSON.stringify(value)}`);
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
      else for (const [key, value] of Object.entries(want)) if (!same(found[0][key], value)) notes.push(`${at}: journal ${want.from}.${key} ${JSON.stringify(found[0][key])}`);
    }
    if (seen.inside === false) notes.push(`${at}: focus not inside ${step.target} (${seen.active})`);
    if (seen.returned === false) notes.push(`${at}: focus on ${seen.active}, expected ${step.focus.slice('expect returned to '.length)}`);
    if (step.check && seen.held !== true) notes.push(`${at}: does not hold${typeof seen.held === 'string' ? ` (${seen.held})` : ''}: ${step.check}`);
  }
  return notes;
}

try {
  for (const {file, probe} of probes) {
    current = page(probe);
    const tags = [...new Set([...current.matchAll(/<(sf-[a-z-]+)/gu)].map((m) => m[1]))];
    const passed = [];
    for (const pr of probe.probes) {
      const tab = await browser.newPage({locale: 'ru-RU', viewport: {width: 1280, height: 800}});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      let notes;
      try {
        await tab.goto(`${base}/page`);
        await tab.waitForFunction((tags) => tags.every((tag) => customElements.get(tag)), tags, {timeout: 20000});
        await tab.waitForTimeout(400);
        notes = await runProbe(tab, pr);
      } catch (error) {
        notes = [`error: ${error.message.split('\n')[0]}`];
      }
      if (errors.length) notes.push(`page errors: ${errors.join(' | ')}`);
      if (notes.length) failures.push({probe: probe.component ?? file, check: pr.id, notes});
      else passed.push(pr.id);
      await tab.close();
    }
    results[`${probe.component ?? file}${file.startsWith(join(root, 'src')) ? '' : ` (${file.split('/').slice(-2).join('/')})`}`] = `${passed.length}/${probe.probes.length}`;
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
console.log('OVERLAYS_MANIFEST_OK');
