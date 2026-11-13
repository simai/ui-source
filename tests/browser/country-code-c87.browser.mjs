#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads] [--measure-only] [--json file]
// The output root holds core/, smart/, component/, utility/ (a build's out with
// core/core..., or a distribution's distr/ with core, smart... side by side).
//
// sf-input-country: owner decision C87 (2026-11-12, variant V4 with the caret,
// ui-control prototypes/phone-country-study.html#r3-variant, research
// control/research/2026-11-11-phone-country.md rounds 3-4) and the two defects
// of DEV letter msg-1fc1c8741a0f480cb867:
//   P1  a list drawn open (open, setState) shows a file in every row flag;
//   P2  sf-dropdown single choice: avatar and colour rows draw no box (C08),
//       a multiple dropdown still draws one per row.
// The C87 points measured:
//   geometry  field height = control height of the step; flag from the outer
//             edge = C77 inset (12 / 16 / 20, phone and compact 12); flag
//             rectangle 7:5 at 12 (1/2, phone, compact) or 16 high; a small
//             arrow_drop_down caret after it; the number text starts after
//             the caret plus --sf-space-1/4 (49 / 58 / 62, phone 45);
//   text      the code is the start of the number: «8 903 123 45 67» from AZ
//             -> «+7 …» RU; paste «+49 30 123456» -> DE; Backspace through the
//             code -> the empty flag frame, the national digits kept; «+374» ->
//             AM; extra digits never cut;
//   list      opened by a click on the flag, by a click on the caret and by the
//             keyboard (Enter, ArrowDown on the flag button): cursor in the
//             search, «Часто выбирают» on top when `preferred` is set (no country twice; none without it), the chosen
//             row in view and filled, no box in any row; search «герм», «+49»,
//             «de» find Germany; ArrowDown + Enter picks it and keeps the
//             national digits; Escape closes; the list scrolls by wheel and
//             stays scrolled (R171); on a phone (390, touch) a sheet from the
//             bottom, the screen's width.
// Every case at 1440 desktop and 390 touch, light and dark, `loads` fresh
// loads each (3 by default); console clean, no horizontal scroll.
// --measure-only records the numbers without failing (the base column).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

