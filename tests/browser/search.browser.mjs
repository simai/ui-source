#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-search on the built bytes, through the real Loader, at a desktop and a
// phone width. Rewritten for the window of 1.10.x (C175): the field is the
// window's frameless head, the scopes are one sf-tag-group, the selected row
// ends in its Enter or its own buttons, the key hints wait for an arrow.
// - Command/Control+K opens the window from anywhere, / only outside a text
//   field; the field takes the focus and the trigger says aria-expanded;
// - the built-in provider reads the static index: quick actions and popular
//   pills on an empty field; typing finds grouped results with the match
//   marked; the arrows move the selection (aria-activedescendant), Enter opens
//   the selected result (sf-search-navigate, cancelable) and the window closes;
//   a pointer over a row selects it;
// - the scopes are one sf-tag-group of single choice (C175 (4)): they filter
//   the results and keep their counts, the scope in force has a check (C145
//   (2)); chosen with a pointer, the focus goes back to the field (dispatcher
//   2026-11-16), chosen from the keyboard it stays on the tag;
// - a query is recorded as recent when a result is opened (SF.Preferences,
//   localStorage sf-pref:sf-search/<recent-key>), the page opened stands as a
//   recent page under the queries; a recent query is removed by its X and the
//   list is cleared by «Очистить»;
// - the field's X clears a filled field and keeps the focus (the empty head
//   has no X; the back arrow, «Закрыть», is the phone's); Escape clears, then
//   closes; focus goes back to the trigger;
// - a provider: while an answer is awaited the rows on screen stay (paler,
//   aria-busy) and a «Поиск…» line with a spinner comes after 1 s (C139 (4));
//   nothing found and a failure are inline sf-empty-states, «Повторить» asks
//   again (C120); a stale request aborted; a cut title is the row's tooltip;
// - the match is medium weight without a fill (C139 (8)); a window opened by
//   a key with nothing focused gives the focus back to its trigger (SR-7);
// - geometry: the head on the control height of step 2 and its 1 px line, a
//   result row of two lines 48 px, a recent row of one line 40 px, the head
//   glyph and the row glyph 20; the head's glyph and the rows' glyphs on one axis, the
//   field's text where the titles start; the window and its card one width;
// - the key hints wait for the first arrow (R252, C175 (11));
// - at 375 px the window is a full-screen sheet with the field on top and a
//   back arrow («Закрыть»; «Назад» inside a command's step) that closes it.
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
    {group: 'components', title: 'sf-view-table', path: 'SIMAI Pro', text: 'таблица данных', href: '#sf-table', icon: 'widgets'},
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
  {id: 'c', group: 'components', title: 'sf-view-table', path: 'Pro', kind: 'page', url: '#c'},
  {id: 'theme', group: 'actions', title: 'Сменить тему', kind: 'action', shortcut: 'T'},
];
window.host = {port: 'simai.search-port', version: '1.0.0', capabilities: caps,
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
    if (query === 'fail') return setTimeout(() => settle(Promise.reject(new Error('down'))), 50);
  if (query === 'none') return setTimeout(() => settle({items: [], popular: ['кнопка']}), 50);
  const title = query === 'long' ? 'Ответ с очень длинным названием раздела документации, которое никак не помещается в одну строку окна поиска' : 'Ответ на ' + query;
  setTimeout(() => settle({items: query ? [{id: 'x', title, path: 'Где-то', href: '#x'}] : [], popular: ['кнопка']}), query === 'slow' ? 2500 : query ? 600 : 0);
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
const INPUT = '.sf-search-input';
const CLEAR = '.sf-search-clear button';
const SCOPE = (key) => `.sf-search-scopes sf-tag[key="${key}"] button`;
const rowsInfo = (tab) => tab.evaluate(() => [...document.querySelectorAll('.sf-search-row')].map((row) => ({
  id: row.id,
  title: row.querySelector('.sf-search-row-title')?.textContent.trim(),
  selected: row.getAttribute('aria-selected') === 'true',
  mark: row.querySelector('mark')?.textContent ?? null,
})));
const scopesInfo = (tab) => tab.evaluate(() => [...document.querySelectorAll('.sf-search-scopes sf-tag')].map((tag) => ({
  key: tag.getAttribute('key'), text: tag.getAttribute('text'), count: tag.getAttribute('count'),
  pressed: tag.querySelector('button')?.getAttribute('aria-pressed') ?? null,
  check: Boolean(tag.querySelector('.sf-tag-check')),
})));
const focusedOn = (tab) => tab.evaluate(() => {
  const active = document.activeElement;
  if (active?.matches('.sf-search-input')) return 'field';
  const tag = active?.closest('sf-tag');
  return tag ? `tag:${tag.getAttribute('key')}` : (active?.id || active?.localName || 'none');
});
const typeQuery = async (tab, text) => {
  await tab.keyboard.type(text, {delay: 20});
  // Past the debounce, then until the card is no longer busy with a request.
  await tab.waitForTimeout(200);
  await tab.waitForFunction(() => document.querySelector('.sf-search-card')?.getAttribute('aria-busy') === 'false', null, {timeout: 5000}).catch(() => {});
};
const settled = (tab) => tab.waitForFunction(() => document.querySelector('.sf-search-card')?.getAttribute('aria-busy') === 'false', null, {timeout: 5000}).catch(() => {});

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
    await tab.waitForTimeout(300);
    const opened = await tab.evaluate(() => {
      const w = document.querySelector('.sf-search-window');
      const input = document.querySelector('.sf-search-input');
      return {
        dialog: w?.getAttribute('role'), modal: w?.getAttribute('aria-modal'), label: w?.getAttribute('aria-label'),
        focused: document.activeElement === input, expanded: document.querySelector('#t').getAttribute('aria-expanded'),
        locked: document.documentElement.style.overflow, open: document.querySelector('#s').getAttribute('data-open'),
        portalAtBodyEnd: document.body.lastElementChild?.classList.contains('sf-search-portal') && document.body.lastElementChild.contains(w),
        captions: [...document.querySelectorAll('.sf-search-caption > span')].map((n) => n.textContent.trim()),
        pills: [...document.querySelectorAll('.sf-search-pills .sf-search-pill')].map((n) => n.textContent.trim()),
        actions: [...document.querySelectorAll('.sf-search-row')].map((n) => n.querySelector('.sf-search-row-title').textContent.trim()),
        kbd: document.querySelector('.sf-search-row .sf-search-row-keys')?.textContent.replace(/\s+/gu, '') ?? null,
        back: document.querySelector('.sf-search-back button')?.getAttribute('aria-label') ?? null,
        clear: Boolean(document.querySelector('.sf-search-clear')),
        hints: Boolean(document.querySelector('.sf-search-keys')),
      };
    });
    expect('shortcut-opens', opened.dialog === 'dialog' && opened.modal === 'true' && opened.label === 'Поиск по сайту' && opened.focused
      && opened.expanded === 'true' && opened.locked === 'hidden' && opened.open === 'true' && opened.portalAtBodyEnd, opened);
    expect('empty-field-blocks', opened.captions.join('|') === 'Часто ищут|Быстрые действия' && opened.pills.join('|') === 'таблица|тема|кнопка'
      && opened.actions.join('|') === 'Сменить тему' && opened.kbd === '⇧⌘L', opened);
    expect('empty-head-back-no-x', opened.back === 'Закрыть' && !opened.clear, opened);
    expect('key-hints-wait-for-an-arrow', !opened.hints, opened);

    // A popular pill fills the field.
    await tab.click('.sf-search-pills .sf-search-pill >> nth=0');
    await tab.waitForFunction(() => document.querySelectorAll('.sf-search-row mark').length > 0, null, {timeout: 5000}).catch(() => {});
    const pill = await tab.evaluate(() => ({value: document.querySelector('.sf-search-input').value, focused: document.activeElement === document.querySelector('.sf-search-input')}));
    expect('popular-fills-field', pill.value === 'таблица' && pill.focused, pill);

    // X clears a filled field and keeps the focus; the empty head has none.
    await tab.click(CLEAR);
    await tab.waitForTimeout(150);
    const cleared = await tab.evaluate(() => ({value: document.querySelector('.sf-search-input')?.value, focused: document.activeElement === document.querySelector('.sf-search-input'),
      x: Boolean(document.querySelector('.sf-search-clear')), open: Boolean(document.querySelector('.sf-search-window'))}));
    expect('x-clears', cleared.value === '' && cleared.focused && !cleared.x && cleared.open, cleared);

    // Typing: grouped results, the match marked, the first row selected.
    await typeQuery(tab, 'таб');
    const typed = await tab.evaluate(() => ({
      captions: [...document.querySelectorAll('.sf-search-group .sf-search-caption')].map((n) => n.textContent.trim()),
      mark: (() => { const m = document.querySelector('.sf-search-row mark'); const cs = m && getComputedStyle(m); return m && {weight: cs.fontWeight, fill: cs.backgroundColor}; })(),
      status: document.querySelector('.sf-search-window [role="status"]')?.textContent.trim(),
      xLabel: document.querySelector('.sf-search-clear button')?.getAttribute('aria-label'),
      active: document.querySelector('.sf-search-input').getAttribute('aria-activedescendant'),
      scopesLabel: document.querySelector('.sf-search-scopes')?.getAttribute('aria-label'),
    }));
    const rows = await rowsInfo(tab);
    const scopes = await scopesInfo(tab);
    seen.scopes = scopes;
    expect('results-grouped-marked', rows.length === 3 && rows[0].title === 'Таблица в рамке' && rows[0].mark === 'Таб' && rows[0].selected
      && typed.active === rows[0].id && typed.captions.join('|') === 'Страницы|Компоненты' && typed.status === '3 результата' && typed.xLabel === 'Очистить', {rows, typed});
    expect('scopes-with-counts', scopes.map((one) => `${one.text}${one.count}`).join('|') === 'Все3|Страницы2|Компоненты1'
      && scopes[0].pressed === 'true' && typed.scopesLabel === 'Где искать', {scopes, typed});
    expect('scope-in-force-checked', scopes.map((one) => (one.check ? 'check' : '')).join('|') === 'check||', scopes);
    expect('match-medium-no-fill', typed.mark?.weight === '500' && typed.mark?.fill === 'rgba(0, 0, 0, 0)', typed.mark);

    // The key hints come with the first arrow; the arrows move the selection, wrapping.
    await tab.keyboard.press('ArrowDown');
    const down = await rowsInfo(tab);
    const hinted = await tab.evaluate(() => Boolean(document.querySelector('.sf-search-keys')));
    await tab.keyboard.press('ArrowUp');
    await tab.keyboard.press('ArrowUp');
    const wrapped = await rowsInfo(tab);
    const activeAfter = await tab.evaluate(() => document.querySelector('.sf-search-input').getAttribute('aria-activedescendant'));
    expect('arrows-move', down[1]?.selected && wrapped.at(-1)?.selected && activeAfter === wrapped.at(-1).id, {down, wrapped, activeAfter});
    expect('key-hints-after-an-arrow', hinted, hinted);

    // A pointer over a row selects it.
    const second = await tab.$('.sf-search-row >> nth=1');
    const box = await second.boundingBox();
    await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await tab.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
    const hovered = await rowsInfo(tab);
    expect('hover-selects', hovered[1]?.selected === true, hovered);

    // Scopes filter: Компоненты shows its one row, without captions; chosen
    // with a pointer, the focus is back in the field.
    await tab.click(SCOPE('components'));
    await settled(tab);
    await tab.waitForTimeout(150);
    const scoped = await tab.evaluate(() => ({
      rows: [...document.querySelectorAll('.sf-search-row-title')].map((n) => n.textContent.trim()),
      captions: document.querySelectorAll('.sf-search-group .sf-search-caption').length,
    }));
    const scopedTags = await scopesInfo(tab);
    const scopedFocus = await focusedOn(tab);
    expect('scope-filters', scoped.rows.join('|') === 'sf-view-table' && scoped.captions === 0
      && scopedTags.map((one) => `${one.text}${one.count}:${one.pressed}`).join('|') === 'Все3:false|Страницы2:false|Компоненты1:true', {scoped, scopedTags});
    expect('scope-click-focus-back-to-field', scopedFocus === 'field', scopedFocus);
    // Typing goes on in the field at once.
    await tab.keyboard.type('л', {delay: 20});
    await settled(tab);
    const typedOn = await tab.evaluate(() => document.querySelector('.sf-search-input').value);
    expect('scope-click-type-on', typedOn === 'табл', typedOn);
    await tab.keyboard.press('Backspace');
    await settled(tab);
    // From the keyboard the focus stays on the tag the person chose.
    await tab.focus(SCOPE('pages'));
    await tab.keyboard.press('Space');
    await settled(tab);
    await tab.waitForTimeout(150);
    const keyFocus = await focusedOn(tab);
    const keyTags = await scopesInfo(tab);
    expect('scope-key-focus-stays-on-tag', keyFocus === 'tag:pages' && keyTags.find((one) => one.key === 'pages')?.pressed === 'true', {keyFocus, keyTags});
    await tab.click(SCOPE('*'));
    await settled(tab);
    const back = await focusedOn(tab);
    const all = await rowsInfo(tab);
    expect('scope-all-again', back === 'field' && all.length === 3, {back, all: all.length});

    // Geometry, measured on the open window (result rows of two lines).
    const geometry = await tab.evaluate(() => {
      const rect = (node) => node?.getBoundingClientRect();
      const ladder = (name) => {
        const probe = document.createElement('div');
        probe.style.blockSize = `var(${name})`;
        document.body.append(probe);
        const height = probe.getBoundingClientRect().height;
        probe.remove();
        return height;
      };
      const headNode = document.querySelector('.sf-search-head');
      const head = rect(headNode);
      const line = parseFloat(getComputedStyle(headNode).borderBottomWidth) || 0;
      const glyph = rect(document.querySelector('.sf-search-glyph .sf-icon'));
      const input = document.querySelector('.sf-search-input');
      const inputBox = rect(input);
      const row = document.querySelector('.sf-search-row--two');
      const rowGlyph = rect(row.querySelector('.sf-search-row-icon'));
      const title = row.querySelector('.sf-search-row-title');
      const range = document.createRange();
      range.selectNodeContents(title);
      const titleText = range.getBoundingClientRect();
      const card = rect(document.querySelector('.sf-search-card'));
      const win = rect(document.querySelector('.sf-search-window'));
      const cs = getComputedStyle(input);
      const centre = (r) => r.left + r.width / 2;
      return {
        headHeight: head.height - line, line, control2: ladder('--sf-ui-2--control-height'), rowHeight: rect(row).height,
        headGlyph: glyph.width, rowGlyph: rowGlyph.width,
        glyphAxis: centre(glyph) - centre(rowGlyph), textStart: (inputBox.left + parseFloat(cs.paddingLeft)) - titleText.left,
        widths: [win.width, card.width],
      };
    });
    const near = (value, want) => Math.abs(value - want) < 0.6;
    expect('geometry-ladder', near(geometry.headHeight, geometry.control2) && near(geometry.rowHeight, 48)
      && near(geometry.headGlyph, 20) && near(geometry.rowGlyph, 20) && near(geometry.line, 1), geometry);
    expect('geometry-axes', near(geometry.glyphAxis, 0) && near(geometry.textStart, 0) && near(geometry.widths[0], geometry.widths[1]), geometry);
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
    await tab.focus(INPUT);
    await tab.keyboard.press('ArrowDown');
    const before = await rowsInfo(tab);
    await tab.keyboard.press('Enter');
    await tab.waitForTimeout(200);
    const chosen = await tab.evaluate(() => ({heard: window.heard, open: Boolean(document.querySelector('.sf-search-window')), href: location.hash,
      recent: JSON.parse(localStorage.getItem('sf-pref:sf-search/probe-recent'))?.queries ?? null, locked: document.documentElement.style.overflow}));
    const navigate = chosen.heard.find((one) => one.name === 'sf-search-navigate');
    const picked = before.find((row) => row.selected);
    expect('enter-navigates', navigate && picked?.title === 'Таблицы данных' && navigate.detail.href === '#data' && navigate.detail.query === 'таб'
      && navigate.detail.group === 'pages' && !chosen.open && chosen.href === '' && chosen.locked === ''
      && chosen.heard.some((one) => one.name === 'sf-search-closed'), {chosen, picked});
    expect('recent-recorded', JSON.stringify(chosen.recent) === JSON.stringify(['таб']), chosen.recent);

    // Recent: shown on the empty field after opening from the trigger; a
    // recent row puts its query into the field.
    await tab.click('#t');
    await tab.waitForSelector('.sf-search-row--recent', {timeout: 5000}).catch(() => {});
    const recent = await tab.evaluate(() => ({
      captions: [...document.querySelectorAll('.sf-search-caption > span')].map((n) => n.textContent.trim()),
      rows: [...document.querySelectorAll('.sf-search-row--recent:not(:has(> a.sf-search-row-main)) .sf-search-row-title')].map((n) => n.textContent.trim()),
      remove: document.querySelector('.sf-search-row--recent .sf-search-row-actions--recent button')?.getAttribute('aria-label'),
      height: document.querySelector('.sf-search-row--recent')?.getBoundingClientRect().height,
    }));
    expect('recent-shown', recent.captions[0] === 'Недавние' && recent.rows.join('|') === 'таб' && recent.remove === 'Убрать «таб»' && Math.abs(recent.height - 40) < 0.6, recent);
    // Record two more: type, open a result.
    for (const query of ['кноп', 'тём']) {
      await typeQuery(tab, query);
      await tab.keyboard.press('Enter');
      await tab.waitForTimeout(200);
      await tab.click('#t');
      await tab.waitForSelector('.sf-search-row--recent', {timeout: 5000}).catch(() => {});
    }
    const three = await tab.evaluate(() => [...document.querySelectorAll('.sf-search-row--recent:not(:has(> a.sf-search-row-main)) .sf-search-row-title')].map((n) => n.textContent.trim()));
    expect('recent-newest-first', three.join('|') === 'тём|кноп|таб', three);
    // Remove the middle one by its X.
    await tab.hover('.sf-search-row--recent >> nth=1');
    await tab.click('.sf-search-row--recent >> nth=1 >> .sf-search-row-actions--recent button');
    await tab.waitForTimeout(150);
    const removed = await tab.evaluate(() => ({rows: [...document.querySelectorAll('.sf-search-row--recent:not(:has(> a.sf-search-row-main)) .sf-search-row-title')].map((n) => n.textContent.trim()),
      stored: JSON.parse(localStorage.getItem('sf-pref:sf-search/probe-recent'))?.queries ?? null, focused: document.activeElement === document.querySelector('.sf-search-input'), open: Boolean(document.querySelector('.sf-search-window'))}));
    expect('recent-remove', removed.rows.join('|') === 'тём|таб' && JSON.stringify(removed.stored) === JSON.stringify(['тём', 'таб']) && removed.focused && removed.open, removed);
    // Enter on a recent row fills the field.
    await tab.keyboard.press('Enter');
    await tab.waitForFunction(() => document.querySelectorAll('.sf-search-row mark').length > 0, null, {timeout: 5000}).catch(() => {});
    const refilled = await tab.evaluate(() => document.querySelector('.sf-search-input').value);
    expect('recent-fills-field', refilled === 'тём', refilled);
    // Clear the field, then «Очистить» empties the list.
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(150);
    await tab.click('.sf-search-caption-action');
    await tab.waitForTimeout(150);
    const emptied = await tab.evaluate(() => ({rows: document.querySelectorAll('.sf-search-row--recent').length, stored: JSON.parse(localStorage.getItem('sf-pref:sf-search/probe-recent'))?.queries ?? null,
      open: Boolean(document.querySelector('.sf-search-window'))}));
    expect('recent-clear', emptied.rows === 0 && (emptied.stored === null || emptied.stored.length === 0) && emptied.open, emptied);

    // Escape: clears first, then closes and gives focus back to the trigger.
    await tab.focus(INPUT);
    await typeQuery(tab, 'кноп');
    await tab.keyboard.press('Escape');
    const firstEscape = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), value: document.querySelector('.sf-search-input')?.value}));
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(200);
    const secondEscape = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), focus: document.activeElement?.id,
      reason: window.heard.filter((one) => one.name === 'sf-search-closed').at(-1)?.detail.reason, expanded: document.querySelector('#t').getAttribute('aria-expanded')}));
    expect('escape-clears-then-closes', firstEscape.open && firstEscape.value === '' && !secondEscape.open && secondEscape.focus === 't'
      && secondEscape.reason === 'escape' && secondEscape.expanded === 'false', {firstEscape, secondEscape});

    // The X clears and keeps the window; with the field empty, Escape closes;
    // focus back to the trigger. (The back arrow is the phone's.)
    await tab.click('#t');
    await tab.waitForSelector(WINDOW);
    await typeQuery(tab, 'тем');
    await tab.click(CLEAR);
    await tab.waitForTimeout(150);
    const xFirst = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), value: document.querySelector('.sf-search-input')?.value}));
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(200);
    const xSecond = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), focus: document.activeElement?.id,
      reason: window.heard.filter((one) => one.name === 'sf-search-closed').at(-1)?.detail.reason}));
    expect('x-clears-then-escape-closes', xFirst.open && xFirst.value === '' && !xSecond.open && xSecond.focus === 't' && xSecond.reason === 'escape', {xFirst, xSecond});

    // A press on the scrim closes as outside.
    await tab.click('#t');
    await tab.waitForSelector(WINDOW);
    await tab.mouse.click(20, 780);
    await tab.waitForTimeout(200);
    const outside = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), reason: window.heard.filter((one) => one.name === 'sf-search-closed').at(-1)?.detail.reason}));
    expect('scrim-closes', !outside.open && outside.reason === 'outside', outside);

    // Tab stays inside the window.
    await tab.click('#t');
    await tab.waitForSelector(WINDOW);
    for (let i = 0; i < 6; i += 1) await tab.keyboard.press('Tab');
    const trapped = await tab.evaluate(() => document.querySelector('.sf-search-window').contains(document.activeElement));
    expect('tab-trapped', trapped, trapped);
    await tab.focus(INPUT);
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(200);

    // SR-7: opened by the key with nothing focused, Escape gives the focus to
    // the trigger, not to the body.
    await tab.evaluate(() => document.activeElement?.blur());
    await tab.keyboard.press('Control+k');
    await tab.waitForSelector(WINDOW);
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(200);
    const byKey = await tab.evaluate(() => ({open: Boolean(document.querySelector('.sf-search-window')), focus: document.activeElement?.id || document.activeElement?.localName}));
    expect('key-open-focus-back-to-trigger', !byKey.open && byKey.focus === 't', byKey);

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
    const loading = await tab.evaluate(() => ({message: document.querySelector('.sf-search-message')?.textContent.trim() ?? null,
      line: Boolean(document.querySelector('.sf-search-wait')), busy: document.querySelector('.sf-search-card').getAttribute('aria-busy')}));
    await tab.keyboard.type('b');
    await tab.waitForFunction(() => document.querySelector('.sf-search-row-title')?.textContent.includes('ab'), null, {timeout: 5000}).catch(() => {});
    const answered = await tab.evaluate(() => ({calls: window.calls.map((call) => `${call.query}:${call.aborted}`), title: document.querySelector('.sf-search-row-title')?.textContent.trim(),
      busy: document.querySelector('.sf-search-card').getAttribute('aria-busy')}));
    expect('provider-waits-quietly', loading.message === null && !loading.line && loading.busy === 'true', loading);
    expect('provider-aborts-stale', answered.calls.join('|') === ':false|a:true|ab:false' && answered.title === 'Ответ на ab' && answered.busy === 'false', answered);

    // A slow answer: the last rows stay paler, the «Поиск…» line after 1 s.
    const fill = async (text) => {
      await tab.evaluate((value) => { const input = document.querySelector('.sf-search-input'); input.value = value; input.dispatchEvent(new Event('input', {bubbles: true})); }, text);
    };
    await fill('slow');
    await tab.waitForTimeout(400);
    const early = await tab.evaluate(() => ({rows: document.querySelectorAll('.sf-search-row').length, stale: Boolean(document.querySelector('.sf-search-body--stale')),
      line: Boolean(document.querySelector('.sf-search-wait'))}));
    await tab.waitForTimeout(900);
    const late = await tab.evaluate(() => ({rows: document.querySelectorAll('.sf-search-row').length, line: document.querySelector('.sf-search-wait > span')?.textContent.trim(),
      spinner: Boolean(document.querySelector('.sf-search-wait sf-spinner')), status: document.querySelector('.sf-search-window [role="status"]')?.textContent.trim()}));
    expect('provider-rows-stay-paler', early.rows === 1 && early.stale && !early.line, early);
    expect('provider-wait-line-after-1s', late.rows === 1 && late.line === 'Поиск…' && late.spinner && late.status === 'Поиск…', late);
    await tab.waitForFunction(() => !document.querySelector('.sf-search-wait'), null, {timeout: 5000}).catch(() => {});

    // Nothing found and a failure: inline empty states (C120).
    await fill('none');
    await tab.waitForTimeout(400);
    const none = await tab.evaluate(() => ({kind: document.querySelector('.sf-search-card sf-empty-state')?.getAttribute('kind'),
      pills: [...document.querySelectorAll('.sf-search-pills .sf-search-pill')].map((n) => n.textContent.trim())}));
    expect('provider-nothing-found-state', none.kind === 'nothing-found' && none.pills.join('|') === 'кнопка', none);
    await fill('fail');
    await tab.waitForTimeout(400);
    const failed = await tab.evaluate(() => ({kind: document.querySelector('.sf-search-card sf-empty-state')?.getAttribute('kind'),
      retry: document.querySelector('.sf-search-card sf-empty-state button')?.textContent.trim()}));
    expect('provider-error-state', failed.kind === 'error' && failed.retry === 'Повторить', failed);
    const asked = await tab.evaluate(() => window.calls.length);
    await tab.click('.sf-search-card sf-empty-state button');
    await tab.waitForTimeout(300);
    expect('provider-retry-asks-again', (await tab.evaluate(() => window.calls.length)) === asked + 1 && (await tab.evaluate(() => window.calls.at(-1).query)) === 'fail', asked);

    // A cut title is the row's tooltip.
    await fill('long');
    await tab.waitForFunction(() => document.querySelector('.sf-search-row'), null, {timeout: 5000}).catch(() => {});
    await tab.hover('.sf-search-row');
    const tip = await tab.evaluate(() => document.querySelector('.sf-search-row')?.getAttribute('title') ?? '');
    expect('cut-title-tooltip', tip.startsWith('Ответ с очень длинным') && tip.endsWith('Где-то'), tip);
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
      const field = r('.sf-search-head');
      const line = parseFloat(getComputedStyle(document.querySelector('.sf-search-head')).borderBottomWidth) || 0;
      return {window: [w.left, w.top, w.width, w.height], fieldTop: field.top, fieldHeight: field.height - line,
        back: shown('.sf-search-back button'), glyph: shown('.sf-search-glyph'), x: shown('.sf-search-clear button'),
        backLabel: document.querySelector('.sf-search-back button')?.getAttribute('aria-label') ?? document.querySelector('.sf-search-back')?.getAttribute('aria-label'),
        cardBottom: r('.sf-search-card').bottom};
    });
    seen.phoneLadder = ladder;
    expect('phone-full-screen', sheet.window.join(',') === '0,0,375,740' && sheet.fieldTop === 0 && Math.abs(sheet.fieldHeight - ladder) < 0.6
      && sheet.back && !sheet.glyph && !sheet.x && sheet.backLabel === 'Закрыть' && Math.abs(sheet.cardBottom - 740) < 0.6, sheet);
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
      scopes: document.querySelectorAll('.sf-search-scopes sf-tag').length,
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
    expect('port-pane-widens-the-window', all.pane === 1 && all.width > 576 + 1, all);
    await typeQuery(tab, 'т');
    const withQuery = await blocks();
    expect('port-scopes-drawn', withQuery.scopes === 4 && withQuery.commands === 1, withQuery);

    // recent.forget and recent.clear go to the host, and its list is drawn.
    await tab.fill('.sf-search-input', '');
    await tab.waitForFunction(() => document.querySelectorAll('.sf-search-row--recent').length === 2, null, {timeout: 5000}).catch(() => {});
    await tab.hover('.sf-search-row--recent');
    await tab.click('.sf-search-row--recent .sf-search-row-actions--recent button');
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
