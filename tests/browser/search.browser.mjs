#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-search on the built bytes, through the real Loader, at a desktop and a
// phone width:
// - Command/Control+K opens the window from anywhere, / only outside a text
//   field; the field takes the focus and the trigger says aria-expanded;
// - the built-in provider reads the static index: quick actions and popular
//   pills on an empty field; typing finds grouped results with the match
//   marked; the arrows move the selection (aria-activedescendant), Enter opens
//   the selected result (sf-search-navigate, cancelable) and the window closes;
//   a pointer over a row selects it;
// - the scope pills filter the results and keep their counts;
// - a query is recorded as recent when a result is opened (SF.Preferences,
//   localStorage sf-pref:sf-search/<recent-key>); a recent query is removed
//   by its X and the list is cleared by «Очистить»;
// - the field's X clears a filled field and keeps the focus, then closes the
//   empty window; Escape does the same; focus goes back to the trigger;
// - a provider: a loading message while the first answer is awaited, a stale
//   request aborted;
// - geometry on the ladder: the field 48 px, a result row 48 px, a one-line
//   row 40 px, the icon square 32 px; the field's glyph and the rows' squares
//   on one axis, the field's text where the titles start, the X over the go
//   arrows;
// - at 375 px the window is a full-screen sheet with the field on top and a
//   back arrow that closes it.
// - a host of simai.search-port: a block stands only where the capability is
//   announced and the setting left on; recent.forget, recent.clear and
//   action.run reach the host; a correction is offered and choosing it is a
//   query; the preview follows the row and a late answer is dropped; a refusal
//   keeps the window open; the pane needs room.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const INDEX = {
  groups: [{id: 'pages', label: 'Страницы'}, {id: 'components', label: 'Компоненты'}, {id: 'actions', label: 'Действия'}],
  popular: ['таблица', 'тема', 'кнопка'],
  items: [
    {group: 'pages', title: 'Кнопки', path: 'Компоненты › Действия', href: '#buttons', icon: 'smart_button'},
    {group: 'pages', title: 'Таблица в рамке', path: 'Утилиты › Таблицы', href: '#table', icon: 'table'},
    {group: 'pages', title: 'Таблицы данных', path: ['SIMAI Pro', 'Данные'], url: '#data', icon: 'dataset'},
    {group: 'pages', title: 'Тёмная тема', path: 'Основы › Темы', href: '#dark', icon: 'dark_mode'},
    {group: 'components', title: 'sf-table', path: 'SIMAI Pro', text: 'таблица данных', href: '#sf-table', icon: 'widgets'},
    {group: 'components', title: 'sf-button', path: 'Смарт-компонент', text: 'кнопка', href: '#sf-button', icon: 'widgets'},
    {group: 'actions', title: 'Сменить тему', path: 'Команда', action: 'theme', icon: 'contrast', shortcut: '⇧⌘L'},
  ],
};

const page = (body) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
${body}
</body></html>`;

const PAGES = {
  '/page': page(`<header><sf-search id="s" index="/index.json" recent-key="probe-recent"><button id="t" type="button">Поиск</button></sf-search></header>
<main><p>Страница</p><input id="text" aria-label="Поле страницы"></main>`),
  // A host of simai.search-port: `?caps=` is what it announces, the markup's
  // attributes what the page wants.
  '/port': page(`<sf-search id="h" shortcut=""><button id="ht" type="button">Поиск</button></sf-search>
