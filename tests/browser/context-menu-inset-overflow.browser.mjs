#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Two owner remarks on the dropping panels (2026-11-07):
//  - R017: a panel insets its rows like its search field -- 8px (space-1/3)
//    from the panel's inner edge, so the field, the rows and their hover and
//    chosen fills share one edge. Measured on a plain menu, a ticked (check)
//    menu, a pick-one menu with a search (the language menu) and a drilling
//    level, at sizes 1/2 and 1, light and dark: every row and its fill stands
//    8px inside the panel, and under a search starts and ends on the field.
//  - R018: a menu whose rows all fit showed a scrollbar beside them: clamped
//    to the room below its trigger half a pixel or a few pixels short of its
//    height, it overflowed by less than a row and the scrollbar's thumb was
//    the whole track. Measured over a sweep of window heights, opening down
//    and up: the rows overflow the panel by nothing or by more than the edge's
//    padding (a menu that cannot fit scrolls; one that nearly fits takes its
//    whole height), never by a sliver. Headless Chrome draws no scrollbar, so
//    the overflow is read from the geometry; with SF_PROBE_HEADED=1 the probe
//    runs the installed Chrome headed with classic scrollbars and also fails
//    when a scrollbar stands (offsetWidth - clientWidth beyond the borders)
//    while scrollHeight - clientHeight is under 2.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'component/component/context-menu/css/context-menu.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/menu-context/js/menu-context.js',
].map((p) => join(out, p));

const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const headed = process.env.SF_PROBE_HEADED === '1';
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch(headed
  ? {channel: 'chrome', headless: false, args: ['--disable-features=OverlayScrollbar']}
  : {});
const INSET = 8;
const LANGUAGES = ['Русский', 'English', 'Deutsch', 'Français', 'Español'];

async function page(theme, viewport = {width: 900, height: 700}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1});
  const one = await context.newPage();
  const errors = [];
  one.on('pageerror', (error) => { if (!/Automatic publicPath/u.test(String(error))) errors.push(String(error)); });
  one.on('console', (message) => { if (message.type() === 'error' && !/Automatic publicPath/u.test(message.text())) errors.push(message.text()); });
  await one.setContent(
    `<!doctype html><html class="theme-${theme}" lang="ru"><head><meta charset="utf-8"></head><body style="margin:0">`
    + '<button id="trigger" type="button" style="position:fixed;left:40px;top:10px">Язык</button>'
    + '<sf-menu-context id="menu" popup aria-label="Язык"></sf-menu-context>'
    + '</body></html>',
  );
  for (const path of styles) await one.addStyleTag({path}).catch(() => {});
  for (const path of modules) await one.addScriptTag({path, type: 'module'}).catch(() => {});
  await one.waitForFunction(() => customElements.get('sf-menu-context'));
  return {page: one, context, errors};
}

// The rows' edges against the panel's inner edges and the field's.
const INSETS = `(menu) => {
  const content = menu.querySelector(':scope > .sf-context-menu .sf-context-menu-content');
  const c = content.getBoundingClientRect();
  const style = getComputedStyle(content);
  const inner = {left: c.left + parseFloat(style.borderLeftWidth), right: c.right - parseFloat(style.borderRightWidth)};
  const field = menu.querySelector('.sf-context-menu-search-input')?.getBoundingClientRect() ?? null;
  const head = menu.querySelector('.sf-context-menu-drill-head')?.getBoundingClientRect() ?? null;
  const rows = [...content.querySelectorAll('.sf-context-menu-item')].filter((row) => !row.closest('.sf-context-menu-choice')).map((row) => {
    const box = row.getBoundingClientRect();
    return {text: row.textContent.trim().split('\\n')[0], start: box.left - inner.left, end: inner.right - box.right, fill: getComputedStyle(row).backgroundColor};
  });
  return {rows, field: field && {start: field.left - inner.left, end: inner.right - field.right}, head: head && {start: head.left - inner.left, end: inner.right - head.right}};
}`;

