#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The dropping panel's geometry, owner rules C05-C07 (docs review R029,
// 2026-11-07; R017's 1/3 inset replaced) and R018:
//  - C05: a row's highlight stands --sf-space-1/4 from the panel's inner edge,
//    is as tall as a control of the menu's step and rounded --sf-radius--ui;
//    its icon or text starts --sf-space-1/2 inside it. Measured on a plain
//    menu, a ticked menu, a pick-one menu with a search, a menu with icons and
//    a search, and a drilling level, at sizes 1/2 and 1, light and dark.
//  - C06: the search is a header: no frame, across the panel's inner width, a
//    row's height and the inset above and below, a hairline under it; its icon
//    stands over the rows' icon (at the header's end, when they have none) and its text
//    over theirs.
//  - C07: a scrollbar only when the rows do not fit; in the inline-end inset
//    while it takes room: the area's inline-end padding 0, the track the
//    inset, a thumb of --sf-space-1/4 and the inset. Headless Chrome draws no
//    scrollbar, so with SF_PROBE_HEADED=1 the probe runs the installed Chrome
//    headed with classic scrollbars, reads the track's width and finds the
//    thumb's columns on a screenshot: highlight-to-thumb = thumb = thumb-to-
//    edge = the inset.
//  - R018: a menu whose rows all fit showed a scrollbar beside them: clamped
//    to the room below its trigger half a pixel or a few pixels short of its
//    height, it overflowed by less than a row. Measured over a sweep of window
//    heights, opening down and up: the rows overflow the panel by nothing or
//    by more than the edge's padding, never by a sliver; headed, it also fails
//    when a scrollbar stands while scrollHeight - clientHeight is under 2.
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

// The rows' edges against the panel's inner edges, the header's, and the
// tokens they are made of, read in the page (the ladder is adaptive).
const INSETS = `(menu) => {
  const content = menu.querySelector(':scope > .sf-context-menu .sf-context-menu-content');
  const c = content.getBoundingClientRect();
  const style = getComputedStyle(content);
  const inner = {left: c.left + parseFloat(style.borderLeftWidth), right: c.right - parseFloat(style.borderRightWidth)};
  const read = (value) => { const n = document.createElement('span'); n.style.cssText = 'position:absolute;visibility:hidden;inline-size:' + value; content.append(n); const w = n.getBoundingClientRect().width; n.remove(); return w; };
  const size1 = menu.querySelector('.sf-context-menu--size-1') !== null;
  const tokens = {
    inset: read('var(--sf-space-1\\\\/4)'), pad: read('var(--sf-space-1\\\\/2)'),
    rowHeight: read(size1 ? 'var(--sf-ui-1--control-height)' : 'var(--sf-ui-1\\\\/2--control-height)'),
    radius: read('var(--sf-radius--ui)'),
  };
  const search = menu.querySelector('.sf-context-menu-search');
  const s = search && search.getBoundingClientRect();
  const ss = search && getComputedStyle(search);
  const field = menu.querySelector('.sf-context-menu-search-input')?.getBoundingClientRect() ?? null;
  const icon = menu.querySelector('.sf-context-menu-search-icon')?.getBoundingClientRect() ?? null;
  const head = menu.querySelector('.sf-context-menu-drill-head')?.getBoundingClientRect() ?? null;
  const rows = [...content.querySelectorAll('.sf-context-menu-item')].filter((row) => !row.closest('.sf-context-menu-choice')).map((row) => {
    const box = row.getBoundingClientRect();
    const rs = getComputedStyle(row);
    const first = row.firstElementChild?.getBoundingClientRect() ?? box;
    const lead = row.querySelector('.sf-context-menu-item-lead')?.getBoundingClientRect() ?? null;
    const text = row.querySelector('.sf-context-menu-item-text')?.getBoundingClientRect() ?? null;
    return {text: row.textContent.trim().split('\\n')[0], start: box.left - inner.left, end: inner.right - box.right, height: box.height,
      contentStart: first.left - box.left, iconText: lead && text ? text.left - lead.right : null,
      leadLeft: lead?.left ?? null, textLeft: text?.left ?? null,
      radius: parseFloat(rs.borderTopLeftRadius), fill: rs.backgroundColor};
  });
  return {tokens, rows,
    header: s && {start: s.left - inner.left, end: inner.right - s.right, height: s.height, line: parseFloat(ss.borderBottomWidth), frame: parseFloat(ss.borderTopWidth) + parseFloat(ss.borderLeftWidth), fill: ss.backgroundColor,
      iconLeft: icon?.left ?? null, textLeft: field?.left ?? null, fieldBorder: parseFloat(getComputedStyle(menu.querySelector('.sf-context-menu-search-input')).borderTopWidth)},
    head: head && {start: head.left - inner.left, end: inner.right - head.right}};
}`;

