#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A search the host answers (search.remote) keeps the menu open whatever the
// host answers (docs thread, bus msg-da670440b2ce4ad2a802, 2026-11-07): a host
// that set no entries for a query closed the menu and dropped the focus to the
// body, where a local search showed its empty note under a field that kept the
// focus. Driven here, as a person types: an empty answer, at once and after a
// delay; rows again after an empty answer; a host whose lookup failed (the
// listener throws, or answers with no rows); an answer that comes late, after
// the field was cleared. Each time the menu stays open, the field keeps the
// focus and what was typed, and the note says nothing was found while no row
// is shown. A wheel past the end of the rows leaves the page behind the menu
// where it is (overscroll-behavior: contain). Light and dark, three loads each.
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
const EMPTY = 'Ничего не найдено';

async function page(theme) {
  const one = await browser.newPage({viewport: {width: 900, height: 700}});
  const errors = [];
  // The host that throws on purpose reports its own error; that one is the
  // case's, not the menu's. A bundle injected by addScriptTag has no script
  // URL for webpack to read its public path from: that message is the harness's.
  const foreign = (text) => /Automatic publicPath|lookup failed/u.test(text);
  one.on('pageerror', (error) => { if (!foreign(String(error))) errors.push(String(error)); });
  one.on('console', (message) => { if (message.type() === 'error' && !foreign(message.text())) errors.push(message.text()); });
  await one.setContent(
    `<!doctype html><html class="theme-${theme}" lang="ru"><head><meta charset="utf-8"></head><body style="margin:0;padding:40px">`
    + '<button id="trigger" type="button">Сайт</button>'
    + '<sf-menu-context id="menu" popup aria-label="Сайт"></sf-menu-context>'
    + '</body></html>',
  );
  for (const path of styles) await one.addStyleTag({path}).catch(() => {});
  for (const path of modules) await one.addScriptTag({path, type: 'module'}).catch(() => {});
  await one.waitForFunction(() => customElements.get('sf-menu-context'));
  // The host: a list of sites it searches, answering at once or after a delay,
  // failing on demand. window.mode picks how it answers the next query.
  await one.evaluate((empty) => {
    const SITES = ['simai.io', 'shop.simai.io', 'docs.simai.io', 'larena.dev', 'example.com'];
    const rowsFor = (query) => SITES.filter((site) => site.includes(query)).map((site) => ({id: site, text: site, kind: 'radio'}));
    const menu = document.getElementById('menu');
    window.mode = 'now';
    window.pending = [];
    menu.search = {placeholder: 'Найти сайт', empty, remote: true};
    menu.entries = rowsFor('');
    menu.addEventListener('sf-menu-context-search', (event) => {
      const query = event.detail.query;
      if (window.mode === 'none') return;
      if (window.mode === 'throw') throw new Error('lookup failed');
      if (window.mode === 'fail-empty') { menu.entries = []; return; }
      if (window.mode === 'hold') { window.pending.push(() => { menu.entries = rowsFor(query); }); return; }
      if (window.mode === 'later') { setTimeout(() => { menu.entries = rowsFor(query); }, 200); return; }
      menu.entries = rowsFor(query);
    });
  }, EMPTY);
  return {page: one, errors};
}

const STATE = `(() => {
  const menu = document.getElementById('menu');
  const surface = menu.querySelector(':scope > .sf-context-menu');
  const field = menu.querySelector('.sf-context-menu-search-input');
  const noteNode = menu.querySelector('.sf-context-menu-note');
  return {
    open: menu.isOpen,
    shown: Boolean(surface?.matches(':popover-open') && surface.getBoundingClientRect().height > 0),
    field: Boolean(field),
    focused: Boolean(field) && document.activeElement === field,
    active: document.activeElement?.localName ?? null,
    value: field?.value ?? null,
    rows: [...menu.querySelectorAll('.sf-context-menu-item')].map((row) => row.textContent.trim()),
    note: noteNode?.textContent.trim() ?? null,
    noteInList: Boolean(noteNode?.closest('.sf-context-menu-list')),
  };
})()`;

const state = (p) => p.evaluate(STATE);