const args = process.argv.slice(2);
const positional = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--json');
const MEASURE_ONLY = args.includes('--measure-only');
const JSON_OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : '';
if (!positional[0]) throw new Error('Build output root is required');
const out = positional[0];
const LOADS = Number(positional[1]) || 3;
const built = existsSync(join(out, 'core', 'core'));
const parts = built
  ? {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')}
  : {core: join(out, 'core'), rule: join(out, 'rule'), component: join(out, 'component'), smart: join(out, 'smart'), utility: join(out, 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

const AVATARS = [
  {type: 'avatar', value: 'ru', avatarTitle: 'Россия', avatarImageUrl: '/distr/component/flag/flags/rect/ru.svg'},
  {type: 'avatar', value: 'de', avatarTitle: 'Германия', avatarImageUrl: '/distr/component/flag/flags/rect/de.svg'},
  {type: 'avatar', value: 'am', avatarTitle: 'Армения', avatarImageUrl: '/distr/component/flag/flags/rect/am.svg'}];
const COLOURS = [
  {type: 'color', value: 'red', text: 'Красный', colorClass: 'bg-red'},
  {type: 'color', value: 'blue', text: 'Синий', colorClass: 'bg-blue'}];
const j = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><link rel="stylesheet" href="/distr/component/icons/css/icons.min.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-0);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;gap:var(--sf-space-1);padding:var(--sf-space-1);box-sizing:border-box;max-inline-size:40rem}</style></head>
<body><main>
  <sf-input-country id="open" open max-items="6" iso2="AZ" label="Открыт сразу"></sf-input-country>
  <div style="block-size:var(--sf-g0)"></div>
  <sf-input-country id="f-h" size="1/2" iso2="AZ" label="Телефон 1/2"></sf-input-country>
  <sf-input-country id="f-1" size="1" iso2="AZ" preferred="RU,KZ,BY,UZ,KG,AM" label="Телефон 1"></sf-input-country>
  <sf-input-country id="f-2" size="2" iso2="AZ" label="Телефон 2"></sf-input-country>
  <div data-sf-density="compact"><sf-input-country id="f-c" iso2="AZ" label="Компактно"></sf-input-country></div>
  <label class="sf-country-code sf-country-code--size-1" id="cls" data-iso2="RU">
    <span class="sf-country-code-label"><span class="sf-country-code-text">Классовая разметка</span></span>
    <span class="sf-country-code-field"><span class="sf-country-code-left"><div class="sf-country-code-flag-icon"></div><i class="sf-icon">expand_more</i></span><input type="tel"></span>
    <span class="sf-country-code-list"><span class="sf-country-code-items">
      <span class="sf-country-code-item" data-iso2="RU" data-code="+7"><div class="sf-country-code-flag"><img data-flag-src="/distr/component/flag/flags/rect/ru.svg" alt="RU flag"></div><span>Россия (+7)</span></span>
      <span class="sf-country-code-item" data-iso2="DE" data-code="+49"><div class="sf-country-code-flag"><img data-flag-src="/distr/component/flag/flags/rect/de.svg" alt="DE flag"></div><span>Германия (+49)</span></span>
    </span></span>
  </label>
  <sf-dropdown id="dd-avatar" label="Аватары, один" options='${j(AVATARS)}' value="de"></sf-dropdown>
  <sf-dropdown id="dd-colour" label="Цвета, один" options='${j(COLOURS)}' value="red"></sf-dropdown>
  <sf-dropdown id="dd-multi" label="Аватары, несколько" multiple options='${j(AVATARS)}'></sf-dropdown>
  <div style="block-size:100dvh"></div>
</main></body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') || 'light'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const runs = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
const near = (a, b, tolerance = 1) => typeof a === 'number' && Math.abs(a - b) <= tolerance;

// What a field and its list show, read in the page.
const READ = (id) => {
  const host = document.getElementById(id);
  const root = host?.matches('.sf-country-code') ? host : host?.querySelector('.sf-country-code');
  if (!root) return null;
  const field = root.querySelector('.sf-country-code-field');
  const toggle = root.querySelector('.sf-country-code-left');
  const flag = root.querySelector('.sf-country-code-flag-icon');
  const caret = toggle?.querySelector('.sf-icon');
  const input = root.querySelector('.sf-country-code-field input');
  const list = root.querySelector('.sf-country-code-list');
  const wrap = root.querySelector('.sf-country-code-items');
  const box = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom}; };
  const f = box(field), fl = box(flag), ip = box(input);
  const style = input ? getComputedStyle(input) : null;
  const rows = [...root.querySelectorAll('.sf-country-code-item')];
  const visible = rows.filter((row) => !row.hidden && row.offsetParent !== null);
  const imgs = rows.map((row) => row.querySelector('img')).filter(Boolean);
  const chosen = rows.find((row) => row.getAttribute('aria-selected') === 'true');
  const wrapBox = box(wrap), chosenBox = box(chosen);
  const groups = [...root.querySelectorAll('.sf-country-code-group')].map((g) => g.textContent.trim());
  const frequent = [...root.querySelectorAll('.sf-country-code-item[data-group="frequent"]')].filter((row) => !row.hidden).map((row) => row.dataset.iso2);
  const all = rows.filter((row) => row.dataset.group !== 'frequent' && !row.hidden).map((row) => row.dataset.iso2);
  const search = root.querySelector('.sf-country-code-search input');
  return {
    open: root.classList.contains('open'),
    iso2: root.dataset.iso2 || '',
    unknown: root.classList.contains('sf-country-code--unknown'),
    value: input?.value ?? '',
    fieldH: f?.h, flagFromEdge: fl && f ? fl.x - f.x : null, flagW: fl?.w, flagH: fl?.h,
    caret: caret?.textContent.trim() || '', caretW: box(caret)?.w ?? null,
    textStart: ip && f && style ? ip.x - f.x + parseFloat(style.paddingInlineStart) : null,
    rows: rows.length, visibleRows: visible.length,
    rowsWithSrc: imgs.filter((img) => img.getAttribute('src')).length,
    rowsLoaded: imgs.filter((img) => img.complete && img.naturalWidth > 0).length,
    rowsBroken: imgs.filter((img) => !img.getAttribute('src') || (img.complete && img.naturalWidth === 0)).length,
    imgs: imgs.length,
    fieldFlagLoaded: !!flag?.querySelector('img') && flag.querySelector('img').naturalWidth > 0,
    boxes: [...root.querySelectorAll('.sf-country-code-item .sf-checkbox, .sf-country-code-item input[type=checkbox]')].filter((n) => n.offsetParent !== null).length,
    chosen: chosen?.dataset.iso2 || '',
    chosenInView: !!(chosenBox && wrapBox && chosenBox.y >= wrapBox.y - 1 && chosenBox.bottom <= wrapBox.bottom + 1),
    chosenFill: chosen ? getComputedStyle(chosen).backgroundColor : '',
    rowH: box(visible[0])?.h ?? null,
    searchFocused: !!search && document.activeElement === search,
    hasSearch: !!search,
    groups, frequent, frequentTwice: frequent.filter((iso) => all.includes(iso)),
    list: box(list), scrollTop: wrap?.scrollTop ?? 0,
    viewport: {w: innerWidth, h: innerHeight},
    toggleExpanded: toggle?.getAttribute('aria-expanded') || '',
  };
};

const browser = await chromium.launch();
try {
  for (const device of ['desktop', 'phone']) for (const theme of ['light', 'dark']) for (let load = 1; load <= LOADS; load += 1) {
    const where = `${device}/${theme}/load${load}`;
    if (process.env.PROBE_ONLY && !where.startsWith(process.env.PROBE_ONLY)) continue;
    const context = await browser.newContext(device === 'phone'
      ? {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2}
      : {viewport: {width: 1440, height: 900}});
    const tab = await context.newPage();
    tab.setDefaultTimeout(5000);
    const errors = [];
    // PROBE_SCRATCH=1: a helper's scratch bundle of the edited entries (Lit in
    // development mode, a second Lit beside the pair's) -- those two notices only.
    const scratchNotice = (text) => process.env.PROBE_SCRATCH === '1' && /^(Lit is in dev mode|Multiple versions of Lit loaded)/u.test(text);
    tab.on('console', (message) => { if (['error', 'warning'].includes(message.type()) && !scratchNotice(message.text())) errors.push(message.text()); });
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(`${base}/page?theme=${theme}`);
    const ready = await tab.waitForFunction(() => ['open', 'f-h', 'f-1', 'f-2', 'f-c'].every((id) => document.getElementById(id)?.querySelector('.sf-country-code input'))
      && document.querySelector('#dd-avatar button[aria-haspopup]'), null, {timeout: 20000}).then(() => true, () => false);
    if (!ready) { fail(where, 'the fields never drew'); await context.close(); continue; }
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(1500);
    const run = {where};

    // P1: drawn open, the rows carry their files.
    run.openAtConnect = await tab.evaluate(READ, 'open');
    const o = run.openAtConnect;
    if (!o.open || o.rowsBroken || o.rowsLoaded < Math.min(o.imgs, 4)) fail(where, `P1 open at connect: ${o.rowsLoaded}/${o.imgs} loaded, ${o.rowsBroken} broken`);
    // P1, class markup with data-flag-src only, opened from code.
    await tab.evaluate(() => window.SF.CountryCode.setState(document.getElementById('cls'), {open: true}));
    await tab.waitForTimeout(800);
    run.classOpenedFromCode = await tab.evaluate(READ, 'cls');
    if (run.classOpenedFromCode.rowsLoaded !== run.classOpenedFromCode.imgs) fail(where, `P1 class setState open: ${run.classOpenedFromCode.rowsLoaded}/${run.classOpenedFromCode.imgs} loaded`);
    await tab.evaluate(() => window.SF.CountryCode.setState(document.getElementById('cls'), {open: false}));
    await tab.evaluate(() => document.getElementById('open').setState({open: false}));

    // Geometry per size.
    const phone = device === 'phone';
    const expect = {
      'f-h': {inset: phone ? 12 : 12, flagH: 12, text: phone ? 45 : 49},
      'f-1': {inset: phone ? 12 : 16, flagH: phone ? 12 : 16, text: phone ? 45 : 58},
      'f-2': {inset: phone ? 12 : 20, flagH: phone ? 12 : 16, text: phone ? 45 : 62},
      'f-c': {inset: 12, flagH: 12, text: 45},
    };
    run.geometry = {};
    for (const id of Object.keys(expect)) {
      const g = await tab.evaluate(READ, id);
      const control = await tab.evaluate(([id]) => {
        const host = document.getElementById(id);
        const probe = document.createElement('div');
        const size = host.getAttribute('size') === '1/2' ? '1\\/2' : host.getAttribute('size') || '1';
        probe.style.blockSize = `var(--sf-ui-${size}--control-height)`;
        host.append(probe); const h = probe.getBoundingClientRect().height; probe.remove(); return h;
      }, [id]);
      run.geometry[id] = {fieldH: g.fieldH, control, flagFromEdge: g.flagFromEdge, flag: `${g.flagW?.toFixed(1)}x${g.flagH?.toFixed(1)}`, caret: g.caret, caretW: g.caretW, textStart: g.textStart};
      const e = expect[id];
      if (!near(g.fieldH, control)) fail(where, `${id} field ${g.fieldH} != control ${control}`);
      if (!near(g.flagFromEdge, e.inset)) fail(where, `${id} flag from edge ${g.flagFromEdge} != ${e.inset}`);
      if (!near(g.flagH, e.flagH) || !near(g.flagW, e.flagH * 1.4, 1.5)) fail(where, `${id} flag ${g.flagW}x${g.flagH} != ${e.flagH * 1.4}x${e.flagH}`);
      if (g.caret !== 'arrow_drop_down') fail(where, `${id} caret ${g.caret}`);
      if (!near(g.textStart, e.text, 1.5)) fail(where, `${id} text starts ${g.textStart} != ${e.text}`);
    }

    // The number text decides the country (f-1, AZ).
    const input = tab.locator('#f-1 .sf-country-code-field input');
    const typeIn = async (text) => { await input.click(); await tab.keyboard.press('ControlOrMeta+a'); await tab.keyboard.press('Backspace'); await input.pressSequentially(text, {delay: 15}); };
    run.text = {};
    await typeIn('8 903 123 45 67');
    run.text.trunk = await tab.evaluate(READ, 'f-1');
    if (run.text.trunk.iso2 !== 'RU' || !/^\+7 ?903/u.test(run.text.trunk.value)) fail(where, `«8 903…» -> ${run.text.trunk.iso2} «${run.text.trunk.value}»`);
    await input.click(); await tab.keyboard.press('ControlOrMeta+a');
    await input.evaluate((node) => { const data = new DataTransfer(); data.setData('text/plain', '+49 30 123456'); node.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true})); });
    await tab.waitForTimeout(150);
    run.text.paste = await tab.evaluate(READ, 'f-1');
    if (run.text.paste.iso2 !== 'DE' || !/^\+49 ?30 ?123456/u.test(run.text.paste.value.replace(/[-]/gu, ' ').replace(/\s+/gu, ' '))) fail(where, `paste «+49 30 123456» -> ${run.text.paste.iso2} «${run.text.paste.value}»`);
    await input.click(); await tab.keyboard.press('End');
    await input.evaluate((node) => node.setSelectionRange(3, 3));
    await tab.keyboard.press('Backspace'); await tab.keyboard.press('Backspace');
    run.text.erased = await tab.evaluate(READ, 'f-1');
    if (!run.text.erased.unknown || !/30/u.test(run.text.erased.value)) fail(where, `Backspace through the code: unknown ${run.text.erased.unknown} «${run.text.erased.value}»`);
    await input.pressSequentially('374', {delay: 20});
    run.text.recode = await tab.evaluate(READ, 'f-1');
    if (run.text.recode.iso2 !== 'AM' || run.text.recode.unknown) fail(where, `«+374» -> ${run.text.recode.iso2} unknown ${run.text.recode.unknown} «${run.text.recode.value}»`);
    const nationalBefore = run.text.recode.value.replace(/\D/gu, '').slice(3);

    // The list: by the flag, by the caret, by the keyboard.
    run.list = {};
    for (const how of ['flag', 'caret', 'keyboard']) {
      await tab.keyboard.press('Escape');
      if (how === 'flag') await tab.locator('#f-1 .sf-country-code-flag-icon').click();
      if (how === 'caret') await tab.locator('#f-1 .sf-country-code-left .sf-icon').click();
      if (how === 'keyboard') { await tab.locator('#f-1 .sf-country-code-left').focus(); await tab.keyboard.press('Enter'); }
      await tab.waitForTimeout(400);
      const r = await tab.evaluate(READ, 'f-1');
      run.list[how] = {open: r.open, expanded: r.toggleExpanded, searchFocused: r.searchFocused, chosen: r.chosen, chosenInView: r.chosenInView, fill: r.chosenFill, rowH: r.rowH, boxes: r.boxes, groups: r.groups, frequent: r.frequent, twice: r.frequentTwice, loaded: r.rowsLoaded, broken: r.rowsBroken, list: r.list};
      if (!r.open || r.toggleExpanded !== 'true') fail(where, `${how}: the list did not open`);
      if (!r.searchFocused) fail(where, `${how}: the cursor is not in the search`);
      if (r.chosen !== 'AM' || !r.chosenInView) fail(where, `${how}: chosen ${r.chosen} in view ${r.chosenInView}`);
      if (r.boxes) fail(where, `${how}: ${r.boxes} boxes in the rows`);
      if (!r.frequent.length || r.frequentTwice.length || r.frequent.length > 6) fail(where, `${how}: frequent ${r.frequent} twice ${r.frequentTwice}`);
      if (phone && r.list && !(near(r.list.w, r.viewport.w) && near(r.list.bottom, r.viewport.h, 2))) fail(where, `${how}: the phone list is not a bottom sheet ${JSON.stringify(r.list)}`);
      if (!phone && r.list && r.list.w < 319) fail(where, `${how}: the list is ${r.list.w} wide, C32 asks 320`);
    }
    // Search keys.
    run.search = {};
    for (const query of ['герм', '+49', 'de']) {
      await tab.locator('#f-1 .sf-country-code-search input').fill(query).catch(() => {});
      await tab.waitForTimeout(100);
      const shown = await tab.evaluate(() => [...document.querySelectorAll('#f-1 .sf-country-code-item')].filter((row) => !row.hidden && row.offsetParent !== null)
        .sort((a, b) => a.offsetTop - b.offsetTop).map((row) => row.dataset.iso2));
      run.search[query] = shown.slice(0, 4);
      if (shown[0] !== 'DE') fail(where, `search «${query}» -> ${shown.slice(0, 4)}`);
    }
    await tab.keyboard.press('ArrowDown'); await tab.keyboard.press('Enter');
    await tab.waitForTimeout(200);
    run.picked = await tab.evaluate(READ, 'f-1');
    if (run.picked.iso2 !== 'DE' || run.picked.open || !run.picked.value.replace(/\D/gu, '').endsWith(nationalBefore)) fail(where, `pick Germany -> ${run.picked.iso2} open ${run.picked.open} «${run.picked.value}» (kept ${nationalBefore}?)`);
    // R171: the list scrolls and stays scrolled.
    await tab.locator('#f-2 .sf-country-code-left').scrollIntoViewIfNeeded();
    await tab.locator('#f-2 .sf-country-code-left').click();
    await tab.waitForTimeout(300);
    // `preferred` is optional (owner, q-8794872748): #f-2 names none, so no
    // «Часто выбирают» heading and no frequent rows, though #f-1 left a recent choice.
    run.noPreferred = await tab.evaluate(() => {
      const root = document.querySelector('#f-2 .sf-country-code');
      return {
        heads: [...root.querySelectorAll('.sf-country-code-group')].filter((g) => !g.hidden).map((g) => g.textContent.trim()),
        frequent: [...root.querySelectorAll('.sf-country-code-item[data-group="frequent"]')].map((row) => row.dataset.iso2),
      };
    });
    if (run.noPreferred.heads.length || run.noPreferred.frequent.length) fail(where, `no preferred: heads ${run.noPreferred.heads} frequent ${run.noPreferred.frequent}`);
    await tab.evaluate(() => document.querySelector('#f-2 .sf-country-code-items').scrollTo({top: 0, behavior: 'instant'}));
    await tab.waitForTimeout(100);
    const wrapBox = await tab.locator('#f-2 .sf-country-code-items').boundingBox();
    if (wrapBox) {
      await tab.mouse.move(wrapBox.x + wrapBox.width / 2, wrapBox.y + Math.min(wrapBox.height / 2, 40));
      run.scrollSteps = [];
      for (let i = 0; i < 6; i += 1) {
        await tab.mouse.wheel(0, 100); await tab.waitForTimeout(60);
        run.scrollSteps.push(await tab.evaluate(() => Math.round(document.querySelector('#f-2 .sf-country-code-items').scrollTop)));
      }
      await tab.waitForTimeout(300);
      run.scroll = await tab.evaluate(() => document.querySelector('#f-2 .sf-country-code-items').scrollTop);
      if (!(run.scroll > 300)) fail(where, `R171: wheel 6 x 100 left scrollTop ${run.scroll}`);
    }
    await tab.keyboard.press('Escape');

    // P2: sf-dropdown rows with a picture.
    run.dropdown = {};
    for (const id of ['dd-avatar', 'dd-colour', 'dd-multi']) {
      await tab.locator(`#${id} button[aria-haspopup]`).click();
      await tab.waitForTimeout(300);
      run.dropdown[id] = await tab.evaluate((id) => {
        const host = document.getElementById(id);
        const list = host._list || host.querySelector('.sf-list');
        const rows = [...(list?.querySelectorAll('.sf-list-item') || [])];
        const boxes = rows.filter((row) => [...row.querySelectorAll('.sf-checkbox')].some((n) => n.offsetParent !== null && n.getBoundingClientRect().width > 0)).length;
        const chosen = rows.find((row) => row.getAttribute('aria-selected') === 'true');
        return {rows: rows.length, boxes, fill: chosen ? getComputedStyle(chosen).backgroundColor : ''};
      }, id);
      await tab.keyboard.press('Escape');
      await tab.waitForTimeout(150);
      const d = run.dropdown[id];
      if (id === 'dd-multi' ? d.boxes !== d.rows : d.boxes !== 0) fail(where, `P2 ${id}: ${d.boxes} boxes on ${d.rows} rows`);
    }

    run.horizontalScroll = await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (run.horizontalScroll) fail(where, 'horizontal scroll');
    run.console = errors;
    if (errors.length) fail(where, `console: ${errors.slice(0, 3).join(' | ')}`);
    runs.push(run);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
const report = {status: failures.length ? 'failed' : 'passed', loads: LOADS, failures, runs};
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({status: report.status, failures: failures.length, first: failures.slice(0, 60), sample: runs[0]}, null, 2));
if (failures.length && !MEASURE_ONLY) process.exitCode = 1;
