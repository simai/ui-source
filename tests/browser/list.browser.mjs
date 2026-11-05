#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-list on the built bytes (block list, 2026-11-05; duplication audit A-4):
// - rows from data drawn as sf-list-item, grouped by the reader's calendar day
//   (Сегодня, Вчера, …; undated last) or by the host's key in its order;
// - the open row is aria-current and tinted;
// - the whole list is one Tab stop, arrows and Home/End cross the groups, the
//   «⋯» buttons are not stops; Enter opens a row (keyboard), a press too
//   (pointer);
// - F2 renames in place: the field stands as tall as the row, Enter keeps and
//   says rename once, Escape gives up and goes no further, a cancelled rename
//   puts the old title back; the focus comes back to the row;
// - Shift+F10 opens the row's actions in the one shared menu (Rename first, a
//   destructive action in the error status), a choice says apply;
// - the end of the list asks for the next page once; a refused request lets
//   «Show more» ask again; appendItems adds the page;
// - detach moves the focus to the neighbour;
// - no rows: sf-empty-state with the list's empty text;
// - each size of the ladder: row, «⋯» and field one height; English words.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/dropdown/css/dropdown.css',
  'component/component/icons/css/icons.css',
  'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/buttons/css/buttons.css',
  'component/component/context-menu/css/context-menu.css',
  'smart/smart/empty-state/css/empty-state.css',
  'smart/smart/list/css/list.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js',
  'smart/smart/list-item/js/list-item.js', 'smart/smart/empty-state/js/empty-state.js',
  'smart/smart/menu-context/js/menu-context.js',
  'smart/smart/list/js/list.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const note = (detail) => failures.push(detail);
