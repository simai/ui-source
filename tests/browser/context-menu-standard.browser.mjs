#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The standard menu (owner, 2026-10-12): sf-context-menu given entries and
// opened through openFor(). What it measures is what every hand-made menu in
// the admin did differently -- where it opens, how it closes, where the focus
// goes, and that its rows keep one geometry.
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
  'smart/smart/context-menu/js/context-menu.js',
].map((p) => join(out, p));

const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0;padding:40px">'
    + '<div style="overflow:hidden;block-size:60px;position:relative">'
    + '<button id="trigger" type="button">Действия</button></div>'
    + '<sf-context-menu id="menu" popup aria-label="Действия"></sf-context-menu>'
    + '</body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-context-menu'));
  await page.evaluate(() => {
    const menu = document.getElementById('menu');
    menu.entries = [
      {type: 'heading', text: 'Страница'},
      {id: 'open', text: 'Открыть', icon: 'open_in_new'},
      {id: 'lang', text: 'Язык', icon: 'translate', value: 'Русский', submenu: [
        {id: 'lang:ru', text: 'Русский', kind: 'radio', checked: true},
        {id: 'lang:en', text: 'English', kind: 'radio'},
      ]},
      {id: 'pin', text: 'Закрепить', kind: 'check', checked: false},
      {id: 'off', text: 'Недоступно', disabled: true},
      {id: 'export', text: 'Export CSV', icon: 'download'},
      {type: 'separator'},
      {id: 'archive', text: 'В архив', icon: 'archive', danger: true},
    ];
    window.chosen = [];
    menu.addEventListener('sf-context-menu-select', (event) => window.chosen.push(event.detail.id));
  });
  await page.waitForTimeout(300);

  const closed = await page.evaluate(() => getComputedStyle(document.querySelector('#menu > .sf-context-menu')).display);
  if (closed !== 'none') note({case: 'closed popup is not drawn', got: closed});

  await page.focus('#trigger');
  await page.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await page.waitForTimeout(200);
  const opened = await page.evaluate(() => {
    const surface = document.querySelector('#menu > .sf-context-menu');
    const trigger = document.getElementById('trigger').getBoundingClientRect();
    const box = surface.getBoundingClientRect();
    const rows = [...surface.querySelectorAll('.sf-context-menu-item')];
    const labels = rows.filter((row) => row.querySelector('.sf-context-menu-item-lead'))
      .map((row) => Math.round(row.querySelector('.sf-context-menu-item-text').getBoundingClientRect().left));
    return {
      top: surface.matches(':popover-open'),
      below: box.top >= trigger.bottom,
      startAligned: Math.abs(box.left - trigger.left) <= 1,
      tail: Boolean(surface.querySelector('.sf-context-menu-tooltip')),
      expanded: document.getElementById('trigger').getAttribute('aria-expanded'),
      focus: document.activeElement?.dataset?.sfEntry ?? null,
      roles: rows.map((row) => row.getAttribute('role')),
      heights: [...new Set(rows.filter((row) => !row.querySelector('.sf-context-menu-item-caption'))
        .map((row) => Math.round(row.getBoundingClientRect().height)))],
      labels: [...new Set(labels)],
      checked: rows.find((row) => row.dataset.sfEntry === '3')?.getAttribute('aria-checked'),
    };
  });
  // The trigger sits in a box that clips; a menu in the page would be cut.
  if (!opened.top) note({case: 'an open menu is in the top layer', got: opened});
  if (!opened.below || !opened.startAligned) note({case: 'opens below its trigger, start-aligned', got: opened});
  if (opened.tail) note({case: 'a menu has no tail', got: opened});
  if (opened.expanded !== 'true') note({case: 'the trigger says it is expanded', got: opened});
  if (opened.focus !== '1') note({case: 'focus goes to the first item', got: opened});
  if (opened.roles.join() !== 'menuitem,menuitem,menuitemcheckbox,menuitem,menuitem,menuitem') note({case: 'rows carry their roles', got: opened.roles});
  if (opened.heights.length !== 1) note({case: 'one row height', got: opened.heights});
  if (opened.labels.length !== 1) note({case: 'labels start on one line', got: opened.labels});
  if (opened.checked !== 'false') note({case: 'a check item states its state', got: opened.checked});

  // Down to «Язык», into its submenu, back out, then a letter and Enter.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  const sub = await page.evaluate(() => {
    const menus = document.querySelectorAll('sf-context-menu');
    const child = menus[1]?.querySelector('.sf-context-menu');
    const row = document.querySelector('#menu [data-sf-entry="2"]');
    const first = child?.querySelector('.sf-context-menu-item');
    return {
      count: menus.length,
      inChild: child?.contains(document.activeElement) ?? false,
      side: child?.dataset.sfSide ?? null,
      level: first && row ? Math.abs(first.getBoundingClientRect().top - row.getBoundingClientRect().top) : null,
      radio: first?.getAttribute('role'),
    };
  });
  if (sub.count !== 2 || !sub.inChild || sub.side !== 'inline-end') note({case: 'ArrowRight opens the submenu beside its row', got: sub});
  if (sub.level === null || sub.level > 1) note({case: 'the submenu starts level with its row', got: sub});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const back = await page.evaluate(() => ({
    count: document.querySelectorAll('sf-context-menu').length,
    focus: document.activeElement?.dataset?.sfEntry ?? null,
    open: document.getElementById('menu').isOpen,
  }));
  if (back.count !== 1 || back.focus !== '2' || !back.open) note({case: 'Escape in a submenu returns to its row', got: back});

  // A Latin letter: Playwright types one outside the US layout as inserted
  // text, with no keydown for the menu to read.
  await page.keyboard.press('e');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const done = await page.evaluate(() => ({
    chosen: window.chosen,
    open: document.getElementById('menu').isOpen,
    focus: document.activeElement?.id ?? null,
    expanded: document.getElementById('trigger').getAttribute('aria-expanded'),
  }));
  if (done.chosen.join() !== 'export') note({case: 'typeahead and Enter choose an item', got: done});
  if (done.open || done.focus !== 'trigger' || done.expanded !== 'false') note({case: 'a choice closes and returns focus', got: done});

  // A press outside closes without taking the focus anywhere.
  await page.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await page.waitForTimeout(150);
  await page.mouse.click(860, 660);
  const outside = await page.evaluate(() => document.getElementById('menu').isOpen);
  if (outside) note({case: 'a press outside closes', got: outside});

  // A profile menu: who it is about, a choice row, and a submenu with a search.
  await page.evaluate(() => {
    const menu = document.getElementById('menu');
    menu.entries = [
      {type: 'header', text: 'Анна Белова', caption: ['anna@example.com', 'Администратор']},
      {type: 'separator'},
      {type: 'choice', id: 'theme', text: 'Тема', options: [
        {id: 'light', text: 'Светлая', icon: 'light_mode', checked: true},
        {id: 'dark', text: 'Тёмная', icon: 'dark_mode'},
        {id: 'system', text: 'Как в системе', icon: 'contrast'},
      ]},
      {id: 'lang', text: 'Language', icon: 'translate', value: 'Русский', search: {placeholder: 'Find', empty: 'Nothing'}, submenu: [
        {id: 'ru', text: 'Русский', caption: 'Russian', kind: 'radio', checked: true, lang: 'ru'},
        {id: 'en', text: 'English', caption: 'English', kind: 'radio', lang: 'en'},
        {id: 'de', text: 'Deutsch', caption: 'German', kind: 'radio', lang: 'de'},
        {id: 'fr', text: 'Français', caption: 'French', kind: 'radio', lang: 'fr'},
      ]},
      {type: 'note', text: 'Язык интерфейса.'},
    ];
    window.chosen = [];
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await page.waitForTimeout(200);
  const profile = await page.evaluate(() => {
    const surface = document.querySelector('#menu > .sf-context-menu');
    return {
      header: surface.querySelector('.sf-context-menu-header-name')?.textContent.trim() ?? null,
      initials: surface.querySelector('.sf-context-menu-header-avatar')?.textContent.trim() ?? null,
      headerFocusable: Boolean(surface.querySelector('.sf-context-menu-header button, .sf-context-menu-header [tabindex]')),
      options: [...surface.querySelectorAll('.sf-context-menu-choice-option')].map((one) => one.getAttribute('aria-checked')),
      focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent.trim() ?? null,
    };
  });
  if (profile.header !== 'Анна Белова' || profile.initials !== 'АБ' || profile.headerFocusable) note({case: 'a header is read, not chosen', got: profile});
  if (profile.options.join() !== 'true,false,false') note({case: 'a choice row states its choice', got: profile});
  if (profile.focus !== 'Светлая') note({case: 'focus starts on the first item, past the header', got: profile});

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const chose = await page.evaluate(() => ({
    chosen: window.chosen,
    open: document.getElementById('menu').isOpen,
    options: [...document.querySelectorAll('#menu .sf-context-menu-choice-option')].map((one) => one.getAttribute('aria-checked')),
  }));
  if (chose.chosen.join() !== 'dark' || !chose.open || chose.options.join() !== 'false,true,false') {
    note({case: 'a choice is marked at once and the menu stays open', got: chose});
  }

  // Into the languages by a pointer: the field still takes the focus and the
  // letters -- a person who opened a list to find something types next.
  await page.click('#menu [aria-haspopup="menu"]');
  await page.waitForTimeout(250);
  const squeezed = await page.evaluate(() => {
    const child = document.querySelectorAll('sf-context-menu')[1];
    const content = child?.querySelector('.sf-context-menu-content');
    if (content) content.style.maxBlockSize = '80px';
    const rows = [...(child?.querySelectorAll('.sf-context-menu-item') ?? [])];
    const heights = rows.map((row) => Math.round(row.getBoundingClientRect().height));
    if (content) content.style.maxBlockSize = '';
    return heights;
  });
  if (new Set(squeezed).size !== 1 || squeezed[0] < 30) note({case: 'a short window scrolls the rows, it does not squeeze them', got: squeezed});
  const field = await page.evaluate(() => document.activeElement?.classList.contains('sf-context-menu-search-input'));
  if (!field) note({case: 'a searchable submenu opens on its field', got: field});
  await page.keyboard.type('ger');
  await page.waitForTimeout(150);
  const found = await page.evaluate(() => {
    const child = document.querySelectorAll('sf-context-menu')[1];
    return {
      rows: [...child.querySelectorAll('.sf-context-menu-item-label')].map((node) => node.textContent.trim()),
      value: child.querySelector('.sf-context-menu-search-input')?.value,
      lang: child.querySelector('.sf-context-menu-item')?.getAttribute('lang'),
    };
  });
  if (found.rows.join() !== 'Deutsch' || found.value !== 'ger' || found.lang !== 'de') note({case: 'the search narrows by label and caption', got: found});
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const picked = await page.evaluate(() => ({chosen: window.chosen, open: document.getElementById('menu').isOpen}));
  if (picked.chosen.at(-1) !== 'de' || picked.open) note({case: 'ArrowDown leaves the field for the rows, Enter chooses', got: picked});

  // Opened while nothing has the focus, it returns the focus to its anchor's
  // own control: an sf-button host is not focusable, its button is.
  const returned = await page.evaluate(async () => {
    const host = document.createElement('sf-button');
    host.id = 'host-anchor';
    host.setAttribute('text', 'Ещё');
    document.body.append(host);
    await host.whenRendered?.();
    document.activeElement?.blur?.();
    const menu = document.getElementById('menu');
    await menu.openFor(host, {focus: 'first'});
    menu.close();
    return document.activeElement === host.querySelector('button');
  });
  if (!returned) note({case: 'focus returns to the anchor\'s own control when it was nowhere', got: returned});

  // A list the host searches (sites): pictures in the lead, the query told to
  // the host, and the entries it sets shown as they are.
  const remote = await page.evaluate(async () => {
    const menu = document.getElementById('menu');
    const all = [
      {id: 'a', text: 'simai.ru', caption: 'Сайт компании', initials: 'S', kind: 'radio', checked: true},
      {id: 'b', text: 'shop.simai.ru', caption: 'Магазин', initials: 'M', kind: 'radio'},
    ];
    menu.search = {placeholder: 'Найти сайт', empty: 'Ничего', remote: true};
    menu.entries = all;
    const queries = [];
    menu.addEventListener('sf-context-menu-search', (event) => {
      queries.push(event.detail.query);
      menu.entries = all.filter((entry) => entry.text.startsWith(event.detail.query));
    });
    await menu.openFor(document.getElementById('trigger'));
    await new Promise((done) => setTimeout(done, 100));
    const field = menu.querySelector('.sf-context-menu-search-input');
    field.value = 'shop';
    field.dispatchEvent(new Event('input', {bubbles: true}));
    await new Promise((done) => setTimeout(done, 150));
    const rows = [...menu.querySelectorAll('.sf-context-menu-item-label')].map((node) => node.textContent.trim());
    const avatar = menu.querySelector('.sf-context-menu-item-avatar')?.textContent.trim();
    menu.close({restoreFocus: false});
    menu.search = null;
    return {queries, rows, avatar, focusWasField: true};
  });
  if (remote.queries.join() !== 'shop' || remote.rows.join() !== 'shop.simai.ru' || remote.avatar !== 'M') {
    note({case: 'a host-searched list tells the query and shows what the host set', got: remote});
  }

  // The host-rendered menu keeps its old contract: no lifecycle of its own.
  const host = await page.evaluate(async () => {
    const legacy = document.createElement('sf-context-menu');
    legacy.setAttribute('aria-label', 'Old');
    legacy.innerHTML = '<sf-button slot="content" text="One"></sf-button>';
    document.body.append(legacy);
    await legacy.whenRendered();
    return getComputedStyle(legacy.querySelector('.sf-context-menu')).display;
  });
  if (host === 'none') note({case: 'a menu without popup is drawn in place, as before', got: host});
  await page.close();
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} standard menu check(s) failed`);
}
process.stdout.write('Context menu standard: PASS — top layer, start-aligned, keyboard, submenu, focus return\n');
