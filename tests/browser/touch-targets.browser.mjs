#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Touch screens rule 12 (docs/foundation-touch-screens.md; DEV decision on the
// coarse-pointer target size, group build 19), served through the loader:
//   - 390 px, a touch phone (coarse pointer, no fine one), real taps:
//     stacked rows -- sf-settings panel rows of size 1/2, sf-tabs pills and
//     line of size 1/2, sf-menu rows, sf-list rows of size 1/2 -- are at
//     least 44 high, and a tap at the centre and at the top and bottom edge of
//     each row reaches that row (a settings switch row turns on, off, on);
//   - isolated controls -- bare sf-checkbox, sf-switch, sf-radio,
//     sf-button-icon of sizes 1/2 and 1 -- keep their drawn size, and the
//     page's hit test and a real tap at the centre and at each edge of the
//     44 area name and change that control (a check box and a switch on, then
//     off);
//   - clipping: in a toolbar with no gap a tap on a button's own box beside
//     its neighbour reaches that button, never the neighbour;
//   - the rule check: controls whose 44 areas meet are listed; only the tight
//     toolbar (gap 0, the expected finding) is;
//   - the stacking check (GB20, DEV on the touch-size part): a popup drawn
//     inside the parent that the coarse-pointer rule makes a stacking context
//     (isolation: isolate) is listed -- it would stay under a later
//     positioned sibling; only the page's own bad popup (#bad-pop) is, and an
//     sf-menu-context written inside such a row is not (it opens in the top
//     layer);
//   - sf-menu rows touch (GB20, DEV N1): no gap between two rows of a column,
//     and a tap on the line between two rows reaches a row, never nothing;
//   - 1440 px, a fine pointer (mouse): the rows keep the ladder's heights and
//     3 px outside a control's drawn box reaches nothing.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'),
  smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/lang/ru.js"></script><script src="/distr/core/js/core.js"></script>