const errors = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  page.on('pageerror', (error) => { if (!/Automatic publicPath/u.test(error.message)) errors.push(error.message); });
  await page.setContent('<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8"></head><body style="margin:0"><button id="before">до</button><div id="box" style="width:360px;height:420px;overflow:auto;padding:8px"></div><button id="after">после</button></body></html>');
  for (const style of styles) await page.addStyleTag({path: style}).catch(() => {});
  for (const module of modules) await page.addScriptTag({path: module, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => Boolean(customElements.get('sf-list') && customElements.get('sf-list-item') && customElements.get('sf-menu-context')));

  const settle = (ms = 200) => page.waitForTimeout(ms);
  // A list of letters across days; attributes and how the host answers.
  const make = async ({attributes = {}, items = null, hasMore = false, cancel = {}} = {}) => {
    await page.evaluate(async ({attributes, items, hasMore, cancel}) => {
      const box = document.getElementById('box');
      box.replaceChildren();
      window.events = [];
      window.keysBelow = 0;
      box.addEventListener('keydown', (event) => { if (event.key === 'Escape') window.keysBelow += 1; });
      const list = document.createElement('sf-list');
      list.id = 'list';
      for (const [name, value] of Object.entries(attributes)) list.setAttribute(name, value);
      for (const name of ['open', 'apply', 'rename', 'load-more']) {
        list.addEventListener(`sf-list-${name}`, (event) => {
          window.events.push({name, ...event.detail});
          if (cancel[name]) event.preventDefault();
        });
      }
      const day = 24 * 3600 * 1000;
      const now = Date.now();
      list.actions = [{id: 'copy', text: 'Копировать', icon: 'content_copy'}, {id: 'delete', text: 'Удалить', icon: 'delete', destructive: true}];
      box.append(list);
      list.setItems(items ?? [
        {id: 'a', text: 'Письмо директору', supporting: 'Черновик', date: new Date(now).toISOString()},
        {id: 'b', text: 'Ответ клиенту', date: new Date(now - 60_000).toISOString()},
        {id: 'c', text: 'Отчёт за неделю', date: new Date(now - day).toISOString()},
        {id: 'd', text: 'Приглашение', date: new Date(now - 9 * day).toISOString(), actions: ['copy']},
        {id: 'e', text: 'Без даты'},
      ], {hasMore});
      await new Promise((done) => setTimeout(done, 250));
    }, {attributes, items, hasMore, cancel});
  };
  const events = () => page.evaluate(() => window.events.slice());
  const focused = () => page.evaluate(() => document.activeElement?.closest?.('.sf-list__row')?.dataset.id ?? document.activeElement?.id ?? document.activeElement?.className ?? null);

  // 1. Groups by day, the open row.
  await make({attributes: {'group-by': 'day', renamable: '', selected: 'b', label: 'Письма'}});
  const drawn = await page.evaluate(() => {
    const list = document.getElementById('list');
    return {
      headings: [...list.querySelectorAll('.sf-list__heading')].map((node) => node.textContent.trim()),
      level: list.querySelector('.sf-list__heading').getAttribute('aria-level'),
      frame: {role: list.querySelector('.sf-list__frame').getAttribute('role'), label: list.querySelector('.sf-list__frame').getAttribute('aria-label')},
      labelled: [...list.querySelectorAll('.sf-list__rows')].every((ul) => document.getElementById(ul.getAttribute('aria-labelledby'))?.classList.contains('sf-list__heading')),
      rows: [...list.querySelectorAll('.sf-list__row')].map((row) => row.dataset.id),
      current: [...list.querySelectorAll('[aria-current="true"]')].map((node) => node.closest('.sf-list__row').dataset.id),
      tint: getComputedStyle(list.querySelector('.sf-list__row--current')).backgroundColor,
      plain: getComputedStyle(list.querySelector('.sf-list__row:not(.sf-list__row--current)')).backgroundColor,
      itemFill: getComputedStyle(list.querySelector('.sf-list__row--current .sf-list-item')).backgroundColor,
      supporting: list.querySelector('.sf-list__row[data-id="a"] sf-list-item').getAttribute('supporting'),
      dots: list.querySelectorAll('.sf-list__actions').length,
      stops: [...list.querySelectorAll('.sf-list__actions')].every((button) => button.tabIndex === -1),
    };
  });
  if (drawn.headings[0] !== 'Сегодня' || drawn.headings[1] !== 'Вчера' || drawn.headings.at(-1) !== 'Без даты' || drawn.headings.length !== 4) note({case: 'groups by the reader\'s day, undated last', got: drawn.headings});
  if (drawn.level !== '3' || drawn.frame.role !== 'group' || drawn.frame.label !== 'Письма' || !drawn.labelled) note({case: 'a group named by the label, each group\'s rows named by its heading', got: drawn});
  if (drawn.rows.join() !== 'a,b,c,d,e') note({case: 'the host\'s order', got: drawn.rows});
  if (drawn.current.join() !== 'b' || drawn.tint === drawn.plain || drawn.itemFill !== 'rgba(0, 0, 0, 0)') note({case: 'the open row is current and tinted, the row element carries the tint', got: drawn});
  if (drawn.supporting !== 'Черновик') note({case: 'the second line', got: drawn.supporting});
  if (drawn.dots !== 5 || !drawn.stops) note({case: 'every row with actions has its «⋯», none a Tab stop', got: drawn});

  // 2. One Tab stop, arrows across the groups, Enter and a press open.
  await page.focus('#before');
  await page.keyboard.press('Tab');
  let at = await focused();
  if (at !== 'b') note({case: 'Tab lands on the open row', got: at});
  await page.keyboard.press('ArrowDown');
  at = await focused();
  if (at !== 'c') note({case: 'ArrowDown crosses into the next group', got: at});
  await page.keyboard.press('End');
  at = await focused();
  if (at !== 'e') note({case: 'End goes to the last row', got: at});
  await page.keyboard.press('Home');
  at = await focused();
  if (at !== 'a') note({case: 'Home goes to the first row', got: at});
  await page.keyboard.press('Tab');
  at = await focused();
  if (at !== 'after') note({case: 'the next Tab leaves the list: one stop', got: at});
  await page.keyboard.press('Shift+Tab');
  at = await focused();
  if (at !== 'a') note({case: 'Shift+Tab comes back to the row last on', got: at});
  await page.keyboard.press('Enter');
  await page.click('.sf-list__row[data-id="c"] .sf-list-item');
  let now = await events();
  const opens = now.filter((event) => event.name === 'open').map((event) => `${event.id}:${event.trigger}`);
  if (opens.join() !== 'a:keyboard,c:pointer') note({case: 'Enter and a press open the row', got: now});

  // 3. Rename in place.
  await page.evaluate(() => { window.events = []; document.querySelector('.sf-list__row[data-id="a"] .sf-list-item').focus(); });
  const rowHeight = await page.evaluate(() => document.querySelector('.sf-list__row[data-id="c"]').getBoundingClientRect().height);
  await page.keyboard.press('F2');
  await settle(100);
  const field = await page.evaluate(() => {
    const input = document.querySelector('.sf-list__rename');
    return input && {focused: document.activeElement === input, value: input.value, height: input.getBoundingClientRect().height, label: input.getAttribute('aria-label')};
  });
  if (!field || !field.focused || field.value !== 'Письмо директору' || Math.abs(field.height - rowHeight) > 0.5 || !field.label) note({case: 'F2 opens a focused field as tall as a one-line row', got: {field, rowHeight}});
  await page.keyboard.press('Escape');
  await settle(100);
  now = await page.evaluate(() => ({field: Boolean(document.querySelector('.sf-list__rename')), below: window.keysBelow, events: window.events.slice()}));
  if (now.field || now.below !== 0 || now.events.length) note({case: 'Escape gives up, goes no further, says nothing', got: now});
  at = await focused();
  if (at !== 'a') note({case: 'the focus comes back to the row after Escape', got: at});
  await page.keyboard.press('F2');
  await settle(100);
  await page.keyboard.type('Письмо в бухгалтерию');
  await page.keyboard.press('Enter');
  await settle(150);
  now = await page.evaluate(() => ({
    text: document.querySelector('.sf-list__row[data-id="a"] sf-list-item').getAttribute('text'),
    events: window.events.slice(),
    at: document.activeElement?.closest?.('.sf-list__row')?.dataset.id,
  }));
  if (now.text !== 'Письмо в бухгалтерию' || now.events.length !== 1 || now.events[0].name !== 'rename' || now.events[0].text !== 'Письмо в бухгалтерию' || now.at !== 'a') note({case: 'Enter keeps the new title, says rename once, focus on the row', got: now});
  const refused = await page.evaluate(() => document.getElementById('list').rename({id: 'zzz'}));
  if (refused.outcome !== 'refused' || refused.reason !== 'unknown') note({case: 'rename of an unknown row is refused', got: refused});

  // A host that cancels the rename gets the old title back.
  await make({attributes: {renamable: ''}, cancel: {rename: true}});
  await page.evaluate(() => document.getElementById('list').rename({id: 'b'}));
  await settle(100);
  await page.evaluate(() => { const input = document.querySelector('.sf-list__rename'); input.value = 'Другое'; input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true})); });
  await settle(150);
  const reverted = await page.evaluate(() => document.querySelector('.sf-list__row[data-id="b"] sf-list-item').getAttribute('text'));
  if (reverted !== 'Ответ клиенту') note({case: 'a cancelled rename puts the old title back', got: reverted});

  // 4. The row's actions in the one shared menu.
  await make({attributes: {renamable: ''}});
  await page.evaluate(() => document.querySelector('.sf-list__row[data-id="c"] .sf-list-item').focus());
  await page.keyboard.press('Shift+F10');
  await settle(300);
  const menu = await page.evaluate(() => {
    const menus = document.querySelectorAll('#list sf-menu-context');
    const items = [...document.querySelectorAll('#list .sf-list__menu [role="menuitem"]')].filter((node) => node.getClientRects().length);
    return {
      menus: menus.length,
      open: menus[0]?.isOpen,
      label: menus[0]?.getAttribute('aria-label'),
      entries: (menus[0]?.entries ?? []).map((entry) => `${entry.id}${entry.status ? `/${entry.status}` : ''}`),
      shown: items.map((node) => node.textContent.replace(/\s+/gu, ' ').trim()),
    };
  });
  if (menu.menus !== 1 || !menu.open || menu.entries.join() !== 'rename,action:copy,action:delete/error' || menu.label !== 'Действия: Отчёт за неделю') note({case: 'Shift+F10 opens the one menu: Rename, then the actions, the destructive in error', got: menu});
  await page.evaluate(() => {
    const target = [...document.querySelectorAll('#list .sf-list__menu [role="menuitem"]')].find((node) => /Удалить/u.test(node.textContent));
    target?.click();
  });
  await settle(150);
  now = await events();
  const apply = now.find((event) => event.name === 'apply');
  if (!apply || apply.action !== 'delete' || apply.scope !== 'entry' || apply.ids.join() !== 'c') note({case: 'a chosen action says apply {action, scope entry, ids}', got: now});
  // A row allowed only copy, and no rename on a list that does not rename.
  await make();
  const narrow = await page.evaluate(() => {
    const list = document.getElementById('list');
    list.openMenu({id: 'd'});
    return list.querySelector('.sf-list__menu').entries.map((entry) => entry.id);
  });
  if (narrow.join() !== 'action:copy') note({case: 'a row narrows its actions; no rename unless renamable', got: narrow});
  await page.keyboard.press('Escape');

  // 5. The next page.
  const many = Array.from({length: 30}, (_, index) => ({id: `r${index}`, text: `Строка ${index + 1}`}));
  await make({items: many, hasMore: true, cancel: {'load-more': true}});
  await page.evaluate(() => { document.getElementById('box').scrollTop = 100000; });
  await settle(300);
  now = await events();
  const asks = now.filter((event) => event.name === 'load-more');
  if (asks.length !== 1 || asks[0].direction !== 'after' || asks[0].after !== 'r29') note({case: 'the end in reach asks for the next page once', got: now});
  const button = await page.evaluate(() => !document.querySelector('.sf-list__next [data-action="more"]').hasAttribute('disabled'));
  if (!button) note({case: 'a refused request lets «Show more» ask again'});
  await page.evaluate(() => { window.events = []; document.getElementById('list').appendItems([{id: 'r30', text: 'Строка 31'}], {hasMore: false}); });
  await settle(150);
  now = await page.evaluate(() => ({rows: document.querySelectorAll('#list .sf-list__row').length, next: document.querySelector('.sf-list__next').hidden, again: document.getElementById('list').requestMore()}));
  if (now.rows !== 31 || !now.next || now.again.reason !== 'no-more') note({case: 'appendItems adds the page; no more, nothing to ask', got: now});

  // 6. Detach moves the focus to the neighbour.
  await make();
  await page.evaluate(() => document.querySelector('.sf-list__row[data-id="b"] .sf-list-item').focus());
  await page.evaluate(() => document.getElementById('list').detach({id: 'b'}));
  await settle(150);
  at = await focused();
  if (at !== 'c') note({case: 'detach moves the focus to the next row', got: at});

  // 7. Empty.
  await make({items: [], attributes: {'empty-text': 'Писем нет'}});
  const empty = await page.evaluate(() => ({
    heading: document.querySelector('#list sf-empty-state')?.getAttribute('heading'),
    body: document.querySelector('#list .sf-list__body').hidden,
  }));
  if (empty.heading !== 'Писем нет' || !empty.body) note({case: 'no rows: the empty state with the list\'s text', got: empty});

  // 8. The ladder: row, «⋯» and rename field share the row's height.
  const ladder = {};
  for (const size of ['1/2', '1', '2']) {
    await make({attributes: {size, renamable: ''}, items: [{id: 'x', text: 'Строка'}, {id: 'y', text: 'Ещё'}]});
    await page.evaluate(() => document.getElementById('list').rename({id: 'y'}));
    await settle(100);
    ladder[size] = await page.evaluate(() => ({
      row: document.querySelector('.sf-list__row[data-id="x"]').getBoundingClientRect().height,
      item: document.querySelector('.sf-list__row[data-id="x"] .sf-list-item').getBoundingClientRect().height,
      dots: document.querySelector('.sf-list__row[data-id="x"] .sf-list__actions').getBoundingClientRect().height,
      field: document.querySelector('.sf-list__rename').getBoundingClientRect().height,
    }));
  }
  for (const [size, got] of Object.entries(ladder)) {
    if (Math.abs(got.row - got.item) > 0.5 || got.dots > got.row + 0.5 || Math.abs(got.field - got.row) > 0.5) note({case: `size ${size}: row, «⋯» and field one height`, got});
  }
  if (!(ladder['1/2'].row < ladder['1'].row && ladder['1'].row < ladder['2'].row)) note({case: 'the rows step with the ladder', got: ladder});

  // 9. English.
  await page.evaluate(() => document.documentElement.setAttribute('lang', 'en'));
  await make({hasMore: true, attributes: {'group-by': 'day'}, cancel: {'load-more': true}});
  const english = await page.evaluate(() => ({
    first: document.querySelector('.sf-list__heading').textContent.trim(),
    last: [...document.querySelectorAll('.sf-list__heading')].at(-1).textContent.trim(),
    more: document.querySelector('.sf-list__next sf-button').getAttribute('text'),
    actions: document.querySelector('.sf-list__actions').getAttribute('aria-label'),
  }));
  if (JSON.stringify(english) !== JSON.stringify({first: 'Today', last: 'No date', more: 'Show more', actions: 'Actions: Письмо директору'})) note({case: 'an English page speaks English', got: english});

  if (errors.length) note({case: 'no page errors', got: errors});
  console.log(JSON.stringify({checked: 9}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('LIST_OK');
