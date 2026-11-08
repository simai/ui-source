#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A menu with a search keeps its field where it is (docs review R012, R013,
// owner 2026-11-07): the field and the rows were one scrolling content, so the
// field scrolled away with the list and the scrollbar ran beside it, and the
// field stood a step of space from the panel's edge. Measured here: the field
// does not move while the rows scroll, the scroll area begins under the field,
// the header and the rows' area are the ladder's (owner C06, R029: the search is a header, a row's height and the
// inset above and below, its icon and text over the rows' -- the inset and the row's padding before them -- a
// hairline under it across the panel; the rows' area padded by the inset, --sf-space-1/4, on every side),
// the rows keep the axis they have without a search, and the keys, the empty
// note and the height cap still work -- at the top level, in a flyout submenu
// and on a drilling level.
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

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

const LANGUAGES = ['Русский', 'English', 'Deutsch', 'Français', 'Español', 'Italiano', 'Português', 'Polski',
  'Čeština', 'Nederlands', 'Svenska', 'Suomi', 'Dansk', 'Norsk', 'Türkçe', 'Ελληνικά', 'Magyar', 'Română',
  'Українська', 'Қазақша', '日本語', '中文', '한국어', 'العربية'];
const rows = () => LANGUAGES.map((text, index) => ({id: `l${index}`, text, kind: 'radio', checked: index === 0}));

// What the probe measures on one surface: the field, the scroll area, the
// content, and the first row.
const MEASURE = `(surface) => {
  const box = (node) => node ? node.getBoundingClientRect() : null;
  const content = surface.querySelector('.sf-context-menu-content');
  const search = surface.querySelector('.sf-context-menu-search');
  const field = surface.querySelector('.sf-context-menu-search-input');
  const list = surface.querySelector('.sf-context-menu-list');
  const head = surface.querySelector('.sf-context-menu-drill-head');
  const row = surface.querySelector('.sf-context-menu-item');
  const style = (node) => node ? getComputedStyle(node) : null;
  const s = style(search), l = style(list), c = style(content);
  return {
    searchClass: Boolean(content?.classList.contains('sf-context-menu-content--search')),
    fieldTop: box(field)?.top ?? null,
    fieldBottom: box(field)?.bottom ?? null,
    searchBottom: box(search)?.bottom ?? null,
    headTop: box(head)?.top ?? null,
    listTop: box(list)?.top ?? null,
    listClientTop: list ? box(list).top + list.clientTop : null,
    contentTop: box(content)?.top ?? null,
    contentLeft: box(content)?.left ?? null,
    contentScrolls: content ? content.scrollHeight > content.clientHeight + 1 : null,
    contentOverflowY: c?.overflowY ?? null,
    listScrolls: list ? list.scrollHeight > list.clientHeight + 1 : null,
    listScrollTop: list?.scrollTop ?? null,
    contentScrollTop: content?.scrollTop ?? null,
    searchPadding: s ? [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat) : null,
    listPadding: l ? [l.paddingTop, l.paddingRight, l.paddingBottom, l.paddingLeft].map(parseFloat) : null,
    contentPadding: c ? [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(parseFloat) : null,
    fieldLeft: box(field) ? box(field).left - box(content).left : null,
    fieldRight: box(field) ? box(content).right - box(field).right : null,
    rowLeft: row ? box(row).left - box(content).left : null,
    rowTextLeft: row ? (box(row.querySelector('.sf-context-menu-item-label, .sf-context-menu-item-text') ?? row).left - box(content).left) : null,
    rowHeight: row ? box(row).height : null,
    contentHeight: box(content)?.height ?? null,
    searchLeft: box(search) ? box(search).left - box(content).left : null,
    searchRight: box(search) ? box(content).right - box(search).right : null,
    searchHeight: box(search)?.height ?? null,
    searchLine: s ? [s.borderBottomWidth, s.borderTopWidth, s.borderLeftWidth].map(parseFloat) : null,
    searchIconLeft: box(surface.querySelector('.sf-context-menu-search-icon'))?.left ?? null,
    rowIconLeft: box(row?.querySelector('.sf-context-menu-item-lead'))?.left ?? null,
    fieldTextLeft: box(field) ? box(field).left : null,
    rowTextAbsLeft: row ? box(row.querySelector('.sf-context-menu-item-label, .sf-context-menu-item-text') ?? row).left : null,
    hasLead: Boolean(row?.querySelector('.sf-context-menu-item-lead')),
    border: c ? parseFloat(c.borderLeftWidth) : null,
    tokens: (() => {
      const read = (name) => { const n = document.createElement('span'); n.style.cssText = 'position:absolute;visibility:hidden;inline-size:var(' + name + ')'; content.append(n); const w = n.getBoundingClientRect().width; n.remove(); return w; };
      return {inset: read('--sf-space-1\\\\/4'), pad: read('--sf-space-1\\\\/2'), gap: read('--sf-space-1\\\\/2'), rowHeight: read('--sf-context-menu--row-height')};
    })(),
  };
}`;

