#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [/absolute/path/to/shots]
//
// The Framework parts the list head (DEV order msg-d56fa72b, owner decisions
// C299-C301) and the Larena record forms (msg-9e7b5015) asked for, on the
// built bytes through the loader, at 1440 and 390, light and dark, three
// loads each:
//   - sf-button overflow="truncate" (FW-LH-1, C301 (2)): a long label is cut
//     with an ellipsis at max-width (or the container), the icons keep their
//     size, the Framework tooltip says the whole label (the host's title when
//     there is one) on hover and keyboard focus, no browser title is drawn
//     over it, a label that fits has no tooltip, a button without overflow is
//     as before;
//   - one look vocabulary for every field: sf-input, sf-input-textarea,
//     sf-dropdown, sf-input-date and sf-input-quantity in appearance bordered
//     and filled side by side draw the same border and the same fill; the
//     former names (sf-dropdown appearance="outlined", sf-input-date
//     input-type="filled") draw as bordered and filled and are said once each
//     in the console;
//   - an interactive tag in an sf-tag-group that selects is not a toggle;
//   - sf-popover opens and closes by its open attribute and leaves the page's
//     data-open alone;
//   - no console error, no warning but the two intended ones, no sideways
//     scroll.
// SF_PROBE_CHANNEL=chrome runs the installed Chrome (scrollbars drawn).
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const shots = process.argv[3] ? resolve(process.argv[3]) : '';
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const LONG = 'Фильтр: Просроченные задачи отдела продаж за квартал';
const TITLE = 'Фильтр: Мои просроченные (изменён, не сохранён)';
const LOOKS = ['bordered', 'filled'];
const field = (tag, look, extra = '') => {
  const look_ = `appearance="${look}"`;
  if (tag === 'sf-input') return `<sf-input data-field="input|${look}" ${look_} label="Название" value="Договор"${extra}></sf-input>`;
  if (tag === 'sf-input-number') return `<sf-input data-field="number|${look}" ${look_} type="number" label="Сумма" value="1200"${extra}></sf-input>`;
  if (tag === 'sf-input-textarea') return `<sf-input-textarea data-field="textarea|${look}" ${look_} label="Описание" rows="2" value="Текст"${extra}></sf-input-textarea>`;
  if (tag === 'sf-dropdown') return `<sf-dropdown data-field="dropdown|${look}" ${look_} label="Статус" placeholder="Выберите" options='[{"value":"new","label":"Новая"},{"value":"done","label":"Готова"}]'${extra}></sf-dropdown>`;
  if (tag === 'sf-input-date') return `<sf-input-date data-field="date|${look}" ${look_} label="Срок" value="2026-11-17"${extra}></sf-input-date>`;
  if (tag === 'sf-input-quantity') return `<sf-input-quantity data-field="quantity|${look}" ${look_} label="Количество" value="3"${extra}></sf-input-quantity>`;
  return '';
};
const TAGS = ['sf-input', 'sf-input-number', 'sf-input-textarea', 'sf-dropdown', 'sf-input-date', 'sf-input-quantity'];
const BODY = `<main style="padding:16px;display:flex;flex-direction:column;gap:24px;box-sizing:border-box;max-inline-size:100%">
<section id="trunc" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-inline-size:0">
  <sf-button id="t-long" overflow="truncate" max-width="16rem" appearance="outline" scheme="on-surface" icon-start="filter_list" icon-end="expand_more" text="${LONG}"></sf-button>
  <sf-button id="t-short" overflow="truncate" max-width="16rem" appearance="outline" scheme="on-surface" icon-start="filter_list" text="Фильтр"></sf-button>
  <sf-button id="t-title" overflow="truncate" max-width="10rem" title="${TITLE}" text="Фильтр: Мои просроченные"></sf-button>
  <sf-button id="t-plain" appearance="tonal" text="Создать"></sf-button>
</section>
<section id="narrow" style="inline-size:9rem;display:flex">
  <sf-button id="t-container" overflow="truncate" appearance="outline" scheme="on-surface" text="${LONG}"></sf-button>
</section>
<section id="looks" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:16px;align-items:start">
  ${LOOKS.map((look) => TAGS.map((tag) => field(tag, look)).join('\n')).join('\n')}
  <sf-dropdown data-field="dropdown|outlined" appearance="outlined" label="Статус (outlined)" placeholder="Выберите" options='[{"value":"new","label":"Новая"}]'></sf-dropdown>
  <sf-input-date data-field="date|input-type-filled" input-type="filled" label="Срок (input-type)" value="2026-11-17"></sf-input-date>
</section>
<section id="tags">
  <sf-tag-group id="group" selection="many">
    <sf-tag id="tag-int" interactive text="Статус: 2"></sf-tag>
    <sf-tag id="tag-flt" kind="checkbox" text="Мои"></sf-tag>
  </sf-tag-group>
</section>
<section id="pop">
  <sf-popover id="popover" data-open="page-owned" placement="bottom-start" label="Фильтр">
    <sf-button slot="trigger" text="Открыть"></sf-button>
    <div slot="content" id="pop-content">Содержимое</div>
  </sf-popover>
</section>
</main>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,"><link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body style="margin:0">${BODY}</body></html>`;
const pages = {'/light': pageOf('light'), '/dark': pageOf('dark')};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
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
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