<script>
const params = new URLSearchParams(location.search);
const caps = (params.get('caps') ?? 'scopes,recent,popular,actions,preview,spelling').split(',').filter(Boolean);
for (const name of (params.get('off') ?? '').split(',').filter(Boolean)) document.getElementById('h').setAttribute(name, 'false');
window.intents = [];
window.delayPreview = 0;
let recent = ['таблица', 'тема'];
const results = [
  {id: 'a', group: 'pages', title: 'Таблица в рамке', path: 'Утилиты', kind: 'page', url: '#a'},
  {id: 'b', group: 'pages', title: 'Таблицы данных', path: 'Данные', kind: 'page', url: '#b'},
  {id: 'c', group: 'components', title: 'sf-table', path: 'Pro', kind: 'page', url: '#c'},
  {id: 'theme', group: 'actions', title: 'Сменить тему', kind: 'action', shortcut: 'T'},
];
window.host = {id: 'probe', port: 'simai.search-port', version: '1.0.0', capabilities: caps,
  async raise(intent, payload) {
    window.intents.push({intent, payload});
    if (intent === 'query.change') {
      const scopes = [{id: 'pages', label: 'Страницы'}, {id: 'components', label: 'Компоненты'}, {id: 'actions', label: 'Действия'}];
      const data = {results: payload.query ? results : results.filter((r) => r.kind === 'action'), echo: {query: payload.query, scope: payload.scope ?? null}, scopes};
      if (caps.includes('recent')) data.recent = recent;
      if (caps.includes('popular')) data.popular = ['кнопка'];
      if (caps.includes('spelling') && payload.query === 'тблица') data.correction = {query: 'таблица', total: 3};
      return {answer: 'applied', sequence: payload.sequence, data};
    }
    if (intent === 'recent.forget') { recent = recent.filter((q) => q !== payload.query); return {answer: 'applied', data: {recent}}; }
    if (intent === 'recent.clear') { recent = []; return {answer: 'applied', data: {recent}}; }
    if (intent === 'result.preview') {
      const wait = window.delayPreview;
      if (wait) await new Promise((settle) => setTimeout(settle, wait));
      return {answer: 'applied', sequence: payload.sequence, data: {preview: {id: payload.id, title: 'О ' + payload.id, path: 'Путь ' + payload.id, text: 'Слова ' + payload.id}}};
    }
    if (intent === 'result.open') return payload.id === 'b' ? {answer: 'refused', reason: 'forbidden', text: 'Нет доступа к этой странице'} : {answer: 'applied', data: {recent}};
    if (intent === 'action.run') return {answer: 'applied', data: {recent}};
    return {answer: 'unavailable', reason: 'intent-unknown'};
  }};
customElements.whenDefined('sf-search').then(() => document.getElementById('h').connectPort(window.host));
</script>`),
  '/provider': page(`<sf-search id="p" shortcut=""><button id="pt" type="button">Поиск</button></sf-search>
