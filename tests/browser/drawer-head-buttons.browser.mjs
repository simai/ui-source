#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [/absolute/path/to/shots]
//   (a build output root with core/core, smart/smart, ... or a distr folder)
//
// Owner decision C205 (prototype ui-control prototypes/drawer-headings-study.html):
// (2) a button a page or a set puts into a drawer's head -- slot="header-action",
//     or slot="edge" once the edge controls come into the head's row -- is
//     size="1/3", the step of the sf-button-close beside it. The base does not
//     resize the page's buttons, so this gate goes red when any button in the
//     head (or on the edge beside it) is taller than the close, and proves it
//     can: a page that wrote no size must be caught at every width;
// (1) the headings of the panel's content stand one rung below its title, all
//     of one size (1440: title 20, content 16; 390: 16 and 14).
// At 1440 normal, 1440 compact and 390, light and dark, three loads each,
// with no console error, warning or failed request.
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root (or a distr folder) is required');
const out = resolve(process.argv[2]);
const shots = process.argv[3] ? resolve(process.argv[3]) : '';
const nested = existsSync(join(out, 'core', 'core', 'js', 'core.js'));
const mounts = nested
  ? [['/distr/core/', join(out, 'core', 'core')], ['/distr/rule/', join(out, 'core', 'rule')],
    ['/distr/component/', join(out, 'component', 'component')], ['/distr/utility/', join(out, 'utility', 'utility')],
    ['/distr/smart/', join(out, 'smart', 'smart')]]
  : [['/distr/', out]];
const core = nested ? join(out, 'core', 'core') : join(out, 'core');
const absent = [join(core, 'js', 'core.js'), join(core, 'css', 'core.css')].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

const BODY = `<h1>Покупатель</h1><p>Анна Смирнова</p><h2>Доставка</h2><p>Курьером, 18 ноября</p>
  <h3>Адрес</h3><p>Екатеринбург, ул. Ленина, 5</p><h4>Комментарий</h4><p>Позвонить за час</p>`;
const action = (size) => `<sf-button-icon slot="header-action" icon="edit"${size ? ` size="${size}"` : ''} appearance="ghost"
    scheme="on-surface" aria-label="Изменить"></sf-button-icon>`;
const edge = (size) => `<sf-button-icon slot="edge" icon="open_in_full"${size ? ` size="${size}"` : ''} appearance="tonal" scheme="on-surface" aria-label="Открыть полностью"></sf-button-icon>
  <sf-button-icon slot="edge" icon="link"${size ? ` size="${size}"` : ''} appearance="tonal" scheme="on-surface" aria-label="Ссылка"></sf-button-icon>`;
// Every case: whether the head must hold (ok) or the gate must catch it.
const CASES = {
  // The documented header action, on the close's step.
  action: {ok: true, drawer: `<sf-drawer id="d" heading="Заказ 1042" size="1">${action('1/3')}${BODY}</sf-drawer>`},
  // A record window's edge controls: outside beside a panel with room
  // (1440), in the head's row where the panel fills the screen (390).
  edge: {ok: true, drawer: `<sf-drawer id="d" heading="Заказ 1042" size="1" close-placement="outside">${edge('1/3')}${BODY}</sf-drawer>`},
  // The whole screen: the edge controls are in the head at every width.
  'edge-full': {ok: true, drawer: `<sf-drawer id="d" heading="Заказ 1042" size="full" close-placement="outside">${edge('1/3')}${BODY}</sf-drawer>`},
  // What the base leaves to the page: no size written -- the gate must see it.
  'action-unsized': {ok: false, drawer: `<sf-drawer id="d" heading="Заказ 1042" size="1">${action('')}${BODY}</sf-drawer>`},
  'edge-full-unsized': {ok: false, drawer: `<sf-drawer id="d" heading="Заказ 1042" size="full" close-placement="outside">${edge('')}${BODY}</sf-drawer>`},
};
const pageOf = (drawer) => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  const query = new URLSearchParams(location.search);
  document.documentElement.classList.add(query.get('theme') === 'dark' ? 'theme-dark' : 'theme-light');
  if (query.get('density') === 'compact') document.documentElement.setAttribute('data-sf-density', 'compact');
  window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};