function expectEmpty(where, got, value) {
  if (!got.open || !got.shown) note({case: `${where}: the menu stays open`, got});
  if (!got.field || !got.focused) note({case: `${where}: the field keeps the focus`, got});
  if (got.value !== value) note({case: `${where}: the field keeps what was typed`, want: value, got});
  if (got.rows.length) note({case: `${where}: no row is shown`, got});
  if (got.note !== EMPTY || !got.noteInList) note({case: `${where}: the empty note stands under the field`, got});
}

function expectRows(where, got, value, rows) {
  if (!got.open || !got.shown) note({case: `${where}: the menu stays open`, got});
  if (!got.field || !got.focused) note({case: `${where}: the field keeps the focus`, got});
  if (got.value !== value) note({case: `${where}: the field keeps what was typed`, want: value, got});
  if (got.rows.join('|') !== rows.join('|')) note({case: `${where}: the host's rows are shown`, want: rows, got});
  if (got.note !== null) note({case: `${where}: no empty note beside rows`, got});
}

async function reopen(p, mode = 'now') {
  await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
  await p.evaluate((m) => {
    window.mode = 'now';
    const menu = document.getElementById('menu');
    menu.entries = ['simai.io', 'shop.simai.io', 'docs.simai.io', 'larena.dev', 'example.com'].map((site) => ({id: site, text: site, kind: 'radio'}));
    window.mode = m;
  }, mode);
  await p.waitForTimeout(50);
  await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await p.waitForTimeout(100);
}