<style>html,body{background:var(--sf-surface-page);margin:0}body{padding:16px;box-sizing:border-box;display:flex;flex-direction:column;gap:24px;align-items:flex-start}
.page-box{inline-size:100%;max-inline-size:358px}.page-row{display:flex;align-items:center;gap:var(--sf-d1);padding-block:var(--sf-space-1)}.page-toolbar{display:flex;align-items:center;gap:var(--sf-space-0)}</style></head><body>
<div class="page-box" id="b-settings"><sf-settings id="settings" look="panel" size="1/2" label="Вид"></sf-settings></div>
<div class="page-box" id="b-pills"><sf-tabs id="pills" type="pills" size="1/2" aria-label="Пилюли" items='[{"id":"a","label":"Первая"},{"id":"b","label":"Вторая"},{"id":"c","label":"Третья"}]'></sf-tabs></div>
<div class="page-box" id="b-line"><sf-tabs id="line" size="1/2" aria-label="Линия" items='[{"id":"a","label":"Первая"},{"id":"b","label":"Вторая"},{"id":"c","label":"Третья"}]'></sf-tabs></div>
<div class="page-box" id="b-menu"><sf-menu id="menu" label="Меню" items='[{"id":"m1","label":"Заказы"},{"id":"m2","label":"Клиенты"},{"id":"m3","label":"Отчёты"}]'></sf-menu></div>
<div class="page-box" id="b-list"><sf-list id="list" size="1/2" label="Строки"></sf-list></div>
<div class="page-row" id="b-checks"><sf-checkbox id="c1" size="1/2" aria-label="Первая"></sf-checkbox><sf-checkbox id="c2" size="1/2" aria-label="Вторая"></sf-checkbox><sf-checkbox id="c3" size="1" aria-label="Третья"></sf-checkbox></div>
<div class="page-row" id="b-switches"><sf-switch id="w1" size="1/2" aria-label="Первый"></sf-switch><sf-switch id="w2" size="1" aria-label="Второй"></sf-switch></div>
<div class="page-row" id="b-radios"><sf-radio id="r1" name="r" value="1" size="1/2" aria-label="Один"></sf-radio><sf-radio id="r2" name="r" value="2" size="1/2" aria-label="Два"></sf-radio></div>
<div class="page-toolbar" id="b-icons"><sf-button-icon id="i1" icon="add" size="1/2" appearance="ghost" scheme="on-surface" aria-label="Добавить"></sf-button-icon><sf-button-icon id="i2" icon="edit" size="1/2" appearance="ghost" scheme="on-surface" aria-label="Изменить"></sf-button-icon><sf-button-icon id="i3" icon="delete" size="1/2" appearance="ghost" scheme="on-surface" aria-label="Удалить"></sf-button-icon></div>
<div class="page-row" id="b-pop" style="position:relative"><sf-checkbox id="p1" size="1/2" aria-label="Фильтр"></sf-checkbox><div id="bad-pop" role="listbox" aria-label="Список" style="position:absolute;inset-inline-start:0;inset-block-start:100%;inline-size:120px;block-size:40px;background:var(--sf-surface-1)"></div></div>
<div class="page-row" id="b-menu-row" style="position:relative"><sf-button-icon id="k1" icon="more_horiz" size="1/2" appearance="ghost" scheme="on-surface" aria-label="Ещё"></sf-button-icon><sf-menu-context id="row-menu" popup aria-label="Ещё" entries='[{"id":"a","text":"Изменить"},{"id":"b","text":"Удалить"}]'></sf-menu-context></div>
<div class="page-row" id="b-icons1"><sf-button-icon id="j1" icon="add" size="1" appearance="ghost" scheme="on-surface" aria-label="Добавить"></sf-button-icon><sf-button-icon id="j2" icon="edit" size="1" appearance="ghost" scheme="on-surface" aria-label="Изменить"></sf-button-icon></div>
<script>
window.__events = [];
function log(e) { window.__events.push(e); }
customElements.whenDefined('sf-settings').then(function () {
  var s = document.getElementById('settings');
  s.items = [{type: 'group', text: 'Вид', items: [
    {id: 'nowrap', type: 'switch', text: 'Текст в одну строку', value: false},
    {id: 'grid', type: 'switch', text: 'Линии между столбцами', value: false},
    {id: 'zebra', type: 'switch', text: 'Полосы', value: false}]}];
  s.addEventListener('sf-settings-changed', function (e) { log({el: 'settings', id: e.detail.id, value: e.detail.value}); });
});
customElements.whenDefined('sf-list').then(function () {
  var l = document.getElementById('list');
  l.items = [{id: 'a', title: 'Первая'}, {id: 'b', title: 'Вторая'}, {id: 'c', title: 'Третья'}];
});
document.addEventListener('click', function (e) {
  var t = e.target, h = t.closest && t.closest('sf-button-icon, sf-checkbox, sf-switch, sf-radio, .sf-menu-element, sf-list-item, [role="tab"], .sf-tabs-top .sf-button, .sf-settings-row');
  if (!h) return;
  var id = h.id || h.getAttribute('data-sf-tab-index') || h.textContent.trim().slice(0, 30);
  log({el: 'click', host: h.tagName.toLowerCase(), id: id});
}, true);
Promise.all(['sf-settings', 'sf-tabs', 'sf-menu', 'sf-list', 'sf-checkbox', 'sf-switch', 'sf-radio', 'sf-button-icon', 'sf-menu-context'].map(function (n) { return customElements.whenDefined(n); }))
  .then(function () { setTimeout(function () { window.__ready = true; }, 600); });