async function openWith(p, setup, arg) {
  await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
  await p.evaluate(setup, arg);
  await p.waitForTimeout(60);
  await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await p.waitForTimeout(150);
}

const near = (a, b) => a !== null && b !== null && Math.abs(a - b) <= 0.5;

function checkInsets(where, got) {
  const {inset, pad, rowHeight, radius} = got.tokens;
  if (!got.rows.length) note({case: `${where}: rows drawn`, got});
  for (const row of got.rows) {
    if (!near(row.start, inset) || !near(row.end, inset)) note({case: `${where}: «${row.text}» stands the inset inside the panel`, got: {row, inset}});
    if (!near(row.height, rowHeight) && row.height < rowHeight) note({case: `${where}: «${row.text}» is a control's height`, got: {row, rowHeight}});
    if (!near(row.contentStart, pad)) note({case: `${where}: «${row.text}»'s icon or text starts --sf-space-1/2 inside its highlight`, got: {row, pad}});
    if (row.iconText !== null && !near(row.iconText, pad)) note({case: `${where}: «${row.text}»'s icon stands --sf-space-1/2 before its text`, got: {row, pad}});
    if (!near(row.radius, radius)) note({case: `${where}: «${row.text}»'s highlight is rounded --sf-radius--ui`, got: {row, radius}});
  }
  const h = got.header;
  if (h) {
    if (!near(h.start, 0) || !near(h.end, 0)) note({case: `${where}: the search header spans the panel`, got: h});
    if (!near(h.height, rowHeight + 2 * inset) || !near(h.line, 1) || h.frame !== 0 || h.fieldBorder !== 0) note({case: `${where}: the search header is a row and the inset above and below, a hairline under it, no frame`, got: {h, rowHeight, inset}});
    const row = got.rows[0];
    // Text over text, always; the icon over the rows' leading column, or at
    // the header's end in a menu without one (C06, DEV measurement 2026-11-08).
    if (!near(h.textLeft, row.textLeft)) note({case: `${where}: the search text stands over the rows' text`, got: {text: h.textLeft, row: row.textLeft}});
    if (row.leadLeft !== null && !near(h.iconLeft, row.leadLeft)) note({case: `${where}: the search icon stands over the rows' icon`, got: {icon: h.iconLeft, row: row.leadLeft}});
    if (row.leadLeft === null && !(h.iconLeft > h.textLeft)) note({case: `${where}: without a leading column the search icon stands at the header's end`, got: {icon: h.iconLeft, text: h.textLeft}});
  }
  if (got.head && (!near(got.head.start, inset) || !near(got.head.end, inset))) note({case: `${where}: the drilling head stands the inset inside the panel`, got: {head: got.head, inset}});
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
      // The rows' scrollbar stays at the panel's edge: the list spans the panel.
      const list = await p.evaluate(() => {
        const content = document.querySelector('#menu .sf-context-menu-content');
        const listNode = content.querySelector('.sf-context-menu-list');
        const c = content.getBoundingClientRect(), l = listNode.getBoundingClientRect();
        const border = parseFloat(getComputedStyle(content).borderRightWidth);
        return {end: c.right - border - l.right};
      });
      if (Math.abs(list.end) > 0.5) note({case: `search menu (${at}): the rows' scroll area reaches the panel's edge`, got: list});

      // A menu with icons and a search: the header's icon over the rows' icons.
      await openWith(p, () => {
        const menu = document.getElementById('menu');
        menu.search = {placeholder: 'Найти', empty: 'Ничего не найдено'};
        menu.entries = [{id: 'open', text: 'Открыть', icon: 'open_in_new'}, {id: 'copy', text: 'Копировать', icon: 'content_copy'}, {id: 'share', text: 'Поделиться', icon: 'share'}];
      });
      const iconSearch = await p.evaluate((m) => eval(m)(document.getElementById('menu')), INSETS);
      checkInsets(`search menu with icons (${at})`, iconSearch);

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
      evidence.insets[`${theme} ${size}`] = {plain, searched, iconSearch};
    }
    await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
    if (errors.length) note({case: `console clean (${theme})`, got: errors});
    await context.close();
  }

  // C07: the scrollbar in the inline-end inset. Only a headed browser with
  // classic scrollbars draws one; headless, the rows that fit are checked.
  const MANY = ['Русский', 'English', 'Deutsch', 'Français', 'Español', 'Italiano', 'Português', 'Polski', 'Čeština', 'Nederlands', 'Svenska', 'Suomi', 'Dansk', 'Norsk'];
  evidence.scrollbar = [];
  for (const theme of ['light', 'dark']) {
    const {page: p, context, errors} = await page(theme, {width: 900, height: 320});
    for (const size of ['1/2', '1']) {
      for (const [kind, count, search] of [['fits', 3, false], ['scrolls', MANY.length, false], ['fits with search', 3, true], ['scrolls with search', MANY.length, true]]) {
        const where = `${kind} (${theme}, size ${size})`;
        await openWith(p, ([s, n, withSearch, list]) => {
          const menu = document.getElementById('menu');
          menu.removeAttribute('submenu');
          menu.setAttribute('size', s);
          menu.search = withSearch ? {placeholder: 'Найти язык', empty: 'Ничего не найдено'} : null;
          menu.entries = list.slice(0, n).map((text, index) => ({id: `l${index}`, text, icon: 'language', kind: 'radio', checked: index === 1}));
        }, [size, count, search, MANY]);
        await p.waitForTimeout(250);
        const got = await p.evaluate(() => {
          const menu = document.getElementById('menu');
          const content = menu.querySelector('.sf-context-menu-content');
          const area = content.querySelector(':scope > .sf-context-menu-list') ?? content;
          const as = getComputedStyle(area);
          const borders = parseFloat(as.borderLeftWidth) + parseFloat(as.borderRightWidth);
          const a = area.getBoundingClientRect();
          const cs = getComputedStyle(content);
          const c = content.getBoundingClientRect();
          const row = area.querySelector('.sf-context-menu-item').getBoundingClientRect();
          const n = document.createElement('span');
          n.style.cssText = 'position:absolute;visibility:hidden;inline-size:var(--sf-space-1\\/4)';
          content.append(n);
          const inset = n.getBoundingClientRect().width;
          n.remove();
          return {
            inset,
            marked: area.classList.contains('sf-context-menu-list--scrollbar') || area.classList.contains('sf-context-menu-content--scrollbar'),
            bar: area.offsetWidth - area.clientWidth - borders,
            overflows: area.scrollHeight - area.clientHeight > 1,
            paddingEnd: parseFloat(as.paddingRight),
            rowEnd: Math.round(row.right * 100) / 100,
            rowToBar: Math.round((a.left + parseFloat(as.borderLeftWidth) + area.clientWidth - row.right) * 100) / 100,
            innerRight: c.right - parseFloat(cs.borderRightWidth),
            rowToEdge: Math.round((c.right - parseFloat(cs.borderRightWidth) - row.right) * 100) / 100,
            rowStart: Math.round((row.left - c.left - parseFloat(cs.borderLeftWidth)) * 100) / 100,
            sampleY: Math.round(a.top + parseFloat(as.borderTopWidth) + 12),
          };
        });
        const one = {where, ...got};
        if (!got.overflows && (got.marked || got.bar > 0 || !near(got.rowToEdge, got.inset))) note({case: `${where}: rows that fit show no scrollbar and keep the inset on both sides`, got});
        if (!near(got.rowStart, got.inset)) note({case: `${where}: the rows stand the inset from the panel's start`, got});
        if (got.bar > 0) {
          if (!got.marked || !near(got.paddingEnd, 0)) note({case: `${where}: a scrollbar that takes room marks its area, which gives up its end padding`, got});
          if (!near(got.bar, 3 * got.inset)) note({case: `${where}: the track is the inset, the thumb and the inset`, got});
          if (!near(got.rowToBar, 0)) note({case: `${where}: the track starts where the rows' highlight ends`, got});
          // The thumb's columns on a screenshot of the track's line.
          const shot = await p.screenshot({clip: {x: Math.floor(got.rowEnd) - 2, y: got.sampleY, width: Math.ceil(got.innerRight - got.rowEnd) + 6, height: 1}});
          const columns = await p.evaluate(async (data) => {
            const image = new Image();
            image.src = `data:image/png;base64,${data}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width; canvas.height = 1;
            const g = canvas.getContext('2d');
            g.drawImage(image, 0, 0);
            const px = g.getImageData(0, 0, image.width, 1).data;
            const out = [];
            for (let x = 0; x < image.width; x += 1) out.push([px[x * 4], px[x * 4 + 1], px[x * 4 + 2]]);
            return out;
          }, shot.toString('base64'));
          const base = columns[2];
          const differs = columns.map((rgb) => rgb.some((v, i) => Math.abs(v - base[i]) > 24));
          const startX = Math.floor(got.rowEnd) - 2;
          const first = differs.indexOf(true, 3);
          const last = differs.lastIndexOf(true);
          // The panel's own border is the last column that differs; the thumb is
          // the run before it.
          const runs = [];
          for (let x = 3; x < differs.length; x += 1) {
            if (differs[x] && !differs[x - 1]) runs.push([x, x]);
            if (differs[x] && runs.length) runs.at(-1)[1] = x;
          }
          const thumb = runs[0] ?? null;
          const measured = thumb && {
            gapBefore: startX + thumb[0] - got.rowEnd,
            thumb: thumb[1] - thumb[0] + 1,
            gapAfter: got.innerRight - (startX + thumb[1] + 1),
          };
          one.thumb = measured;
          one.runs = runs.map(([a, b]) => [startX + a, startX + b]);
          if (!measured || !near(measured.gapBefore, got.inset) || Math.abs(measured.thumb - got.inset) > 1 || !near(measured.gapAfter, got.inset)) note({case: `${where}: highlight-to-thumb, thumb and thumb-to-edge are each the inset`, got: {measured, runs: one.runs, first, last, got}});
        } else if (headed && got.overflows) {
          note({case: `${where}: headed with classic scrollbars, rows that do not fit draw a scrollbar`, got});
        }
        evidence.scrollbar.push(one);
        if (process.env.SF_PROBE_SHOTS) await p.screenshot({path: `${process.env.SF_PROBE_SHOTS}/menu-${theme}-${size.replace('/', '-')}-${kind.replace(/ /gu, '-')}.png`, clip: await p.evaluate(() => { const r = document.querySelector('#menu .sf-context-menu-content').getBoundingClientRect(); return {x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16}; })});
      }
    }
    await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
    if (errors.length) note({case: `console clean (scrollbar, ${theme})`, got: errors});
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
process.stdout.write(`Context menu inset and overflow: PASS — rows and fills --sf-space-1/4 inside the panel, a control's height, icon and text --sf-space-1/2 inside the highlight; the search header across the panel, its icon and text over the rows'; a drilling head on the rows' edge; at 1/2 and 1, light and dark; no scrollbar beside rows that fit${headed ? ', and a scrollbar in the inset (gap, thumb, gap each --sf-space-1/4), headed Chrome with classic scrollbars' : ''}; no sliver overflow over 120-260px windows, opening down and up\n`);