async function page(theme = 'light') {
  const one = await browser.newPage({viewport: {width: 900, height: 700}});
  const errors = [];
  one.on('pageerror', (error) => { if (!/Automatic publicPath/u.test(String(error))) errors.push(String(error)); });
  // A bundle injected by addScriptTag has no script URL for webpack to read
  // its public path from: that one message is the harness's, not the menu's.
  one.on('console', (message) => { if (message.type() === 'error' && !/Automatic publicPath/u.test(message.text())) errors.push(message.text()); });
  await one.setContent(
    `<!doctype html><html class="theme-${theme}" lang="ru"><body style="margin:0;padding:40px">`
    + '<button id="trigger" type="button">Язык</button>'
    + '<sf-menu-context id="menu" popup aria-label="Язык"></sf-menu-context>'
    + '</body></html>',
  );
  for (const path of styles) await one.addStyleTag({path}).catch(() => {});
  for (const path of modules) await one.addScriptTag({path, type: 'module'}).catch(() => {});
  await one.waitForFunction(() => customElements.get('sf-menu-context'));
  return {page: one, errors};
}

// The field stays while the rows scroll: the scroll area is scrolled to its
// end and the field's top is measured again.
async function scrolled(target, surfaceSelector) {
  return target.evaluate(([selector, measure]) => {
    const surface = document.querySelectorAll(selector)[document.querySelectorAll(selector).length - 1];
    const read = eval(measure);
    const before = read(surface);
    const list = surface.querySelector('.sf-context-menu-list');
    if (list) list.scrollTop = list.scrollHeight;
    surface.querySelector('.sf-context-menu-content').scrollTop = 10000;
    const after = read(surface);
    return {before, after};
  }, [surfaceSelector, MEASURE]);
}

function checkLayout(where, {before, after}) {
  if (!before.searchClass) note({case: `${where}: the menu says it has a search`, got: before.searchClass});
  if (Math.abs(before.fieldTop - after.fieldTop) > 0.5) note({case: `${where}: the field stays where it is while the rows scroll`, got: [before.fieldTop, after.fieldTop]});
  if (!before.listScrolls) note({case: `${where}: the rows scroll in their own area`, got: before});
  if (after.listScrollTop <= 0) note({case: `${where}: the scroll area moved`, got: after.listScrollTop});
  if (before.contentScrolls || after.contentScrollTop !== 0 || before.contentOverflowY !== 'hidden') note({case: `${where}: the content does not scroll`, got: {scrolls: before.contentScrolls, top: after.contentScrollTop, overflow: before.contentOverflowY}});
  if (before.listTop < before.searchBottom - 0.5 || before.listTop < before.fieldBottom) note({case: `${where}: the scroll area begins under the field`, got: {field: before.fieldBottom, search: before.searchBottom, list: before.listTop}});
  const {inset, pad, rowHeight} = before.tokens;
  const near = (a, b) => Math.abs(a - b) <= 0.5;
  const sp = before.searchPadding;
  if (!near(sp[0], 0) || !near(sp[2], 0) || !near(sp[1], inset + pad) || !near(sp[3], inset + pad)) note({case: `${where}: the header's text starts at the inset and the row's padding`, got: {padding: sp, inset, pad}});
  const lp = before.listPadding;
  if (![0, 2, 3].every((i) => near(lp[i], inset)) || !(near(lp[1], inset) || near(lp[1], 0))) note({case: `${where}: the rows' area is padded by the inset`, got: {padding: lp, inset}});
  if (before.contentPadding.join() !== '0,0,0,0') note({case: `${where}: the content has no padding of its own`, got: before.contentPadding});
  // The header spans the panel inside its border, a hairline under it, no frame.
  if (!near(before.searchLeft, before.border) || !near(before.searchRight, before.border)) note({case: `${where}: the header spans the panel`, got: [before.searchLeft, before.searchRight]});
  if (!near(before.searchLine[0], 1) || before.searchLine[1] !== 0 || before.searchLine[2] !== 0) note({case: `${where}: a hairline under the header and no frame`, got: before.searchLine});
  if (!near(before.searchHeight, rowHeight + 2 * inset)) note({case: `${where}: the header is a row and the inset above and below`, got: {height: before.searchHeight, rowHeight, inset}});
  if (!near(before.rowHeight, rowHeight)) note({case: `${where}: a row is a control's height`, got: {row: before.rowHeight, rowHeight}});
  // The text over the rows' text, always; the icon over the rows' icons, or,
  // in a menu without a leading column, at the header's end (C06, DEV
  // measurement 2026-11-08: text over text).
  if (!near(before.fieldTextLeft, before.rowTextAbsLeft)) note({case: `${where}: the search text stands over the rows' text`, got: {field: before.fieldTextLeft, row: before.rowTextAbsLeft}});
  if (before.hasLead && !near(before.searchIconLeft, before.rowIconLeft)) note({case: `${where}: the search icon stands over the rows' icon`, got: {icon: before.searchIconLeft, row: before.rowIconLeft}});
  if (!before.hasLead && !(before.searchIconLeft > before.fieldTextLeft)) note({case: `${where}: without a leading column the search icon stands at the header's end`, got: {icon: before.searchIconLeft, field: before.fieldTextLeft}});
}