// The box a field draws its look on, per tag.
const measure = () => {
  const BOX = ['.sf-dropdown-field', '.sf-quantity-wrap', '.sf-input-field', 'textarea'];
  const box = (host) => {
    for (const selector of BOX) {
      const found = host.querySelector(selector);
      if (found) return found;
    }
    return null;
  };
  const read = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      cls: element.className.toString().split(/\s+/u).filter((name) => /--(bordered|filled|outlined|hidden)$/u.test(name)).join(' '),
      borderTop: style.borderTopWidth, borderBottom: style.borderBottomWidth,
      borderColor: style.borderTopColor, bottomColor: style.borderBottomColor,
      background: style.backgroundColor, height: Math.round(rect.height),
    };
  };
  const fields = Object.fromEntries([...document.querySelectorAll('[data-field]')].map((host) => [host.dataset.field, read(box(host))]));
  const button = (id) => {
    const host = document.getElementById(id);
    const inner = host?.querySelector(':scope > .sf-button, :scope > .sf-button-split > .sf-button');
    const label = inner?.querySelector(':scope > .sf-button-text-container');
    const tipId = inner?.getAttribute('data-tooltip') || '';
    const tip = tipId ? document.getElementById(tipId) : null;
    const icons = [...(inner?.querySelectorAll(':scope > sf-icon > .sf-icon, :scope > .sf-icon') ?? [])].map((icon) => Math.round(icon.getBoundingClientRect().width));
    return inner ? {
      width: Math.round(inner.getBoundingClientRect().width),
      cut: label ? label.scrollWidth - label.clientWidth > 0.5 : false,
      ellipsis: label ? getComputedStyle(label).textOverflow : '',
      whiteSpace: label ? getComputedStyle(label).whiteSpace : '',
      truncateClass: inner.classList.contains('sf-button--truncate'),
      title: inner.getAttribute('title'),
      tooltip: tip ? tip.textContent.trim() : null,
      // The label's own words (with icons off, an icon's ligature is text).
      name: label ? label.textContent.replace(/\s+/gu, ' ').trim() : '',
      icons,
    } : null;
  };
  const tag = document.getElementById('tag-int');
  const tagButton = tag?.querySelector('.sf-tag-action, button');
  const popover = document.getElementById('popover');
  return {
    fields,
    buttons: Object.fromEntries(['t-long', 't-short', 't-title', 't-plain', 't-container'].map((id) => [id, button(id)])),
    tag: {kind: tag?.kind, cls: tag?.querySelector('.sf-tag')?.className ?? '', pressed: tagButton?.getAttribute('aria-pressed') ?? null},
    popover: {dataOpen: popover?.getAttribute('data-open'), open: popover?.hasAttribute('open'), shown: (document.getElementById('pop-content')?.getClientRects().length ?? 0) > 0},
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

const visibleTips = () => [...document.querySelectorAll('.sf-button-tooltip')]
  .filter((tip) => !tip.hidden && tip.getBoundingClientRect().width > 0 && getComputedStyle(tip).visibility !== 'hidden')
  .map((tip) => tip.textContent.trim());

const launch = process.env.SF_PROBE_CHANNEL
  ? {headless: true, channel: process.env.SF_PROBE_CHANNEL, ignoreDefaultArgs: ['--hide-scrollbars']}
  : {headless: true};
const browser = await chromium.launch(launch);
const failures = [];
const runs = [];
const INTENDED = [/sf-dropdown: appearance="outlined" is a former name/u, /sf-input-date: input-type is a former name/u];
try {
  if (shots) await mkdir(shots, {recursive: true});
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    for (const theme of ['light', 'dark']) {
      for (let load = 1; load <= 3; load += 1) {
        const where = `${width} ${theme} load ${load}`;
        const context = await browser.newContext({viewport: {width, height}, colorScheme: theme});
        const page = await context.newPage();
        const errors = [];
        const warnings = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
          if (message.type() === 'warning') warnings.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.goto(`${origin}/${theme}`);
        await page.waitForFunction(() => ['sf-button', 'sf-input', 'sf-dropdown', 'sf-input-date', 'sf-tag', 'sf-popover', 'sf-input-quantity', 'sf-input-textarea']
          .every((name) => customElements.get(name)) && document.querySelector('#t-long > .sf-button') && document.querySelector('[data-field="date|filled"] .sf-input'), null, {timeout: 20000});
        await page.waitForTimeout(1200);
        const first = await page.evaluate(measure);
        // Hover the cut label: the tooltip after the controller's delay.
        await page.hover('#t-long > .sf-button');
        await page.waitForTimeout(1100);
        const hovered = await page.evaluate(visibleTips);
        // Away first: at 390 the long label's tooltip lies over the short button.
        await page.mouse.move(2, height - 2);
        await page.waitForTimeout(400);
        await page.hover('#t-short > .sf-button');
        await page.waitForTimeout(900);
        const hoveredShort = await page.evaluate(visibleTips);
        await page.mouse.move(2, height - 2);
        await page.waitForTimeout(400);
        // Keyboard focus on the titled one.
        await page.focus('#t-title > .sf-button');
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);
        const focused = await page.evaluate(visibleTips);
        await page.keyboard.press('Escape');
        // The interactive tag: a press opens nothing here, and toggles nothing.
        await page.click('#tag-int .sf-tag-action, #tag-int button');
        await page.waitForTimeout(200);
        const tagAfter = await page.evaluate(() => ({active: document.getElementById('tag-int').hasAttribute('active'), pressed: document.querySelector('#tag-int button')?.getAttribute('aria-pressed') ?? null}));
        // The popover: open and close by its action, the page's data-open stays.
        await page.evaluate(() => document.getElementById('popover').show?.() ?? document.getElementById('popover').setAttribute('open', ''));
        await page.waitForTimeout(300);
        const popOpen = await page.evaluate(() => ({dataOpen: document.getElementById('popover').getAttribute('data-open'), open: document.getElementById('popover').hasAttribute('open'), shown: document.getElementById('pop-content').getClientRects().length > 0}));
        await page.evaluate(() => document.getElementById('popover').removeAttribute('open'));
        await page.waitForTimeout(300);
        const popClosed = await page.evaluate(() => ({dataOpen: document.getElementById('popover').getAttribute('data-open'), open: document.getElementById('popover').hasAttribute('open'), shown: document.getElementById('pop-content').getClientRects().length > 0}));
        if (shots && load === 1) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.hover('#t-long > .sf-button');
          await page.waitForTimeout(1100);
          await page.screenshot({path: join(shots, `${width}-${theme}.png`), fullPage: true});
        }
        await context.close();

        const run = {where, first, hovered, hoveredShort, focused, tagAfter, popOpen, popClosed, errors, warnings};
        runs.push(run);
        const fail = (check, got) => failures.push({where, check, got});
        const b = first.buttons;
        const max = 16 * 16;
        if (!b['t-long']?.truncateClass || !b['t-long'].cut || b['t-long'].width > max + 0.5 || b['t-long'].ellipsis !== 'ellipsis' || b['t-long'].whiteSpace !== 'nowrap') fail('long label cut at max-width with an ellipsis', b['t-long']);
        if (b['t-long']?.tooltip !== LONG || b['t-long']?.name !== LONG) fail('tooltip and name say the whole label', b['t-long']);
        if ((b['t-long']?.icons ?? []).some((size) => size < 12)) fail('icons keep their size', b['t-long']?.icons);
        if (!hovered.includes(LONG)) fail('hover shows the whole label', hovered);
        if (b['t-short']?.cut || b['t-short']?.tooltip !== null || hoveredShort.length) fail('a label that fits has no tooltip', {button: b['t-short'], hoveredShort});
        if (b['t-title']?.tooltip !== TITLE || b['t-title']?.title !== '') fail('a cut label with a title: the tooltip says the title, no browser title', b['t-title']);
        if (!focused.includes(TITLE)) fail('keyboard focus shows the tooltip', focused);
        if (b['t-plain']?.truncateClass || b['t-plain']?.tooltip !== null) fail('a button without overflow is as before', b['t-plain']);
        if (!b['t-container']?.cut || b['t-container'].width > 9 * 16 + 0.5) fail('without max-width the container is the limit', b['t-container']);
        const f = first.fields;
        for (const look of LOOKS) {
          const ref = f[`input|${look}`];
          for (const name of ['number', 'textarea', 'dropdown', 'date', 'quantity']) {
            const got = f[`${name}|${look}`];
            if (!got || !ref) { fail(`${name} ${look} drawn`, got); continue; }
            const same = look === 'bordered'
              ? got.borderTop === ref.borderTop && got.borderColor === ref.borderColor
              : got.background === ref.background && got.bottomColor === ref.bottomColor && got.borderTop === ref.borderTop;
            if (!same) fail(`${name} ${look} looks like sf-input ${look}`, {ref, got});
          }
        }
        if (f['input|bordered']?.borderTop === '0px') fail('bordered has a border', f['input|bordered']);
        if (f['input|filled']?.background === f['input|bordered']?.background) fail('filled has a fill bordered has not', [f['input|filled'], f['input|bordered']]);
        if (JSON.stringify(f['dropdown|outlined']) !== JSON.stringify(f['dropdown|bordered'])) fail('outlined draws as bordered', [f['dropdown|outlined'], f['dropdown|bordered']]);
        if (JSON.stringify(f['date|input-type-filled']) !== JSON.stringify(f['date|filled'])) fail('input-type="filled" draws as appearance="filled"', [f['date|input-type-filled'], f['date|filled']]);
        if (first.tag.kind === 'checkbox' || /sf-tag--checkbox/u.test(first.tag.cls) || first.tag.pressed !== null || tagAfter.active || tagAfter.pressed !== null) fail('an interactive tag in a selecting group is not a toggle', {tag: first.tag, tagAfter});
        if (first.popover.dataOpen !== 'page-owned' || popOpen.dataOpen !== 'page-owned' || popClosed.dataOpen !== 'page-owned') fail('the page keeps its data-open', {first: first.popover, popOpen, popClosed});
        if (!popOpen.open || !popOpen.shown || popClosed.open || popClosed.shown || first.popover.shown) fail('the popover shows by its open attribute', {first: first.popover, popOpen, popClosed});
        if (first.sideways > 0) fail('no sideways scroll', first.sideways);
        if (errors.length) fail('no console error', errors);
        const unintended = warnings.filter((text) => !INTENDED.some((pattern) => pattern.test(text)));
        if (unintended.length) fail('no warning but the intended ones', unintended);
        for (const pattern of INTENDED) {
          const count = warnings.filter((text) => pattern.test(text)).length;
          if (count !== 1) fail(`intended warning once: ${pattern.source}`, count);
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({runs: runs.map(({where, first, hovered, focused, tagAfter, popOpen, popClosed, errors, warnings}) => ({where, buttons: first.buttons, fields: first.fields, tag: first.tag, tagAfter, popover: [first.popover, popOpen, popClosed], hovered, focused, sideways: first.sideways, errors, warnings})), failures}, null, 1));
if (failures.length) {
  console.error(`list-head-parts-c301: ${failures.length} failing check(s)`);
  for (const failure of failures.slice(0, 40)) console.error(`  ${failure.where}: ${failure.check}`);
  process.exit(1);
}
console.error(`list-head-parts-c301: ${runs.length} loads green`);