</script>
</body></html>`;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const LOADS = 1;
const CONF = [['390', 'light'], ['390', 'dark'], ['1440', 'light']];
const HIT = 44;
const FINE_ROWS = {settings: 32, pills: 32, line: 32, menu: 40, list: 32};
const b = await chromium.launch();
const out2 = {runs: [], bad: [], ruleCheck: []};
const check = (run, name, ok, data) => { run.checks.push({name, ok, data}); if (!ok) out2.bad.push(`${run.tag}: ${name} ${JSON.stringify(data)}`); };
try {
for (const [ws, theme] of CONF) for (let n = 1; n <= LOADS; n++) {
  const w = +ws, phone = w < 768;
  const ctx = await b.newContext({viewport: {width: w, height: 1100}, colorScheme: theme, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1});
  const pg = await ctx.newPage();
  const run = {tag: `${w}-${theme}#${n}`, checks: [], console: []};
  // The loader's icon subset fallback (the subset host icons.simai.io over 3000 ms, the runner's known flake
  // «icon subset font fallback») and a network failure (this page serves the build itself, so only an
  // external host fails) are the font's timing, not a target's: kept apart so they never hide another message.
  run.flakes = [];
  pg.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = `${m.type()}: ${m.text().slice(0, 160)}`;
    if (/SFLoader icon subset font fallback|Failed to load resource: net::ERR_(?:CONNECTION_TIMED_OUT|TIMED_OUT|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/u.test(text)) run.flakes.push(text); else run.console.push(text);
  });
  pg.on('pageerror', (e) => run.console.push(`pageerror ${e.message.slice(0, 160)}`));
  await pg.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`, {waitUntil: 'load'});
  await pg.waitForFunction(() => window.__ready === true, null, {timeout: 30000});
  await pg.waitForTimeout(800);
  const coarse = await pg.evaluate(() => matchMedia('(pointer: coarse) and (not (any-pointer: fine))').matches);
  check(run, `pointer word is ${phone ? 'coarse' : 'fine'}`, coarse === phone, coarse);
  const press = async (x, y) => { if (phone) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); await pg.waitForTimeout(phone ? 380 : 120); };
  const events = () => pg.evaluate(() => window.__events.length);
  const lastClick = (from) => pg.evaluate((from) => window.__events.slice(from).filter((e) => e.el === 'click').at(-1) ?? null, from);
  const boxes = (sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, text: e.textContent.trim().slice(0, 30)}; }), sel);

  // Stacked rows.
  const rows = {settings: '#settings .sf-settings-row', pills: '#pills .sf-tabs-top .sf-button', line: '#line .sf-tabs-top .sf-button', menu: '#menu .sf-menu-element', list: '#list .sf-list__row'};
  for (const [name, sel] of Object.entries(rows)) {
    await pg.locator(sel).first().scrollIntoViewIfNeeded();
    const bx = await boxes(sel);
    const hs = bx.map((r) => Math.round(r.h * 10) / 10);
    if (phone) check(run, `${name}: every row is at least ${HIT} high`, bx.length >= 3 && hs.every((h) => h >= HIT - 0.01), hs);
    if (phone && name === 'menu') {
      const gaps = bx.slice(1).map((r, i) => Math.round((r.y - (bx[i].y + bx[i].h)) * 10) / 10);
      check(run, 'menu: the rows of a column touch (no gap) under a coarse pointer', gaps.every((g) => Math.abs(g) < 0.5), gaps);
    }
    else check(run, `${name}: fine pointer keeps the ladder's ${FINE_ROWS[name]}`, bx.length >= 3 && hs.every((h) => Math.abs(h - FINE_ROWS[name]) < 0.01), hs);
  }
  // Settings: the centre and both edges of each switch row turn that row's switch (on, then off, then on again).
  {
    const bx = await boxes(rows.settings);
    const ids = ['nowrap', 'grid', 'zebra'];
    for (let i = 0; i < bx.length; i++) {
      const r = bx[i], seq = [];
      for (const y of [r.y + r.h / 2, r.y + 2, r.y + r.h - 2]) {
        const n0 = await events();
        await press(r.x + r.w / 2, y);
        const ev = await pg.evaluate((n0) => window.__events.slice(n0).find((e) => e.el === 'settings') ?? null, n0);
        seq.push(ev ? `${ev.id}=${ev.value}` : 'none');
      }
      check(run, `settings row ${ids[i]}: centre, top edge, bottom edge turn it on, off, on`, seq.join('|') === `${ids[i]}=true|${ids[i]}=false|${ids[i]}=true`, seq);
    }
  }
  // Tabs: centre and edges select that tab.
  for (const t of ['pills', 'line']) {
    const bx = await boxes(rows[t]);
    const got = [];
    for (let i = bx.length - 1; i >= 0; i--) for (const y of [bx[i].y + bx[i].h / 2, bx[i].y + 2, bx[i].y + bx[i].h - 2]) {
      await press(bx[i].x + bx[i].w / 2, y);
      got.push(await pg.evaluate((t) => [...document.querySelectorAll(`#${t} .sf-tabs-top .sf-button`)].findIndex((x) => x.classList.contains('selected')), t));
    }
    check(run, `${t}: centre, top and bottom edge of each tab select it`, got.join() === '2,2,2,1,1,1,0,0,0', got);
  }
  // Menu and list rows: centre and edges reach that row.
  for (const [t, host] of [['menu', 'div'], ['list', 'sf-list-item']]) {
    const bx = await boxes(rows[t]);
    const got = [];
    for (const r of bx) for (const y of [r.y + r.h / 2, r.y + 2, r.y + r.h - 2]) {
      const n0 = await events();
      await press(r.x + r.w / 3, y);
      const c = await lastClick(n0);
      got.push(c ? c.id : 'none');
    }
    const want = bx.flatMap((r) => [r.text, r.text, r.text]);
    check(run, `${t}: centre, top and bottom edge of each row reach that row`, got.every((g, i) => g && want[i].startsWith(g.slice(0, 6))), {got, want});
    if (phone && t === 'menu') {
      const line = [];
      for (let i = 1; i < bx.length; i++) {
        const n0 = await events();
        await press(bx[i].x + bx[i].w / 3, (bx[i - 1].y + bx[i - 1].h + bx[i].y) / 2);
        const c = await lastClick(n0);
        line.push(c ? c.id : 'none');
      }
      check(run, 'menu: a tap on the line between two rows reaches a row', line.every((g) => g !== 'none'), line);
    }
  }

  // The stacking check: a popup drawn inside a parent the coarse rule isolates.
  if (phone) {
    await pg.evaluate(() => document.getElementById('row-menu').openFor(document.getElementById('k1')));
    await pg.waitForTimeout(300);
    const stacked = await pg.evaluate(() => {
      const POPUPS = '[role="dialog"], [role="menu"], [role="listbox"], [popover], .sf-context-menu--open';
      const found = [];
      for (const pop of document.querySelectorAll(POPUPS)) {
        if (!pop.getClientRects().length) continue;
        const own = getComputedStyle(pop).position;
        if (own !== 'absolute' && own !== 'fixed') continue;
        if (pop.matches(':popover-open') || pop.matches('dialog:modal')) continue;
        for (let node = pop.parentElement; node && node !== document.body; node = node.parentElement) {
          if (getComputedStyle(node).isolation !== 'isolate') continue;
          if (node.querySelector(':scope > :is(sf-button-icon, sf-icon-button, sf-checkbox, sf-radio, sf-switch, .sf-icon-button)')) {
            found.push(pop.id || pop.closest('[id]')?.id || pop.className);
            break;
          }
        }
      }
      return found;
    });
    check(run, 'stacking check: only #bad-pop is a popup drawn inside an isolated coarse row parent (the row menu opens in the top layer)', stacked.join() === 'bad-pop', stacked);
    if (n === 1 && theme === 'light') out2.ruleCheck.push({tag: run.tag, popupInsideIsolatedRow: stacked});
    await pg.evaluate(() => document.getElementById('row-menu').close());
    await pg.waitForTimeout(200);
  }

  // Isolated controls.
  const iso = await pg.evaluate(() => {
    const sel = ['#b-checks sf-checkbox', '#b-switches sf-switch', '#b-radios sf-radio', '#b-icons sf-button-icon', '#b-icons1 sf-button-icon'];
    return sel.flatMap((s) => [...document.querySelectorAll(s)].map((h) => {
      const el = h.querySelector('.sf-checkbox-box, .sf-switch-toggler, .sf-radio-button-box, .sf-icon-button');
      const r = el.getBoundingClientRect();
      return {id: h.id, tag: h.tagName.toLowerCase(), group: h.parentElement.id, x: r.x, y: r.y, w: r.width, h: r.height};
    }));
  });
  const state = (id) => pg.evaluate((id) => { const h = document.getElementById(id); const i = h.querySelector('input'); return i ? i.checked : null; }, id);
  // The page's own hit test at a point (no touch adjustment): the host the topmost element belongs to.
  const hitAt = (x, y) => pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const h = e && e.closest('sf-checkbox, sf-switch, sf-radio, sf-button-icon'); return h ? h.id : (e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') : 'nothing'); }, [x, y]);
  // A press reaches a control when the page's hit test names it and the real tap or click changes it (or clicks it).
  const reacted = async (c, x, y) => {
    const hit = await hitAt(x, y);
    const r = await reactedTap(c, x, y);
    return hit === r ? r : `${hit}/${r}`;
  };
  const reactedTap = async (c, x, y) => {
    const n0 = await events();
    const byClick = c.tag === 'sf-button-icon' || c.tag === 'sf-radio';
    const before = byClick ? null : await state(c.id);
    await press(x, y);
    if (byClick) { const k = await lastClick(n0); return k ? k.id : 'none'; }
    const after = await state(c.id);
    return before !== after ? c.id : 'none';
  };
  // Rule check: two controls whose 44 areas meet (centre distance below 44 in both axes).
  const area = (c) => ({cx: c.x + c.w / 2, cy: c.y + c.h / 2, hw: Math.max(c.w, HIT) / 2, hh: Math.max(c.h, HIT) / 2});
  const meets = [];
  for (let i = 0; i < iso.length; i++) for (let j = i + 1; j < iso.length; j++) {
    const a = area(iso[i]), z = area(iso[j]);
    if (Math.abs(a.cx - z.cx) < a.hw + z.hw - 0.01 && Math.abs(a.cy - z.cy) < a.hh + z.hh - 0.01) meets.push(`${iso[i].id}~${iso[j].id}`);
  }
  if (phone) {
    check(run, 'rule check: only the tight toolbar (#b-icons, gap 0) has controls closer than 44', meets.join() === 'i1~i2,i2~i3', meets);
    if (n === 1 && theme === 'light') out2.ruleCheck.push({tag: run.tag, closerThan44: meets});
    for (const c of iso) {
      const sizeKept = c.w < HIT || c.h < HIT;
      const a = area(c);
      const tight = c.group === 'b-icons';
      const pts = [['centre', a.cx, a.cy], ['top edge', a.cx, a.cy - HIT / 2 + 1.5], ['bottom edge', a.cx, a.cy + HIT / 2 - 1.5]];
      if (!tight) pts.push(['start edge', a.cx - HIT / 2 + 1.5, a.cy], ['end edge', a.cx + HIT / 2 - 1.5, a.cy]);
      const got = [];
      for (const [nm, x, y] of pts) got.push(`${nm}:${await reacted(c, x, y)}`);
      check(run, `${c.id}: drawn ${Math.round(c.w)}x${Math.round(c.h)} kept, the centre and every edge of the 44 area reach it`, sizeKept && got.every((g) => g.endsWith(':' + c.id)), got);
      if (c.tag === 'sf-switch' || c.tag === 'sf-checkbox') {
        const s1 = await state(c.id); await press(a.cx, a.cy - HIT / 2 + 1.5); const s2 = await state(c.id); await press(a.cx, a.cy + HIT / 2 - 1.5); const s3 = await state(c.id);
        check(run, `${c.id}: a tap at the area's edge turns it ${s1 ? 'off' : 'on'}, the next one back`, s2 === !s1 && s3 === s1, [s1, s2, s3]);
      }
    }
    // Clipping: in the tight toolbar a tap on a neighbour's own box, 1.5 px inside its edge, reaches the neighbour.
    const t = iso.filter((c) => c.group === 'b-icons');
    const clip = [];
    for (let i = 0; i < t.length; i++) {
      if (i > 0) clip.push(`${t[i].id}@start:${await reacted(t[i], t[i].x + 1.5, t[i].y + t[i].h / 2)}`);
      if (i < t.length - 1) clip.push(`${t[i].id}@end:${await reacted(t[i], t[i].x + t[i].w - 1.5, t[i].y + t[i].h / 2)}`);
    }
    check(run, 'clipping: a tap on each toolbar button\'s own box next to a neighbour reaches that button, not the neighbour', clip.every((g) => g.split(':')[1] === g.split('@')[0]), clip);
  } else {
    for (const c of iso) {
      const got = [];
      for (const [nm, x, y] of [['above', c.x + c.w / 2, c.y - 3], ['below', c.x + c.w / 2, c.y + c.h + 3]]) got.push(`${nm}:${await reacted(c, x, y)}`);
      got.push(`centre:${await reacted(c, c.x + c.w / 2, c.y + c.h / 2)}`);
      check(run, `${c.id}: fine pointer, no area -- 3 px off the box reaches nothing, the centre reaches it`, got.slice(0, 2).every((g) => /\/none$/.test(g) && !g.includes(':' + c.id)) && got[2] === `centre:${c.id}`, got);
    }
  }
  check(run, 'console clean', run.console.length === 0, run.console);
  out2.runs.push({tag: run.tag, flakes: run.flakes.length, pass: run.checks.filter((c) => c.ok).length, fail: run.checks.filter((c) => !c.ok).length, checks: run.checks});
  await ctx.close();
}
} finally {
  await b.close();
  server.close();
}
const total = out2.runs.reduce((s, r) => s + r.pass + r.fail, 0);
console.log(JSON.stringify({total, failed: out2.bad.length, ruleCheck: out2.ruleCheck, flakes: out2.runs.reduce((sum, r) => sum + r.flakes, 0)}));
if (out2.bad.length) { console.error(JSON.stringify({failures: out2.bad.slice(0, 30), count: out2.bad.length}, null, 1)); process.exit(1); }
console.log('TOUCH_TARGETS_OK');