<script>
window.calls = [];
document.getElementById('p').provider = (query, {signal}) => new Promise((settle) => {
  const call = {query, aborted: false};
  window.calls.push(call);
  signal.addEventListener('abort', () => { call.aborted = true; });
  setTimeout(() => settle({items: query ? [{id: 'x', title: 'Ответ на ' + query, path: 'Где-то', href: '#x'}] : []}), query ? 600 : 0);
});
</script>`),
};

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (PAGES[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(PAGES[path]);
  }
  if (path === '/index.json') {
    response.writeHead(200, {'content-type': 'application/json; charset=utf-8'});
    return response.end(JSON.stringify(INDEX));
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
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const seen = {};
const expect = (name, ok, detail) => {
  seen[name] = ok ? true : detail ?? false;
  if (!ok) failures.push({name, detail});
};
const WINDOW = '.sf-search-window';
const rowsInfo = (tab) => tab.evaluate(() => [...document.querySelectorAll('.sf-search-row')].map((row) => ({
  id: row.id,
  title: row.querySelector('.sf-search-row-title')?.textContent.trim(),
  selected: row.getAttribute('aria-selected') === 'true',
  mark: row.querySelector('mark')?.textContent ?? null,
})));
const typeQuery = async (tab, text) => {
  await tab.keyboard.type(text, {delay: 20});
  // Past the debounce, then until the card is no longer busy with a request.
  await tab.waitForTimeout(200);
  await tab.waitForFunction(() => document.querySelector('.sf-search-card')?.getAttribute('aria-busy') === 'false', null, {timeout: 5000}).catch(() => {});
};

const browser = await chromium.launch();
try {
  // ----------------------------------------------------------- desktop
  {
    const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${origin}/page`);
    await tab.evaluate(() => localStorage.removeItem('sf-pref:sf-search/probe-recent'));
    await tab.waitForFunction(() => customElements.get('sf-search') && document.querySelector('#t').getAttribute('aria-haspopup') === 'dialog', null, {timeout: 20000})
      .catch(() => failures.push({name: 'upgrade', detail: 'sf-search never upgraded'}));

    const trigger = await tab.evaluate(() => {
      const t = document.querySelector('#t');
      return {expanded: t.getAttribute('aria-expanded'), keys: t.getAttribute('aria-keyshortcuts')};
    });
    expect('trigger-aria', trigger.expanded === 'false' && /\+K/u.test(trigger.keys ?? '') && /\//u.test(trigger.keys ?? ''), trigger);

    // / in a text field types; outside one it opens.
    await tab.focus('#text');
    await tab.keyboard.press('/');
    const slashInField = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), value: document.querySelector('#text').value}));
    expect('slash-in-field-types', !slashInField.open && slashInField.value === '/', slashInField);

    // Command/Control+K from the field opens the window.
    await tab.keyboard.press('ControlOrMeta+k');
    await tab.waitForSelector(WINDOW, {timeout: 5000}).catch(() => {});
    await tab.waitForFunction(() => document.querySelectorAll('.sf-search-row').length > 0, null, {timeout: 5000}).catch(() => {});
    const opened = await tab.evaluate(() => {
      const w = document.querySelector('.sf-search-window');
      const input = document.querySelector('.sf-search-input');
      return {
        dialog: w?.getAttribute('role'), modal: w?.getAttribute('aria-modal'), label: w?.getAttribute('aria-label'),
        focused: document.activeElement === input, expanded: document.querySelector('#t').getAttribute('aria-expanded'),
        locked: document.documentElement.style.overflow, open: document.querySelector('#s').getAttribute('data-open'),
        portalAtBodyEnd: document.body.lastElementChild?.classList.contains('sf-search-portal'),
        captions: [...document.querySelectorAll('.sf-search-caption > span')].map((n) => n.textContent.trim()),
        pills: [...document.querySelectorAll('.sf-search-pills .sf-search-pill')].map((n) => n.textContent.trim()),
        actions: [...document.querySelectorAll('.sf-search-row')].map((n) => n.querySelector('.sf-search-row-title').textContent.trim()),
        kbd: document.querySelector('.sf-search-row .sf-search-shortcut')?.textContent ?? null,
        keys: Boolean(document.querySelector('.sf-search-keys')),
      };
    });
    expect('shortcut-opens', opened.dialog === 'dialog' && opened.modal === 'true' && opened.label === 'Поиск по сайту' && opened.focused
      && opened.expanded === 'true' && opened.locked === 'hidden' && opened.open === 'true' && opened.portalAtBodyEnd, opened);
    expect('empty-field-blocks', opened.captions.join('|') === 'Часто ищут|Быстрые действия' && opened.pills.join('|') === 'таблица|тема|кнопка'
      && opened.actions.join('|') === 'Сменить тему' && opened.kbd === '⇧⌘L' && opened.keys, opened);

    // A popular pill fills the field.
    await tab.click('.sf-search-pills .sf-search-pill >> nth=0');
    await tab.waitForFunction(() => document.querySelectorAll('.sf-search-row mark').length > 0, null, {timeout: 5000}).catch(() => {});
    const pill = await tab.evaluate(() => ({value: document.querySelector('.sf-search-input').value, focused: document.activeElement === document.querySelector('.sf-search-input')}));
    expect('popular-fills-field', pill.value === 'таблица' && pill.focused, pill);

    // X clears a filled field and keeps the focus.
    await tab.click('.sf-search-clear button');
    const cleared = await tab.evaluate(() => ({value: document.querySelector('.sf-search-input')?.value, focused: document.activeElement === document.querySelector('.sf-search-input'),
      label: document.querySelector('.sf-search-clear button')?.getAttribute('aria-label') ?? document.querySelector('.sf-search-clear')?.getAttribute('aria-label')}));
    expect('x-clears', cleared.value === '' && cleared.focused && cleared.label === 'Закрыть', cleared);

    // Typing: grouped results, the match marked, the first row selected.
    await typeQuery(tab, 'таб');
    const typed = await tab.evaluate(() => ({
      captions: [...document.querySelectorAll('.sf-search-group .sf-search-caption')].map((n) => n.textContent.trim()),
      scopes: [...document.querySelectorAll('.sf-search-scope')].map((n) => n.textContent.replace(/\s+/gu, ' ').trim()),
      pressed: document.querySelector('.sf-search-scope[aria-pressed="true"]')?.textContent.trim(),
      status: document.querySelector('.sf-search-window [role="status"]')?.textContent.trim(),
      xLabel: document.querySelector('.sf-search-clear button')?.getAttribute('aria-label') ?? document.querySelector('.sf-search-clear')?.getAttribute('aria-label'),
      active: document.querySelector('.sf-search-input').getAttribute('aria-activedescendant'),
    }));
    const rows = await rowsInfo(tab);
    expect('results-grouped-marked', rows.length === 3 && rows[0].title === 'Таблица в рамке' && rows[0].mark === 'Таб' && rows[0].selected
      && typed.active === rows[0].id && typed.captions.join('|') === 'Страницы|Компоненты' && typed.status === '3 результата' && typed.xLabel === 'Очистить', {rows, typed});
    expect('scopes-with-counts', typed.scopes.join('|') === 'Все3|Страницы2|Компоненты1' && typed.pressed?.startsWith('Все'), typed);

    // Arrows move the selection, wrapping.
    await tab.keyboard.press('ArrowDown');
    const down = await rowsInfo(tab);
    await tab.keyboard.press('ArrowUp');
    await tab.keyboard.press('ArrowUp');
    const wrapped = await rowsInfo(tab);
    const activeAfter = await tab.evaluate(() => document.querySelector('.sf-search-input').getAttribute('aria-activedescendant'));
    expect('arrows-move', down[1]?.selected && wrapped.at(-1)?.selected && activeAfter === wrapped.at(-1).id, {down, wrapped, activeAfter});

    // A pointer over a row selects it.
    const second = await tab.$('.sf-search-row >> nth=1');
    const box = await second.boundingBox();
    await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await tab.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
    const hovered = await rowsInfo(tab);
    expect('hover-selects', hovered[1]?.selected === true, hovered);

    // Scopes filter: Компоненты shows its one row, without captions.
    await tab.click('.sf-search-scope >> nth=2');
    const scoped = await tab.evaluate(() => ({
      rows: [...document.querySelectorAll('.sf-search-row-title')].map((n) => n.textContent.trim()),
      captions: document.querySelectorAll('.sf-search-group .sf-search-caption').length,
      scopes: [...document.querySelectorAll('.sf-search-scope')].map((n) => `${n.textContent.replace(/\s+/gu, '')}:${n.getAttribute('aria-pressed')}`),
      focused: document.activeElement === document.querySelector('.sf-search-input'),
    }));
    expect('scope-filters', scoped.rows.join('|') === 'sf-table' && scoped.captions === 0 && scoped.scopes.join('|') === 'Все3:false|Страницы2:false|Компоненты1:true' && scoped.focused, scoped);
    await tab.click('.sf-search-scope >> nth=0');

    // Geometry, measured on the open window (rows: two lines and one line).
    const geometry = await tab.evaluate(() => {
      const rect = (node) => node?.getBoundingClientRect();
      const field = rect(document.querySelector('.sf-search-field'));
      const glyph = rect(document.querySelector('.sf-search-glyph'));
      const input = document.querySelector('.sf-search-input');
      const inputBox = rect(input);
      const clear = rect(document.querySelector('.sf-search-clear button'));
      const row = document.querySelector('.sf-search-row:not(.sf-search-row--single)');
      const square = rect(row.querySelector('.sf-search-row-icon'));
      const squareGlyph = rect(row.querySelector('.sf-search-row-icon .sf-icon'));
      const title = row.querySelector('.sf-search-row-title');
      const range = document.createRange();
      range.selectNodeContents(title);
      const titleText = range.getBoundingClientRect();
      const go = rect(row.querySelector('.sf-search-go'));
      const caption = rect(document.querySelector('.sf-search-group .sf-search-caption > span'));
      const card = rect(document.querySelector('.sf-search-card'));
      const cs = getComputedStyle(input);
      const centre = (r) => r.left + r.width / 2;
      return {
        fieldHeight: field.height, rowHeight: rect(row).height, square: [square.width, square.height],
        squareGlyph: squareGlyph.width, fieldGlyph: glyph.width, clear: clear.width,
        glyphAxis: centre(glyph) - centre(square), textStart: (inputBox.left + parseFloat(cs.paddingLeft)) - titleText.left,
        xAxis: centre(clear) - centre(go), captionStart: caption.left - square.left,
        widths: [field.width, card.width], gap: card.top - field.bottom,
        fieldTop: field.top, radius: getComputedStyle(document.querySelector('.sf-search-field')).borderTopLeftRadius,
      };
    });
    const near = (value, want) => Math.abs(value - want) < 0.6;
    expect('geometry-ladder', near(geometry.fieldHeight, 48) && near(geometry.rowHeight, 48) && near(geometry.square[0], 32) && near(geometry.square[1], 32)
      && near(geometry.squareGlyph, 20) && near(geometry.fieldGlyph, 24) && near(geometry.clear, 32), geometry);
    expect('geometry-axes', near(geometry.glyphAxis, 0) && near(geometry.textStart, 0) && near(geometry.xAxis, 0) && near(geometry.captionStart, 0)
      && near(geometry.widths[0], geometry.widths[1]) && near(geometry.gap, 8) && near(geometry.fieldTop, 64), geometry);
    seen.geometry = geometry;

    // Enter opens the selected result: navigate (the page cancels it here),
    // the window closes, the query is recorded.
    await tab.evaluate(() => {
      window.heard = [];
      for (const name of ['sf-search-navigate', 'sf-search-close', 'sf-search-closed']) {
        document.addEventListener(name, (event) => {
          window.heard.push({name, detail: {...event.detail}});
          if (name === 'sf-search-navigate') event.preventDefault();
        });
      }
    });
    await tab.keyboard.press('ArrowDown');
    await tab.keyboard.press('Enter');
    const chosen = await tab.evaluate(() => ({heard: window.heard, open: Boolean(document.querySelector('.sf-search-window')), href: location.hash,
      recent: JSON.parse(localStorage.getItem('sf-pref:sf-search/probe-recent'))?.queries ?? null, locked: document.documentElement.style.overflow}));
    const navigate = chosen.heard.find((one) => one.name === 'sf-search-navigate');
    expect('enter-navigates', navigate && navigate.detail.id === '#data' && navigate.detail.href === '#data' && navigate.detail.query === 'таб'
      && navigate.detail.group === 'pages' && !chosen.open && chosen.href === '' && chosen.locked === ''
      && chosen.heard.some((one) => one.name === 'sf-search-closed' && one.detail.reason === 'api'), chosen);
    expect('recent-recorded', JSON.stringify(chosen.recent) === JSON.stringify(['таб']), chosen.recent);

    // Recent: shown on the empty field after opening from the trigger; a
    // recent row puts its query into the field.
    await tab.click('#t');
    await tab.waitForSelector('.sf-search-row--recent', {timeout: 5000}).catch(() => {});
    const recent = await tab.evaluate(() => ({
      captions: [...document.querySelectorAll('.sf-search-caption > span')].map((n) => n.textContent.trim()),
      rows: [...document.querySelectorAll('.sf-search-row--recent .sf-search-row-title')].map((n) => n.textContent.trim()),
      remove: document.querySelector('.sf-search-row--recent .sf-search-remove')?.getAttribute('aria-label'),
      height: document.querySelector('.sf-search-row--recent')?.getBoundingClientRect().height,
    }));
    expect('recent-shown', recent.captions[0] === 'Недавние' && recent.rows.join('|') === 'таб' && recent.remove === 'Убрать «таб»' && Math.abs(recent.height - 40) < 0.6, recent);
    // Record two more through the API of a page: type, open a result.
    for (const query of ['кноп', 'тём']) {
      await typeQuery(tab, query);
      await tab.keyboard.press('Enter');
      await tab.click('#t');
      await tab.waitForSelector('.sf-search-row--recent', {timeout: 5000}).catch(() => {});
    }
    const three = await tab.evaluate(() => [...document.querySelectorAll('.sf-search-row--recent .sf-search-row-title')].map((n) => n.textContent.trim()));
    expect('recent-newest-first', three.join('|') === 'тём|кноп|таб', three);
    // Remove the middle one by its X.
    const middle = await tab.$('.sf-search-row--recent >> nth=1');
    await middle.hover();
    await tab.click('.sf-search-row--recent >> nth=1 >> .sf-search-remove');
    const removed = await tab.evaluate(() => ({rows: [...document.querySelectorAll('.sf-search-row--recent .sf-search-row-title')].map((n) => n.textContent.trim()),
      stored: JSON.parse(localStorage.getItem('sf-pref:sf-search/probe-recent'))?.queries ?? null, focused: document.activeElement === document.querySelector('.sf-search-input'), open: Boolean(document.querySelector('.sf-search-window'))}));
    expect('recent-remove', removed.rows.join('|') === 'тём|таб' && JSON.stringify(removed.stored) === JSON.stringify(['тём', 'таб']) && removed.focused && removed.open, removed);
    // Enter on a recent row fills the field.
    await tab.keyboard.press('Enter');
    await tab.waitForFunction(() => document.querySelectorAll('.sf-search-row mark').length > 0, null, {timeout: 5000}).catch(() => {});
    const refilled = await tab.evaluate(() => document.querySelector('.sf-search-input').value);
    expect('recent-fills-field', refilled === 'тём', refilled);
    // Clear the field, then «Очистить» empties the list.
    await tab.keyboard.press('Escape');
    await tab.click('.sf-search-caption-action');
    const emptied = await tab.evaluate(() => ({rows: document.querySelectorAll('.sf-search-row--recent').length, stored: JSON.parse(localStorage.getItem('sf-pref:sf-search/probe-recent'))?.queries ?? null,
      open: Boolean(document.querySelector('.sf-search-window'))}));
    expect('recent-clear', emptied.rows === 0 && emptied.stored === null && emptied.open, emptied);

    // Escape: clears first, then closes and gives focus back to the trigger.
    await typeQuery(tab, 'кноп');
    await tab.keyboard.press('Escape');
    const firstEscape = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), value: document.querySelector('.sf-search-input')?.value}));
    await tab.keyboard.press('Escape');
    const secondEscape = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), focus: document.activeElement?.id,
      reason: window.heard.filter((one) => one.name === 'sf-search-closed').at(-1)?.detail.reason, expanded: document.querySelector('#t').getAttribute('aria-expanded')}));
    expect('escape-clears-then-closes', firstEscape.open && firstEscape.value === '' && !secondEscape.open && secondEscape.focus === 't'
      && secondEscape.reason === 'escape' && secondEscape.expanded === 'false', {firstEscape, secondEscape});

    // The X: clears, then closes; focus back to the trigger.
    await tab.click('#t');
    await tab.waitForSelector(WINDOW);
    await typeQuery(tab, 'тем');
    await tab.click('.sf-search-clear button');
    const xFirst = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), value: document.querySelector('.sf-search-input')?.value}));
    await tab.click('.sf-search-clear button');
    const xSecond = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), focus: document.activeElement?.id,
      reason: window.heard.filter((one) => one.name === 'sf-search-closed').at(-1)?.detail.reason}));
    expect('x-clears-then-closes', xFirst.open && xFirst.value === '' && !xSecond.open && xSecond.focus === 't' && xSecond.reason === 'close', {xFirst, xSecond});

    // A press on the scrim closes as outside.
    await tab.click('#t');
    await tab.waitForSelector(WINDOW);
    await tab.mouse.click(20, 780);
    const outside = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), reason: window.heard.filter((one) => one.name === 'sf-search-closed').at(-1)?.detail.reason}));
    expect('scrim-closes', !outside.open && outside.reason === 'outside', outside);

    // Tab stays inside the window.
    await tab.click('#t');
    await tab.waitForSelector(WINDOW);
    for (let i = 0; i < 6; i += 1) await tab.keyboard.press('Tab');
    const trapped = await tab.evaluate(() => document.querySelector('.sf-search-window').contains(document.activeElement));
    expect('tab-trapped', trapped, trapped);
    await tab.keyboard.press('Escape');

    expect('no-console-errors', errors.length === 0, errors);
    await tab.close();
  }

  // ----------------------------------------------------------- a provider
  {
    const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
    await tab.goto(`${origin}/provider`);
    await tab.waitForFunction(() => customElements.get('sf-search') && document.querySelector('#pt').getAttribute('aria-haspopup') === 'dialog', null, {timeout: 20000}).catch(() => {});
    await tab.click('#pt');
    await tab.waitForSelector(WINDOW);
    await tab.keyboard.type('a');
    await tab.waitForTimeout(250);
    const loading = await tab.evaluate(() => ({message: document.querySelector('.sf-search-message')?.textContent.trim(), busy: document.querySelector('.sf-search-card').getAttribute('aria-busy')}));
    await tab.keyboard.type('b');
    await tab.waitForFunction(() => document.querySelector('.sf-search-row-title')?.textContent.includes('ab'), null, {timeout: 5000}).catch(() => {});
    const answered = await tab.evaluate(() => ({calls: window.calls.map((call) => `${call.query}:${call.aborted}`), title: document.querySelector('.sf-search-row-title')?.textContent.trim(),
      busy: document.querySelector('.sf-search-card').getAttribute('aria-busy')}));
    expect('provider-loading', loading.message === 'Ищем…' && loading.busy === 'true', loading);
    expect('provider-aborts-stale', answered.calls.join('|') === ':false|a:true|ab:false' && answered.title === 'Ответ на ab' && answered.busy === 'false', answered);
    await tab.close();
  }

  // ----------------------------------------------------------- phone
  {
    const tab = await browser.newPage({viewport: {width: 375, height: 740}});
    await tab.goto(`${origin}/page`);
    await tab.waitForFunction(() => customElements.get('sf-search') && document.querySelector('#t').getAttribute('aria-haspopup') === 'dialog', null, {timeout: 20000}).catch(() => {});
    await tab.click('#t');
    await tab.waitForSelector(WINDOW);
    await tab.waitForTimeout(200);
    const ladder = await tab.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.blockSize = 'var(--sf-ui-2--control-height)';
      document.body.append(probe);
      const height = probe.getBoundingClientRect().height;
      probe.remove();
      return height;
    });
    const sheet = await tab.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect();
      const shown = (s) => { const n = document.querySelector(s); return Boolean(n && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden'); };
      const w = r('.sf-search-window');
      const field = r('.sf-search-field');
      return {window: [w.left, w.top, w.width, w.height], fieldTop: field.top, fieldHeight: field.height,
        back: shown('.sf-search-back button'), glyph: shown('.sf-search-glyph'), x: shown('.sf-search-clear button'),
        backLabel: document.querySelector('.sf-search-back button')?.getAttribute('aria-label') ?? document.querySelector('.sf-search-back')?.getAttribute('aria-label'),
        cardBottom: r('.sf-search-card').bottom};
    });
    seen.phoneLadder = ladder;
    expect('phone-full-screen', sheet.window.join(',') === '0,0,375,740' && sheet.fieldTop === 0 && Math.abs(sheet.fieldHeight - ladder) < 0.6
      && sheet.back && !sheet.glyph && !sheet.x && sheet.backLabel === 'Назад' && Math.abs(sheet.cardBottom - 740) < 0.6, sheet);
    await typeQuery(tab, 'кноп');
    const typedPhone = await tab.evaluate(() => {
      const shown = (s) => { const n = document.querySelector(s); return Boolean(n && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden'); };
      return {x: shown('.sf-search-clear button'), rows: document.querySelectorAll('.sf-search-row').length};
    });
    expect('phone-x-with-text', typedPhone.x && typedPhone.rows === 2, typedPhone);
    await tab.click('.sf-search-back button');
    const back = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), focus: document.activeElement?.id}));
    expect('phone-back-closes', !back.open && back.focus === 't', back);
    await tab.close();
  }
  // ----------------------------------------------------------- the port
  {
    const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    const openPort = async (query = '') => {
      await tab.goto(`${origin}/port${query}`);
      await tab.waitForFunction(() => document.querySelector('#h')?.sfPort, null, {timeout: 20000}).catch(() => failures.push({name: 'port-connected', detail: query}));
      await tab.click('#ht');
      await tab.waitForSelector(WINDOW, {timeout: 5000});
      await tab.waitForFunction(() => document.querySelector('.sf-search-card')?.getAttribute('aria-busy') === 'false', null, {timeout: 5000}).catch(() => {});
      await tab.waitForTimeout(100);
    };
    const asked = (name) => tab.evaluate((intent) => window.intents.filter((entry) => entry.intent === intent).map((entry) => entry.payload), name);
    const blocks = () => tab.evaluate(() => ({
      recent: document.querySelectorAll('.sf-search-row--recent').length,
      popular: document.querySelectorAll('.sf-search-section .sf-search-pill').length,
      scopes: document.querySelectorAll('.sf-search-scope').length,
      commands: [...document.querySelectorAll('.sf-search-row-title')].filter((n) => n.textContent.includes('Сменить тему')).length,
      pane: document.querySelectorAll('.sf-search-preview').length,
      correction: document.querySelector('.sf-search-correction')?.textContent.trim() ?? '',
      notice: document.querySelector('.sf-search-notice')?.textContent.trim() ?? '',
      width: document.querySelector('.sf-search-window')?.getBoundingClientRect().width ?? 0,
    }));

    // Everything announced, everything wanted.
    await openPort();
    const all = await blocks();
    expect('port-empty-blocks', all.recent === 2 && all.popular === 1 && all.commands === 1, all);
    expect('port-pane-widens-the-window', all.pane === 1 && Math.abs(all.width - 864) < 1, all);
    await typeQuery(tab, 'т');
    const withQuery = await blocks();
    expect('port-scopes-drawn', withQuery.scopes === 4 && withQuery.commands === 1, withQuery);

    // recent.forget and recent.clear go to the host, and its list is drawn.
    await tab.fill('.sf-search-input', '');
    await tab.waitForFunction(() => document.querySelectorAll('.sf-search-row--recent').length === 2, null, {timeout: 5000}).catch(() => {});
    await tab.hover('.sf-search-row--recent');
    await tab.click('.sf-search-row--recent .sf-search-remove');
    await tab.waitForTimeout(100);
    const forgot = await asked('recent.forget');
    const afterForget = await blocks();
    expect('port-recent-forget', forgot.length === 1 && forgot[0].query === 'таблица' && afterForget.recent === 1, {forgot, afterForget});
    await tab.click('.sf-search-caption-action');
    await tab.waitForTimeout(100);
    const cleared = await asked('recent.clear');
    const afterClear = await blocks();
    expect('port-recent-clear', cleared.length === 1 && afterClear.recent === 0, {cleared, afterClear});

    // The host's spelling is offered, not applied; choosing it is a query.
    await typeQuery(tab, 'тблица');
    const offered = await blocks();
    const beforeChoose = await asked('query.change');
    expect('port-correction-offered', offered.correction.includes('таблица') && offered.correction.includes('3')
      && beforeChoose.at(-1).query === 'тблица', {offered, last: beforeChoose.at(-1)});
    await tab.click('.sf-search-correction');
    await tab.waitForTimeout(250);
    const afterChoose = await tab.evaluate(() => ({value: document.querySelector('.sf-search-input').value, line: Boolean(document.querySelector('.sf-search-correction'))}));
    const queries = await asked('query.change');
    expect('port-correction-is-a-query', afterChoose.value === 'таблица' && !afterChoose.line && queries.at(-1).query === 'таблица', {afterChoose, last: queries.at(-1)});

    // The preview follows the selection, and a late answer for a row left is dropped.
    await tab.waitForFunction(() => document.querySelector('.sf-search-preview-title')?.textContent === 'О a', null, {timeout: 5000}).catch(() => {});
    const first = await tab.evaluate(() => document.querySelector('.sf-search-preview')?.textContent.replace(/\s+/gu, ' ').trim());
    expect('port-preview-of-the-row', first === 'Путь a О a Слова a', first);
    await tab.evaluate(() => { window.delayPreview = 400; });
    await tab.keyboard.press('ArrowDown');
    await tab.evaluate(() => { window.delayPreview = 0; });
    await tab.keyboard.press('ArrowDown');
    await tab.waitForTimeout(700);
    const late = await tab.evaluate(() => document.querySelector('.sf-search-preview-title')?.textContent);
    expect('port-preview-stale-dropped', late === 'О c', late);

    // A refusal keeps the window open and says the host's words.
    await tab.keyboard.press('ArrowUp');
    await tab.waitForTimeout(150);
    await tab.keyboard.press('Enter');
    await tab.waitForFunction(() => document.querySelector('.sf-search-notice'), null, {timeout: 5000}).catch(() => {});
    const refused = await blocks();
    expect('port-open-refused-stays', refused.notice === 'Нет доступа к этой странице' && await tab.evaluate(() => Boolean(document.querySelector('.sf-search-window'))), refused);

    // action.run: the host is asked, the window closes, the page hears the command.
    await tab.evaluate(() => { window.navigated = []; document.querySelector('#h').addEventListener('sf-search-navigate', (event) => window.navigated.push(event.detail)); });
    await tab.click('.sf-search-row:has-text("Сменить тему")');
    await tab.waitForFunction(() => !document.querySelector('.sf-search-window'), null, {timeout: 5000}).catch(() => {});
    const ran = await asked('action.run');
    const heard = await tab.evaluate(() => window.navigated);
    expect('port-action-run', ran.length === 1 && ran[0].id === 'theme' && heard[0]?.action === 'theme' && heard[0]?.href === '', {ran, heard});

    // A capability not announced: the block is absent, its intent never raised,
    // and the setting cannot turn it on.
    await openPort('?caps=');
    const none = await blocks();
    expect('port-nothing-announced', none.recent === 0 && none.popular === 0 && none.commands === 0 && none.pane === 0 && Math.abs(none.width - 576) < 1, none);
    await typeQuery(tab, 'т');
    const noneQuery = await blocks();
    const rowsNone = await rowsInfo(tab);
    expect('port-no-capability-query', noneQuery.scopes === 0 && noneQuery.commands === 0 && rowsNone.length === 3, {noneQuery, rowsNone});
    const previewAsked = await asked('result.preview');
    expect('port-no-capability-no-intent', previewAsked.length === 0, previewAsked);

    // Announced, but the page does not want it.
    await openPort('?off=recent,popular,actions,scopes');
    const unwanted = await blocks();
    expect('port-setting-off-empty', unwanted.recent === 0 && unwanted.popular === 0 && unwanted.commands === 0, unwanted);
    await typeQuery(tab, 'т');
    const unwantedQuery = await blocks();
    expect('port-setting-off-query', unwantedQuery.scopes === 0 && unwantedQuery.commands === 0, unwantedQuery);

    // No room for the pane: the host is not asked for words nobody can read.
    await tab.setViewportSize({width: 800, height: 800});
    await openPort();
    await typeQuery(tab, 'т');
    const narrow = await blocks();
    expect('port-narrow-no-pane', narrow.pane === 0 && (await asked('result.preview')).length === 0, narrow);

    expect('port-no-errors', errors.length === 0, errors);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('SEARCH_PROBE_OK');