const evidence = {};
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 3; load += 1) {
      const {page: p, errors} = await page(theme);
      const at = `${theme} #${load}`;
      await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
      await p.waitForTimeout(100);
      const opened = await state(p);
      if (!opened.focused || opened.rows.length !== 5) note({case: `opened on the field with the host's rows (${at})`, got: opened});

      // 1. The host answers at once with nothing.
      await p.keyboard.type('zzz');
      await p.waitForTimeout(80);
      const empty = await state(p);
      expectEmpty(`an empty answer (${at})`, empty, 'zzz');
      if (theme === 'light' && load === 1) evidence.empty = empty;

      // 2. Rows again after the empty answer: the person corrects the query.
      for (let i = 0; i < 3; i += 1) await p.keyboard.press('Backspace');
      await p.keyboard.type('shop');
      await p.waitForTimeout(80);
      expectRows(`rows after an empty answer (${at})`, await state(p), 'shop', ['shop.simai.io']);
      // ↓ still goes from the field to the row.
      await p.keyboard.press('ArrowDown');
      const walked = await p.evaluate(() => document.activeElement?.textContent.trim());
      if (walked !== 'shop.simai.io') note({case: `↓ goes to the host's row (${at})`, got: walked});

      // 3. The host answers later with nothing.
      await reopen(p, 'later');
      await p.keyboard.type('qq');
      await p.waitForTimeout(400);
      expectEmpty(`a late empty answer (${at})`, await state(p), 'qq');
      // And typing on after it still reaches the host.
      await p.keyboard.press('Backspace');
      await p.keyboard.press('Backspace');
      await p.keyboard.type('dev');
      await p.waitForTimeout(400);
      expectRows(`a late answer with rows after an empty one (${at})`, await state(p), 'dev', ['larena.dev']);

      // 4. The host's lookup failed and it answers with no rows.
      await reopen(p, 'fail-empty');
      await p.keyboard.type('a');
      await p.waitForTimeout(80);
      expectEmpty(`a failed lookup answered with no rows (${at})`, await state(p), 'a');

      // 5. The host's listener throws: the menu keeps what it showed and stays.
      await reopen(p, 'throw');
      await p.keyboard.type('x');
      await p.waitForTimeout(80);
      const thrown = await state(p);
      if (!thrown.open || !thrown.shown || !thrown.focused || thrown.value !== 'x') note({case: `a host that throws leaves the menu open on its field (${at})`, got: thrown});

      // 6. A late empty answer after the field was cleared: the person typed,
      // cleared the field, and the answer to the old query arrives last.
      await reopen(p, 'hold');
      await p.keyboard.type('zz');
      await p.waitForTimeout(50);
      await p.keyboard.press('Backspace');
      await p.keyboard.press('Backspace');
      await p.waitForTimeout(50);
      // Answers: 'z', then '' (all rows), then the stale 'z' and 'zz' -- the empty one last.
      await p.evaluate(() => { const order = [window.pending[2], window.pending[3], window.pending[0], window.pending[1]]; for (const run of order) run?.(); });
      await p.waitForTimeout(80);
      const stale = await state(p);
      if (!stale.open || !stale.shown || !stale.focused || stale.value !== '') note({case: `a stale empty answer after the field was cleared keeps the menu open on its field (${at})`, got: stale});
      if (!stale.rows.length && stale.note !== EMPTY) note({case: `a stale empty answer says nothing was found (${at})`, got: stale});
      // Typing again brings the rows back.
      await p.evaluate(() => { window.mode = 'now'; });
      await p.keyboard.type('docs');
      await p.waitForTimeout(80);
      expectRows(`typing after a stale empty answer (${at})`, await state(p), 'docs', ['docs.simai.io']);

      // Escape still closes it and returns the focus to the trigger.
      await p.keyboard.press('Escape');
      await p.waitForTimeout(80);
      const closed = await p.evaluate(() => ({open: document.getElementById('menu').isOpen, active: document.activeElement?.id}));
      if (closed.open || closed.active !== 'trigger') note({case: `Escape closes the menu to its trigger (${at})`, got: closed});

      // 7. A wheel past the end of the rows stays in the menu (admin.simai.io
      // profile language, 2026-11-07): the page behind it does not scroll. The
      // rows' area under the search, then a menu without a search.
      await p.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.blockSize = '3000px';
        document.body.append(spacer);
        window.scrollTo(0, 0);
        const many = Array.from({length: 40}, (_, index) => ({id: `s${index}`, text: `site-${index}.simai.io`, kind: 'radio'}));
        window.mode = 'none';
        const menu = document.getElementById('menu');
        menu.entries = many;
      });
      for (const searched of [true, false]) {
        await p.evaluate((on) => {
          const menu = document.getElementById('menu');
          menu.search = on ? {placeholder: 'Найти сайт', empty: 'Ничего не найдено', remote: true} : null;
        }, searched);
        await p.waitForTimeout(50);
        await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
        await p.waitForTimeout(150);
        const area = await p.evaluate((on) => {
          const menu = document.getElementById('menu');
          const node = menu.querySelector(on ? '.sf-context-menu-list' : '.sf-context-menu-content');
          node.style.maxBlockSize = '200px';
          const box = node.getBoundingClientRect();
          return {x: box.left + box.width / 2, y: box.top + box.height / 2, overscroll: getComputedStyle(node).overscrollBehaviorY, scrolls: node.scrollHeight > node.clientHeight + 1};
        }, searched);
        await p.mouse.move(area.x, area.y);
        for (let i = 0; i < 12; i += 1) { await p.mouse.wheel(0, 400); await p.waitForTimeout(30); }
        await p.waitForTimeout(200);
        const after = await p.evaluate((on) => {
          const node = document.getElementById('menu').querySelector(on ? '.sf-context-menu-list' : '.sf-context-menu-content');
          return {page: window.scrollY, atEnd: node.scrollTop + node.clientHeight >= node.scrollHeight - 1};
        }, searched);
        const where = searched ? 'the rows under a search' : 'a menu without a search';
        if (area.overscroll !== 'contain' || !area.scrolls || !after.atEnd || after.page !== 0) note({case: `a wheel past the end of ${where} leaves the page where it is (${at})`, got: {area, after}});
        await p.evaluate(() => document.getElementById('menu').close({restoreFocus: false}));
        await p.waitForTimeout(80);
      }

      if (errors.length) note({case: `console clean (${at})`, got: errors});
      await p.close();
    }
  }
} finally {
  await browser.close();
}
if (process.env.SF_PROBE_EVIDENCE) process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} host search check(s) failed`);
}
process.stdout.write('Context menu host search: PASS — empty, late, failed, thrown and stale answers keep the menu open on its field with the empty note; rows come back; a wheel past the end stays in the menu; light and dark, three loads each\n');