async function openWith(p, setup) {
  await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
  await p.evaluate(setup);
  await p.waitForTimeout(60);
  await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await p.waitForTimeout(150);
}

function checkInsets(where, got) {
  if (!got.rows.length) note({case: `${where}: rows drawn`, got});
  for (const row of got.rows) {
    if (Math.abs(row.start - INSET) > 0.5 || Math.abs(row.end - INSET) > 0.5) note({case: `${where}: «${row.text}» stands ${INSET}px inside the panel`, got: row});
  }
  if (got.field && (Math.abs(got.field.start - INSET) > 0.5 || Math.abs(got.field.end - INSET) > 0.5)) note({case: `${where}: the field stands ${INSET}px inside the panel`, got: got.field});
  if (got.head && (Math.abs(got.head.start - INSET) > 0.5 || Math.abs(got.head.end - INSET) > 0.5)) note({case: `${where}: the drilling head stands ${INSET}px inside the panel`, got: got.head});
}

const evidence = {insets: {}, overflow: []};
try {
  for (const theme of ['light', 'dark']) {
    const {page: p, context, errors} = await page(theme);
    for (const size of ['1/2', '1']) {
      const at = `${theme}, size ${size}`;
      await p.evaluate((s) => document.getElementById('menu').setAttribute('size', s), size);

      // A plain menu: actions with icons.
      await openWith(p, () => {
        const menu = document.getElementById('menu');
        menu.removeAttribute('submenu');
        menu.search = null;
        menu.entries = [{id: 'open', text: 'Открыть', icon: 'open_in_new'}, {id: 'copy', text: 'Копировать', icon: 'content_copy'}, {id: 'delete', text: 'Удалить', icon: 'delete', danger: true}];
      });
      await p.hover('#menu .sf-context-menu-item');
      const plain = await p.evaluate((m) => eval(m)(document.getElementById('menu')), INSETS);
      checkInsets(`plain menu (${at})`, plain);

      // A ticked menu.
      await openWith(p, () => {
        document.getElementById('menu').entries = [{id: 'a', text: 'Имя', kind: 'check', checked: true}, {id: 'b', text: 'Почта', kind: 'check'}, {id: 'c', text: 'Телефон', kind: 'check', checked: true}];
      });
      checkInsets(`ticked menu (${at})`, await p.evaluate((m) => eval(m)(document.getElementById('menu')), INSETS));

      // A pick-one menu with a search: the chosen fill on the field's edges.
      await openWith(p, (list) => {
        const menu = document.getElementById('menu');
        menu.search = {placeholder: 'Найти язык', empty: 'Ничего не найдено'};
        menu.entries = ['Русский', 'English', 'Deutsch', 'Français', 'Español', 'Italiano'].map((text, index) => ({id: `l${index}`, text, kind: 'radio', checked: index === 0}));
      });
      const searched = await p.evaluate((m) => eval(m)(document.getElementById('menu')), INSETS);
      checkInsets(`search menu (${at})`, searched);
      for (const row of searched.rows) {
        if (searched.field && (Math.abs(row.start - searched.field.start) > 0.5 || Math.abs(row.end - searched.field.end) > 0.5)) note({case: `search menu (${at}): «${row.text}» starts and ends on the field`, got: {row, field: searched.field}});
      }
      // The rows' scrollbar stays at the panel's edge: the list spans the panel.
      const list = await p.evaluate(() => {
        const content = document.querySelector('#menu .sf-context-menu-content');
        const listNode = content.querySelector('.sf-context-menu-list');
        const c = content.getBoundingClientRect(), l = listNode.getBoundingClientRect();
        const border = parseFloat(getComputedStyle(content).borderRightWidth);
        return {end: c.right - border - l.right};
      });
      if (Math.abs(list.end) > 0.5) note({case: `search menu (${at}): the rows' scroll area reaches the panel's edge`, got: list});

      // A drilling level: its head and its options on the same edge.
      await openWith(p, () => {
        const menu = document.getElementById('menu');
        menu.search = null;
        menu.setAttribute('submenu', 'drill');
        menu.entries = [{id: 'theme', text: 'Тема', type: 'choice', options: [{id: 'light', text: 'Светлая', checked: true}, {id: 'dark', text: 'Тёмная'}, {id: 'auto', text: 'Как в системе'}]}, {id: 'more', text: 'Ещё', submenu: [{id: 'x', text: 'Первое'}, {id: 'y', text: 'Второе'}]}];
      });
      await p.click('#menu [aria-haspopup="menu"]');
      await p.waitForTimeout(200);
      checkInsets(`drilling level (${at})`, await p.evaluate((m) => eval(m)(document.getElementById('menu')), INSETS));
      if (theme === 'light') evidence.insets[size] = {plain, searched};
    }
    await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
    if (errors.length) note({case: `console clean (${theme})`, got: errors});
    await context.close();
  }

  // R018: a sweep of window heights, opening down from a trigger at the top
  // and up from one at the bottom.
  for (const theme of ['light', 'dark']) {
    for (const where of ['top', 'bottom']) {
      const {page: p, context, errors} = await page(theme, {width: 800, height: 400});
      await p.evaluate(([list, at]) => {
        const trigger = document.getElementById('trigger');
        if (at === 'bottom') { trigger.style.top = 'auto'; trigger.style.bottom = '10px'; }
        document.getElementById('menu').entries = list.map((text, index) => ({id: `l${index}`, text, kind: 'radio', checked: index === 0}));
      }, [LANGUAGES, where]);
      for (let height = 120; height <= 260; height += 1) {
        await p.setViewportSize({width: 800, height});
        const got = await p.evaluate(async () => {
          const menu = document.getElementById('menu');
          await menu.openFor(document.getElementById('trigger'), {focus: 'none'});
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          const content = menu.querySelector('.sf-context-menu-content');
          const style = getComputedStyle(content);
          const c = content.getBoundingClientRect();
          const last = content.lastElementChild.getBoundingClientRect();
          const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
          // position()'s edge padding, space-1/2 -- adaptive, so read here.
          const probe = document.createElement('span');
          probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:var(--sf-space-1\\/2)';
          document.body.append(probe);
          const edge = probe.getBoundingClientRect().width;
          probe.remove();
          const result = {
            edge,
            overflow: Math.round((last.bottom + parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth) - c.bottom) * 1000) / 1000,
            bar: content.offsetWidth - content.clientWidth - Math.round(borders),
            scrollGap: content.scrollHeight - content.clientHeight,
            top: Math.round(c.top * 100) / 100, bottom: Math.round(c.bottom * 100) / 100,
          };
          menu.close({restoreFocus: false});
          return result;
        });
        const sliver = got.overflow > 0.01 && got.overflow <= got.edge + 0.01;
        const bar = got.bar > 0 && got.scrollGap < 2;
        const off = got.top < -0.5 || got.bottom > height + 0.5;
        if (sliver || bar || off) note({case: `a menu opening ${where === 'top' ? 'down' : 'up'} at ${height}px (${theme}) overflows by nothing or by more than the edge's padding, shows no scrollbar beside rows that fit and stays in the window`, got});
        if (theme === 'light' && where === 'top' && height % 10 === 0) evidence.overflow.push({height, ...got});
      }
      if (errors.length) note({case: `console clean (sweep ${where}, ${theme})`, got: errors});
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (process.env.SF_PROBE_EVIDENCE) process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) {
  const kinds = {};
  for (const failure of failures) {
    const kind = failure.case.replace(/ at \d+px/u, '').replace(/«[^»]*»/u, 'a row');
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  console.error(JSON.stringify({kinds, first: failures.slice(0, 12)}, null, 2));
  throw new Error(`${failures.length} menu inset/overflow check(s) failed`);
}
process.stdout.write(`Context menu inset and overflow: PASS — rows, fills, field and drilling head ${INSET}px inside the panel at 1/2 and 1, light and dark; no sliver overflow over 120-260px windows, opening down and up${headed ? ', headed Chrome with classic scrollbars' : ''}\n`);