const evidence = {};
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 3; load += 1) {
      const {page: p, errors} = await page(theme);

      // A menu without a search: as before -- no list, the content scrolls.
      await p.evaluate((list) => {
        const menu = document.getElementById('menu');
        menu.entries = list;
      }, rows());
      await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
      await p.waitForTimeout(150);
      const plain = await p.evaluate((measure) => {
        const surface = document.querySelector('#menu > .sf-context-menu');
        surface.querySelector('.sf-context-menu-content').style.maxBlockSize = '240px';
        return eval(measure)(surface);
      }, MEASURE);
      if (plain.searchClass || plain.listTop !== null || plain.contentOverflowY !== 'auto' || !plain.contentScrolls) note({case: 'a menu without search draws as before', got: plain});
      await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
      await p.waitForTimeout(100);

      // The top level with a search, capped at 240px.
      await p.evaluate(() => {
        const menu = document.getElementById('menu');
        menu.search = {placeholder: 'Найти язык', empty: 'Ничего не найдено'};
      });
      await p.waitForTimeout(100);
      await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
      await p.waitForTimeout(150);
      await p.evaluate(() => { document.querySelector('#menu .sf-context-menu-content').style.maxBlockSize = '240px'; });
      await p.waitForTimeout(50);
      const top = await scrolled(p, '#menu > .sf-context-menu');
      checkLayout(`top level (${theme} #${load})`, top);
      if (Math.abs(top.before.contentHeight - 240) > 0.5) note({case: 'the menu keeps its height cap', got: top.before.contentHeight});
      // The rows stand where they stand without a search.
      if (Math.abs(top.before.rowLeft - plain.rowLeft) > 0.5 || Math.abs(top.before.rowTextLeft - plain.rowTextLeft) > 0.5) note({case: 'the rows keep their axis', got: {search: [top.before.rowLeft, top.before.rowTextLeft], plain: [plain.rowLeft, plain.rowTextLeft]}});
      if (Math.abs(top.before.rowHeight - plain.rowHeight) > 0.5) note({case: 'the rows keep their height', got: [top.before.rowHeight, plain.rowHeight]});
      if (theme === 'light' && load === 1) {
        evidence.plain = plain;
        evidence.top = top;
        await p.evaluate(() => { document.querySelector('#menu .sf-context-menu-list').scrollTop = 0; });
        await p.screenshot({path: join(process.env.SF_PROBE_SHOTS ?? '/tmp', 'menu-search-top.png'), clip: {x: 20, y: 40, width: 360, height: 320}}).catch(() => {});
      }

      // Keys: the field holds the focus while typing; ↓ goes into the rows;
      // walking to the last row scrolls the rows, never the field.
      await p.evaluate(() => { document.querySelector('#menu .sf-context-menu-list').scrollTop = 0; });
      const focus = await p.evaluate(() => document.activeElement?.classList.contains('sf-context-menu-search-input'));
      if (!focus) note({case: 'the field takes the focus on opening', got: focus});
      await p.keyboard.type('s');
      const typing = await p.evaluate(() => ({
        field: document.activeElement?.classList.contains('sf-context-menu-search-input'),
        value: document.activeElement?.value,
        rows: document.querySelectorAll('#menu .sf-context-menu-list .sf-context-menu-item').length,
      }));
      if (!typing.field || typing.value !== 's' || typing.rows === 0 || typing.rows >= LANGUAGES.length) note({case: 'typing keeps the focus in the field and narrows the rows', got: typing});
      await p.keyboard.press('Backspace');
      await p.waitForTimeout(50);
      const fieldTop = await p.evaluate(() => document.querySelector('#menu .sf-context-menu-search-input').getBoundingClientRect().top);
      await p.keyboard.press('ArrowDown');
      const first = await p.evaluate(() => document.activeElement?.textContent.trim().split('\n')[0]);
      if (first !== LANGUAGES[0]) note({case: '↓ goes from the field to the first row', got: first});
      for (let i = 1; i < LANGUAGES.length; i += 1) await p.keyboard.press('ArrowDown');
      const walked = await p.evaluate(() => {
        const active = document.activeElement;
        const list = document.querySelector('#menu .sf-context-menu-list');
        const field = document.querySelector('#menu .sf-context-menu-search-input');
        const a = active.getBoundingClientRect(), l = list.getBoundingClientRect();
        return {text: active.textContent.trim().split('\n')[0], listTop: list.scrollTop, fieldTop: field.getBoundingClientRect().top, inView: a.top >= l.top - 0.5 && a.bottom <= l.bottom + 0.5};
      });
      if (walked.text !== LANGUAGES.at(-1) || walked.listTop <= 0 || Math.abs(walked.fieldTop - fieldTop) > 0.5 || !walked.inView) note({case: 'walking the rows scrolls the rows, the field stays and the row is in view', got: walked});

      // The empty note stands in the rows' area, under the field.
      await p.evaluate(() => document.querySelector('#menu .sf-context-menu-search-input').focus());
      await p.keyboard.type('qqq');
      await p.waitForTimeout(50);
      const empty = await p.evaluate(() => {
        const noteNode = document.querySelector('#menu .sf-context-menu-note');
        return {text: noteNode?.textContent.trim() ?? null, inList: Boolean(noteNode?.closest('.sf-context-menu-list')), field: document.activeElement?.classList.contains('sf-context-menu-search-input')};
      });
      if (empty.text !== 'Ничего не найдено' || !empty.inList || !empty.field) note({case: 'the empty note stands in the rows\' area', got: empty});
      await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
      await p.waitForTimeout(100);

      // A flyout submenu with a search, as a profile menu's language.
      await p.evaluate((list) => {
        const menu = document.getElementById('menu');
        menu.search = null;
        menu.entries = [
          {id: 'open', text: 'Открыть', icon: 'open_in_new'},
          {id: 'lang', text: 'Язык', icon: 'translate', value: 'Русский', search: {placeholder: 'Найти язык', empty: 'Ничего'}, submenu: list},
        ];
      }, rows());
      await p.waitForTimeout(100);
      await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
      await p.waitForTimeout(150);
      await p.click('#menu [aria-haspopup="menu"]');
      await p.waitForTimeout(250);
      await p.evaluate(() => {
        const child = [...document.querySelectorAll('sf-menu-context')].at(-1);
        child.querySelector('.sf-context-menu-content').style.maxBlockSize = '240px';
      });
      await p.waitForTimeout(50);
      const sub = await scrolled(p, 'sf-menu-context > .sf-context-menu');
      checkLayout(`flyout submenu (${theme} #${load})`, sub);
      if (theme === 'light' && load === 1) evidence.submenu = sub;
      await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
      await p.waitForTimeout(100);

      // A drilling level with a search: its head and its field stay on top.
      await p.evaluate(() => document.getElementById('menu').setAttribute('submenu', 'drill'));
      await p.waitForTimeout(100);
      await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
      await p.waitForTimeout(150);
      await p.click('#menu [aria-haspopup="menu"]');
      await p.waitForTimeout(250);
      await p.evaluate(() => { document.querySelector('#menu .sf-context-menu-content').style.maxBlockSize = '240px'; });
      await p.waitForTimeout(50);
      const drill = await scrolled(p, '#menu > .sf-context-menu');
      checkLayout(`drilling level (${theme} #${load})`, drill);
      if (drill.before.headTop === null || Math.abs(drill.before.headTop - drill.after.headTop) > 0.5 || drill.before.headTop > drill.before.fieldTop) note({case: 'the drilling head stays on top with the field', got: drill});
      if (theme === 'light' && load === 1) evidence.drill = drill;
      await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
      await p.waitForTimeout(100);

      if (errors.length) note({case: `console clean (${theme} #${load})`, got: errors});
      await p.close();
    }
  }
} finally {
  await browser.close();
}
if (process.env.SF_PROBE_EVIDENCE) process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} menu search check(s) failed`);
}
process.stdout.write('Context menu search: PASS — the field stays, the rows scroll under it, the header over the rows icon and text, the inset around the rows, keys and empty note kept, top level, flyout and drill, light and dark, three loads each\n');