</script>
<script src="/distr/core/js/core.js"></script></head><body><main><p>Страница</p></main>
${drawer}
<script>customElements.whenDefined('sf-drawer').then(() => requestAnimationFrame(() => document.getElementById('d').open()));</script>
</body></html>`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const name = path.match(/^\/case\/([a-z-]+)\.html$/u)?.[1];
  if (name && CASES[name]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pageOf(CASES[name].drawer));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

// The gate itself: every visible button in the head, and on the edge beside
// it, against the close. A button taller than the close by more than half a
// pixel is a page button of a larger step.
const read = () => {
  const root = document.querySelector('[data-sf-drawer-root][data-sf-drawer-id="d"]');
  const panel = root?.querySelector('[data-sf-drawer-panel]');
  const close = root?.querySelector('button.sf-drawer-close');
  const box = (node) => node.getBoundingClientRect();
  const shown = (node) => { const r = box(node); return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden'; };
  const head = root?.querySelector('.sf-drawer-head');
  const edgeArea = root?.querySelector('[data-sf-drawer-edge]');
  const buttons = [head, edgeArea].filter(Boolean)
    .flatMap((area) => [...area.querySelectorAll('button, a[href], [role="button"]')])
    .filter((node) => node !== close && shown(node));
  const closeBox = close ? box(close) : null;
  const offenders = closeBox
    ? buttons.filter((node) => box(node).height > closeBox.height + 0.5)
      .map((node) => `${node.closest('[aria-label]')?.getAttribute('aria-label') || node.textContent.trim()} ${Math.round(box(node).height)} > ${Math.round(closeBox.height)}`)
    : [];
  const size = (node) => Math.round(parseFloat(getComputedStyle(node).fontSize));
  const title = root?.querySelector('.sf-drawer-title');
  const titleBox = title ? box(title) : null;
  return {
    open: Boolean(panel && root.classList.contains('is-open')),
    inHead: root?.hasAttribute('data-sf-drawer-edge-in-head') ?? false,
    close: closeBox ? Math.round(closeBox.height) : null,
    buttons: buttons.map((node) => Math.round(box(node).height)),
    // Buttons standing in the head's row: their middle inside the title's row.
    inRow: titleBox ? buttons.filter((node) => { const r = box(node); return r.top + r.height / 2 > titleBox.top && r.top + r.height / 2 < titleBox.bottom; }).length : 0,
    offenders,
    title: title ? size(title) : null,
    headings: [...(root?.querySelectorAll('.sf-drawer-body :is(h1, h2, h3, h4)') ?? [])].map(size),
    sideways: document.documentElement.scrollWidth > innerWidth,
  };
};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const VIEWS = [['1440', {width: 1440, height: 900}, 'normal'], ['1440 compact', {width: 1440, height: 900}, 'compact'], ['390', {width: 390, height: 844}, 'normal']];
const facts = {};
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
if (shots) await mkdir(shots, {recursive: true});
const browser = await chromium.launch();
try {
  for (const [name, spec] of Object.entries(CASES)) {
    for (const [view, viewport, density] of VIEWS) {
      for (const theme of ['light', 'dark']) {
        for (let load = 1; load <= 3; load += 1) {
          const label = `${name} ${view} ${theme} load ${load}`;
          const context = await browser.newContext({viewport, deviceScaleFactor: 1, locale: 'ru-RU', colorScheme: theme});
          const page = await context.newPage();
          const noise = [];
          page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) noise.push(`${message.type()}: ${message.text()}`); });
          page.on('pageerror', (error) => noise.push(`pageerror: ${error.message}`));
          page.on('response', (response) => { if (response.status() >= 400) noise.push(`${response.status()} ${response.url()}`); });
          await page.goto(`${base}/case/${name}.html?theme=${theme}&density=${density}`);
          await page.waitForFunction(() => document.querySelector('[data-sf-drawer-id="d"].is-open button.sf-drawer-close'), null, {timeout: 10000}).catch(() => {});
          await page.waitForTimeout(700);
          const got = await page.evaluate(read);
          if (load === 1) facts[`${name} ${view} ${theme}`] = got;
          if (shots && load === 1) await page.screenshot({path: join(shots, `${name}-${view.replace(' ', '-')}-${theme}.png`)});
          check(got.open && got.close, `${label}: the drawer did not open with a close (${JSON.stringify(got)})`);
          check(noise.length === 0, `${label}: console ${noise.join(' | ')}`);
          check(!got.sideways, `${label}: the page scrolls sideways`);
          check(got.buttons.length >= 1, `${label}: no page button found in the head or on the edge`);
          if (spec.ok) check(got.offenders.length === 0, `${label}: a head button is taller than the close (C205 (2)): ${got.offenders.join('; ')}`);
          else check(got.offenders.length > 0, `${label}: the gate did not catch an unsized head button (${JSON.stringify(got.buttons)} vs close ${got.close})`);
          // Where the edge comes into the head, its buttons stand in the title's row.
          if (name.startsWith('edge-full') || (name === 'edge' && view === '390')) {
            check(got.inHead && got.inRow === got.buttons.length, `${label}: the edge controls are not in the head's row (inHead ${got.inHead}, in row ${got.inRow}/${got.buttons.length})`);
          }
          if (name === 'edge' && view !== '390') check(!got.inHead, `${label}: the edge came into the head beside a panel with room`);
          // C205 (1): content headings one rung below the title, one size.
          check(new Set(got.headings).size === 1 && got.headings.length === 4, `${label}: content headings ${got.headings.join('/')} are not one size`);
          check(got.headings[0] < got.title, `${label}: content heading ${got.headings[0]} is not below the title ${got.title}`);
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
const wanted = {'1440': [20, 16], '1440 compact': [20, 16], '390': [16, 14]};
for (const [view, [title, heading]] of Object.entries(wanted)) {
  const got = facts[`action ${view} light`];
  check(got?.title === title && got?.headings[0] === heading, `action ${view}: title ${got?.title} / content ${got?.headings?.[0]}, wanted ${title} / ${heading} (C205 (1))`);
}

console.log(JSON.stringify(facts, null, 2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('drawer head buttons (C205): page buttons in the head and on the edge are no taller than the close, an unsized one is caught, content headings one rung below the title -- 1440, 1440 compact, 390, light and dark, three loads');
