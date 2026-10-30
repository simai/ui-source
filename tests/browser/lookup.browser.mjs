#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-lookup on the built bytes, loaded by the real Loader from its rule:
// - the search: below min-length the hint and no call; the debounce (one
//   call for a burst of keys); a new call aborts the previous one through its
//   signal; a late answer of an older call is dropped; unavailable is one
//   neutral line; an error shows Retry, which repeats the call; Show more only
//   with nextCursor, joining the next page;
// - single: a choice is the value, commits and closes the list, the box shows
//   the label; the clear button empties it;
// - multiple: chips, Backspace in the empty box removes the last, the chip's
//   remove button is named Remove <label>; max-items refuses with a visible
//   polite line; exclude never offers a value;
// - the keyboard: ArrowDown opens and moves, ArrowUp, Home, End,
//   aria-activedescendant, Enter chooses, Escape closes then clears;
// - the form: one entry per value, input then change once per choice, a form
//   reset back to the value attribute with no event, required's value-missing;
// - the frame against sf-input's at sizes 1/2, 1 and 2: the border, the
//   radius, the padding, the text inset and size, and the height empty,
//   holding a value and holding a chip;
// - text, captions, the hint, the state line and a chosen row against their
//   backgrounds, at least 4.5:1, in the light and the dark theme;
// - removed while a search runs: the signal is aborted and nothing is left
//   open.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);
const ru = JSON.parse(readFileSync(new URL('../../src/smart/lookup/lang/ru.json', import.meta.url), 'utf8')).runtime;

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let current = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const shell = (theme, body) => `<!doctype html><html lang="en" class="${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;display:grid;gap:16px;background:var(--sf-surface-0)">
${body}
</body></html>`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => {
  if (!pass) failures.push({name, ...detail});
};

const PEOPLE = [
  {value: 'u1', label: 'Anna Petrova', caption: 'Design', avatar: {initials: 'AP'}},
  {value: 'u2', label: 'Boris Ivanov', caption: 'Development'},
  {value: 'u3', label: 'Vera Smirnova', caption: 'Support', avatar: {initials: 'VS'}},
  {value: 'u4', label: 'Gleb Orlov', caption: 'Sales'},
];
const island = (data) => `<script type="application/json" data-sf-settings>${JSON.stringify(data)}</script>`;

async function open(page, theme, body, count) {
  current = shell(theme, body);
  await page.goto(`${base}/probe`, {waitUntil: 'load'});
  await page.waitForFunction((n) => customElements.get('sf-lookup')
    && document.querySelectorAll('sf-lookup .sf-lookup-input').length === n, count, {timeout: 20000});
  await page.waitForTimeout(300);
}

const state = (page, id) => page.evaluate((one) => {
  const el = document.getElementById(one);
  const input = el.querySelector('.sf-lookup-input');
  return {
    expanded: input.getAttribute('aria-expanded'),
    status: el.querySelector('[role=status]').textContent.replace(/\s+/gu, ' ').trim(),
    rows: [...el.querySelectorAll('[role=option]')].map((row) => row.querySelector('.sf-lookup-option-label').textContent),
    selected: [...el.querySelectorAll('[role=option][aria-selected=true]')].map((row) => row.querySelector('.sf-lookup-option-label').textContent),
    active: input.getAttribute('aria-activedescendant'),
    activeLabel: input.getAttribute('aria-activedescendant') ? document.getElementById(input.getAttribute('aria-activedescendant'))?.querySelector('.sf-lookup-option-label')?.textContent : null,
    query: input.value,
    retry: Boolean(el.querySelector('.sf-lookup-retry')),
    more: Boolean(el.querySelector('.sf-lookup-more')),
    chips: [...el.querySelectorAll('sf-tag')].map((tag) => tag.getAttribute('text')),
    value: el.value,
    panelOpen: (() => { try { return el.querySelector('.sf-lookup-panel').matches(':popover-open'); } catch { return null; } })(),
  };
}, id);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });

  // ---- the search against a provider the probe controls ------------------------
  await open(page, 'theme-light', `
    <form id="f">
      <sf-lookup id="p" label="Person" name="person" hint="Type a name" debounce="150"></sf-lookup>
      <button id="after" type="button">After</button>
    </form>`, 1);
  await page.evaluate(() => {
    // Each call is kept with its resolver: the probe answers when it chooses.
    window.__calls = [];
    document.getElementById('p').provider = (query, {cursor, limit, signal}) => new Promise((settle, fail) => {
      const call = {query, cursor, limit, aborted: false, settle, fail};
      signal.addEventListener('abort', () => { call.aborted = true; });
      window.__calls.push(call);
    });
    window.__answer = (index, answer) => window.__calls[index].settle(answer);
    window.__fail = (index) => window.__calls[index].fail(new Error('network'));
  });
  await page.click('#p .sf-lookup-input');
  await page.keyboard.type('a');
  await page.waitForTimeout(300);
  let s = await state(page, 'p');
  check('below min-length: the hint, no call', s.status === 'Type at least 2 characters' && s.expanded === 'true' && (await page.evaluate(() => window.__calls.length)) === 0, s);

  await page.keyboard.type('nn', {delay: 30});
  await page.waitForTimeout(80);
  check('debounce: no call while typing', (await page.evaluate(() => window.__calls.length)) === 0);
  await page.waitForTimeout(250);
  s = await state(page, 'p');
  const first = await page.evaluate(() => window.__calls.map(({query, cursor, limit}) => ({query, cursor, limit})));
  check('debounce: one call for the burst, with cursor null and limit max-results', JSON.stringify(first) === JSON.stringify([{query: 'ann', cursor: null, limit: 20}]), {first});
  check('searching: spinner and Searching…', s.status === 'Searching…' && Boolean(await page.$('#p sf-spinner')), s);

  // A second query: the first call is aborted, and its late answer dropped.
  await page.keyboard.type('a');
  await page.waitForTimeout(300);
  check('a new call aborts the previous one through its signal', await page.evaluate(() => window.__calls.length === 2 && window.__calls[0].aborted && !window.__calls[1].aborted));
  await page.evaluate(() => window.__answer(1, {items: [{value: 'u1', label: 'Anna Petrova', caption: 'Design'}], nextCursor: 'c2'}));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__answer(0, {items: [{value: 'zz', label: 'Stale row'}]}));
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('the late answer of an aborted call is dropped', JSON.stringify(s.rows) === '["Anna Petrova"]', s);
  check('nextCursor shows Show more', s.more === true, s);
  check('the results are said politely', s.status === '1 result', s);

  // A line of the host under the rows, gone with the next search; on a field of
  // its own, so the calls counted above stay as they are.
  const noticed = await page.evaluate(async () => {
    const field = document.createElement('sf-lookup');
    field.setAttribute('label', 'Notice');
    document.body.append(field);
    await customElements.whenDefined('sf-lookup');
    await field.updateComplete;
    const settle = () => new Promise((done) => setTimeout(done, 250));
    let notice = 'First 20 shown';
    field.provider = async () => ({items: [{value: 'n1', label: 'Anna'}], ...(notice ? {notice} : {})});
    field.search('an');
    await settle();
    const shown = field.querySelector('.sf-lookup-status')?.textContent ?? '';
    notice = '';
    field.search('ann');
    await settle();
    const after = field.querySelector('.sf-lookup-status')?.textContent ?? '';
    field.remove();
    return {shown, after};
  });
  check('a notice in the answer shows under the rows', noticed.shown.includes('First 20 shown'), noticed);
  check('the next answer without a notice drops the line', !noticed.after.includes('First 20 shown'), noticed);
  // Show more: the provider asked with the cursor; no nextCursor, no Show more.
  await page.click('#p .sf-lookup-more button, #p .sf-lookup-more');
  await page.waitForTimeout(100);
  const more = await page.evaluate(() => ({query: window.__calls[2]?.query, cursor: window.__calls[2]?.cursor}));
  check('Show more asks with the cursor', more.query === 'anna' && more.cursor === 'c2', more);
  await page.evaluate(() => window.__answer(2, {items: [{value: 'u1', label: 'Anna Petrova'}, {value: 'u9', label: 'Anna Sidorova'}]}));
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('the next page joins, no row twice, and without a cursor there is no Show more', JSON.stringify(s.rows) === '["Anna Petrova","Anna Sidorova"]' && s.more === false, s);
  check('the focus stayed in the search box', await page.evaluate(() => document.activeElement?.classList.contains('sf-lookup-input')));

  // Unavailable and the error with Retry.
  await page.fill('#p .sf-lookup-input', 'bo');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__answer(window.__calls.length - 1, {status: 'unavailable'}));
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('unavailable: one neutral line, no rows, no Retry', s.status === 'Search is unavailable' && s.rows.length === 0 && !s.retry, s);
  await page.fill('#p .sf-lookup-input', 'bor');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__fail(window.__calls.length - 1));
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('a rejected call is the error line with Retry', s.status === 'Search failed' && s.retry, s);
  const before = await page.evaluate(() => window.__calls.length);
  await page.click('#p .sf-lookup-retry');
  await page.waitForTimeout(100);
  const again = await page.evaluate((n) => ({count: window.__calls.length, query: window.__calls[n]?.query, cursor: window.__calls[n]?.cursor}), before);
  check('Retry repeats the last call', again.count === before + 1 && again.query === 'bor' && again.cursor === null, again);
  await page.evaluate(() => window.__answer(window.__calls.length - 1, {items: []}));
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('an empty answer is Nothing found', s.status === 'Nothing found' && s.rows.length === 0, s);

  // A provider that throws at once is the error too.
  await page.evaluate(() => { document.getElementById('p').provider = () => { throw new Error('sync'); }; });
  await page.fill('#p .sf-lookup-input', 'bori');
  await page.waitForTimeout(300);
  s = await state(page, 'p');
  check('a thrown error is the error line', s.status === 'Search failed' && s.retry, s);

  // Single: a choice commits and closes; the box shows the label; events once.
  await page.evaluate(() => {
    const el = document.getElementById('p');
    window.__said = [];
    el.addEventListener('input', (event) => window.__said.push(`input:${event.detail.action}:${event.target === el}`));
    el.addEventListener('change', (event) => window.__said.push(`change:${event.detail.action}`));
    el.provider = async (query) => ({items: [{value: 7, label: `Boris ${query}`, caption: 'Development'}, {value: 8, label: 'Bogdan'}]});
  });
  await page.fill('#p .sf-lookup-input', 'bo');
  await page.waitForTimeout(300);
  check('typing in the box says nothing on the host', await page.evaluate(() => window.__said.length === 0));
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(80);
  s = await state(page, 'p');
  check('ArrowDown makes the first row active (aria-activedescendant)', s.activeLabel === 'Boris bo', s);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('single: Enter chooses, commits and closes; the box shows the label', s.value?.value === 7 && s.value?.label === 'Boris bo' && s.expanded === 'false' && s.query === 'Boris bo' && s.panelOpen === false, s);
  check('single: input then change, once', await page.evaluate(() => JSON.stringify(window.__said) === '["input:replaced:true","change:replaced"]'), {said: await page.evaluate(() => window.__said)});
  check('the form sends the value alone', await page.evaluate(() => new FormData(document.getElementById('f')).get('person') === '7'));
  // Leaving after typing puts the label back.
  await page.click('#p .sf-lookup-input');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('xy');
  await page.waitForTimeout(250);
  // A press outside the field, where nothing takes focus.
  await page.mouse.click(980, 880);
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('single: leaving puts the chosen label back, the value unchanged', s.query === 'Boris bo' && s.value?.value === 7 && s.expanded === 'false', s);
  // The clear button.
  const clear = await page.$('#p .sf-lookup-clear');
  check('single: the clear button is named Clear', Boolean(clear) && (await clear.getAttribute('aria-label')) === 'Clear');
  await clear?.click();
  await page.waitForTimeout(150);
  s = await state(page, 'p');
  check('single: Clear empties the value and says removed', s.value === null && s.query === '' && await page.evaluate(() => window.__said.slice(-2).join() === 'input:removed:true,change:removed'), s);

  // Removed while a search runs: the signal is aborted, nothing stays open.
  await page.evaluate(() => {
    const el = document.getElementById('p');
    window.__pending = null;
    el.provider = (query, {signal}) => new Promise(() => { window.__pending = signal; });
    el.querySelector('input').focus();
    el.search('xyz');
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => document.getElementById('p').remove());
  await page.waitForTimeout(100);
  check('removed mid-search: the call is aborted, the open mark is gone', await page.evaluate(() => window.__pending?.aborted === true && !document.documentElement.dataset.sfPopoverOpen));

  // ---- multiple, inline options, exclude, max-items, keyboard ---------------------
  await open(page, 'theme-light', `
    <form id="g">
      <sf-lookup id="m" label="Members" name="members" multiple max-items="3" value='[{"value":"u1","label":"Anna Petrova"}]'>${island({options: PEOPLE, exclude: ['u4']})}</sf-lookup>
      <sf-lookup id="r" label="Required" name="req" required>${island({options: PEOPLE})}</sf-lookup>
    </form>
    <div lang="ru"><sf-lookup id="ru" aria-label="Человек" min-length="3"></sf-lookup></div>`, 3);
  await page.evaluate(() => {
    const el = document.getElementById('m');
    window.__said = [];
    el.addEventListener('input', (event) => window.__said.push(`input:${event.detail.action}:${event.detail.item?.value}`));
    el.addEventListener('change', (event) => window.__said.push(`change:${event.detail.action}:${event.detail.item?.value}`));
  });
  await page.click('#m .sf-lookup-input');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  s = await state(page, 'm');
  check('options: ArrowDown opens the whole list, the excluded value never offered', JSON.stringify(s.rows) === '["Anna Petrova","Boris Ivanov","Vera Smirnova"]' && s.expanded === 'true', s);
  check('a chosen row stays, marked', JSON.stringify(s.selected) === '["Anna Petrova"]', s);
  check('rows carry the avatar and the caption', await page.evaluate(() => {
    const row = document.querySelector('#m [role=option]');
    return row.querySelector('.sf-avatar')?.textContent.trim() === 'AP' && row.querySelector('.sf-lookup-option-caption')?.textContent === 'Design';
  }));
  for (const [key, expected] of [['ArrowDown', 'Anna Petrova'], ['ArrowDown', 'Boris Ivanov'], ['End', 'Vera Smirnova'], ['ArrowDown', 'Vera Smirnova'], ['Home', 'Anna Petrova'], ['ArrowUp', 'Anna Petrova']]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
    const now = await state(page, 'm');
    check(`${key} makes ${expected} active`, now.activeLabel === expected, now);
  }
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  s = await state(page, 'm');
  check('multiple: Enter adds a chip, the list stays open', JSON.stringify(s.chips) === '["Anna Petrova","Boris Ivanov"]' && s.expanded === 'true', s);
  // Typing filters in place, without a provider.
  await page.keyboard.type('ver');
  await page.waitForTimeout(150);
  s = await state(page, 'm');
  check('options are searched in place', JSON.stringify(s.rows) === '["Vera Smirnova"]', s);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  // At the cap: Anna is chosen again to toggle off? No: Boris and Vera and Anna make 3.
  await page.fill('#m .sf-lookup-input', '');
  await page.keyboard.type('o');
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const el = document.getElementById('m');
    el.options = [...el.options, {value: 'u5', label: 'Olga Novak'}];
    el.search('olga');
  });
  await page.waitForTimeout(150);
  await page.click('#m [role=option]');
  await page.waitForTimeout(150);
  s = await state(page, 'm');
  check('max-items: a choice past the cap is refused with a visible polite line', s.chips.length === 3 && s.status === 'No more than 3'
    && await page.evaluate(() => document.querySelector('#m [role=status]').getAttribute('aria-live') === 'polite'
      && getComputedStyle(document.querySelector('#m .sf-lookup-state')).display !== 'none'), s);
  check('multiple: input then change per choice', await page.evaluate(() => JSON.stringify(window.__said) === JSON.stringify(['input:added:u2', 'change:added:u2', 'input:added:u3', 'change:added:u3'])), {said: await page.evaluate(() => window.__said)});
  check('the form has one entry per chosen value', await page.evaluate(() => JSON.stringify(new FormData(document.getElementById('g')).getAll('members')) === '["u1","u2","u3"]'));
  // Escape closes, a second Escape clears the query.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  s = await state(page, 'm');
  check('Escape closes and keeps the query', s.expanded === 'false' && s.query === 'olga', s);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  s = await state(page, 'm');
  check('a second Escape clears the query', s.query === '', s);
  // Backspace in the empty box removes the last chip.
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);
  s = await state(page, 'm');
  check('Backspace in the empty box removes the last chip', JSON.stringify(s.chips) === '["Anna Petrova","Boris Ivanov"]' && await page.evaluate(() => window.__said.slice(-1)[0] === 'change:removed:u3'), s);
  // A chip's remove button.
  const removeName = await page.evaluate(() => {
    const tag = document.querySelector('#m sf-tag');
    const button = tag.querySelector('button');
    return button?.getAttribute('aria-label') || tag.querySelector('sf-icon-button')?.getAttribute('aria-label');
  });
  check('a chip\'s remove button is named Remove <label>', removeName === 'Remove Anna Petrova', {removeName});
  await page.evaluate(() => document.querySelector('#m sf-tag button').click());
  await page.waitForTimeout(150);
  s = await state(page, 'm');
  check('the remove button removes the chip; the focus goes back to the box', JSON.stringify(s.chips) === '["Boris Ivanov"]'
    && await page.evaluate(() => document.activeElement === document.querySelector('#m .sf-lookup-input')), s);
  // A form reset: the value attribute back, nothing said.
  await page.evaluate(() => { window.__said = []; document.getElementById('g').reset(); });
  await page.waitForTimeout(200);
  s = await state(page, 'm');
  check('a form reset puts the value attribute back and says nothing', JSON.stringify(s.chips) === '["Anna Petrova"]' && await page.evaluate(() => window.__said.length === 0), s);
  // Required.
  check('required and empty: value-missing, the form does not validate', await page.evaluate(() => document.getElementById('r').validity.valueMissing === true
    && document.getElementById('g').checkValidity() === false
    && document.querySelector('#r .sf-lookup-input').getAttribute('aria-required') === 'true'));
  await page.evaluate(() => { document.getElementById('r').value = 'u2'; });
  await page.waitForTimeout(100);
  check('a value set from code is read against the options and makes it valid', await page.evaluate(() => document.getElementById('r').validity.valid && document.getElementById('r').value.label === 'Boris Ivanov'));
  // Russian words on a Russian region.
  await page.evaluate(() => { const el = document.getElementById('ru'); el.provider = async () => ({items: []}); el.querySelector('input').focus(); el.search('ab'); });
  await page.waitForTimeout(150);
  s = await state(page, 'ru');
  check('Russian words on a Russian region; the host\'s aria-label names the box', s.status === ru['hint-min-length'].other.replace('{n}', '3')
    && await page.evaluate(() => document.querySelector('#ru input').getAttribute('aria-label') === 'Человек'), s);

  // ---- geometry against sf-input -------------------------------------------------
  await open(page, 'theme-light', ['1/2', '1', '2'].map((size) => `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px">
      <sf-input data-size="${size}" size="${size}" label="Text"></sf-input>
      <sf-lookup data-size="${size}" data-kind="empty" size="${size}" label="Text"></sf-lookup>
      <sf-lookup data-size="${size}" data-kind="single" size="${size}" label="Text" value='{"value":1,"label":"Anna"}'></sf-lookup>
      <sf-lookup data-size="${size}" data-kind="chip" size="${size}" label="Text" multiple value='[{"value":1,"label":"Anna","avatar":{"initials":"AP"}}]'></sf-lookup></div>`).join(''), 9);
  await page.waitForFunction(() => document.querySelectorAll('sf-input input').length === 3 && document.querySelectorAll('sf-lookup sf-tag .sf-tag').length === 3, null, {timeout: 10000});
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  const geometry = await page.evaluate(() => ['1/2', '1', '2'].map((size) => {
    const field = document.querySelector(`sf-input[data-size="${size}"] .sf-input-field`);
    const input = document.querySelector(`sf-input[data-size="${size}"] input`);
    const measure = (frameElement, inputElement) => {
      const frame = getComputedStyle(frameElement);
      const text = getComputedStyle(inputElement);
      return [frame.borderTopWidth, frame.borderTopLeftRadius, frame.borderTopColor, frame.backgroundColor, text.fontSize, text.lineHeight,
        // Where the text starts inside the frame.
        Math.round(inputElement.getBoundingClientRect().left + parseFloat(text.paddingLeft) - frameElement.getBoundingClientRect().left)];
    };
    const lookup = (kind) => document.querySelector(`sf-lookup[data-size="${size}"][data-kind="${kind}"]`);
    const height = (element) => Math.round(element.getBoundingClientRect().height * 100) / 100;
    return {
      size,
      input: measure(field, input),
      lookup: measure(lookup('empty').querySelector('.sf-lookup-frame'), lookup('empty').querySelector('.sf-lookup-input')),
      heights: {
        input: height(field),
        empty: height(lookup('empty').querySelector('.sf-lookup-frame')),
        single: height(lookup('single').querySelector('.sf-lookup-frame')),
        chip: height(lookup('chip').querySelector('.sf-lookup-frame')),
      },
    };
  }));
  for (const one of geometry) {
    check(`frame matches sf-input at size ${one.size}`, JSON.stringify(one.input) === JSON.stringify(one.lookup), one);
    const {input, empty, single, chip} = one.heights;
    check(`one height at size ${one.size}: empty, single with a value, a chip`, [empty, single, chip].every((one) => Math.abs(input - one) < 0.01), one.heights);
  }
  evidence.geometry = geometry;

  // ---- the list's place -----------------------------------------------------------
  await open(page, 'theme-light', `<sf-lookup id="w" label="Members" multiple>${island({options: PEOPLE})}</sf-lookup>`, 1);
  await page.click('#w .sf-lookup-input');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const place = await page.evaluate(() => {
    const frame = document.querySelector('#w .sf-lookup-frame').getBoundingClientRect();
    const panel = document.querySelector('#w .sf-lookup-panel').getBoundingClientRect();
    return {top: Math.round(panel.top - frame.bottom), left: Math.round(panel.left - frame.left), width: Math.round(panel.width - frame.width), visible: getComputedStyle(document.querySelector('#w .sf-lookup-panel')).visibility};
  });
  check('the list hangs under the frame at its width', place.top >= 0 && place.top <= 8 && place.left === 0 && place.width === 0 && place.visible === 'visible', place);
  evidence.place = place;

  // ---- contrast, light and dark ---------------------------------------------------
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.emulateMedia({colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
    await open(page, theme, `<sf-lookup id="c" label="Members" hint="A hint" placeholder="Find a person" multiple value='[{"value":"u2","label":"Boris Ivanov"}]'>${island({options: PEOPLE})}</sf-lookup>
      <sf-lookup id="h" label="Person" hint="A hint" placeholder="Find a person"></sf-lookup>
      <sf-lookup id="fl" label="Person" appearance="filled" placeholder="Find a person"></sf-lookup>`, 3);
    await page.evaluate(() => { const el = document.getElementById('h'); el.provider = async () => ({items: []}); });
    await page.click('#c .sf-lookup-input');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    const ratios = await page.evaluate(() => {
      const canvas = document.createElement('canvas').getContext('2d');
      const rgba = (color) => {
        canvas.fillStyle = '#000';
        canvas.fillStyle = color;
        const value = canvas.fillStyle;
        if (value.startsWith('#')) return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)).concat(1);
        const parts = value.match(/[\d.]+/gu).map(Number);
        return [parts[0], parts[1], parts[2], parts[3] ?? 1];
      };
      // The background an element shows: its own, laid over its ancestors'.
      const background = (element) => {
        const layers = [];
        for (let node = element; node; node = node.parentElement) layers.push(rgba(getComputedStyle(node).backgroundColor));
        let result = [255, 255, 255];
        for (const layer of layers.reverse()) result = result.map((channel, index) => channel * (1 - layer[3]) + layer[index] * layer[3]);
        return result;
      };
      const luminance = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index], 0);
      const ratio = (element, pseudo = null) => {
        const fore = rgba(getComputedStyle(element, pseudo).color);
        const back = background(element);
        const ink = fore.slice(0, 3).map((channel, index) => channel * fore[3] + back[index] * (1 - fore[3]));
        const [a, b] = [luminance(ink), luminance(back)].sort((x, y) => y - x);
        return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
      };
      const rows = document.querySelectorAll('#c [role=option]');
      return {
        label: ratio(document.querySelector('#c .sf-lookup-text')),
        hint: ratio(document.querySelector('#h .sf-lookup-hint-text-wrap')),
        placeholder: ratio(document.querySelector('#h .sf-lookup-input'), '::placeholder'),
        filledPlaceholder: ratio(document.querySelector('#fl .sf-lookup-input'), '::placeholder'),
        rowLabel: ratio(rows[0].querySelector('.sf-lookup-option-label')),
        rowCaption: ratio(rows[0].querySelector('.sf-lookup-option-caption')),
        chosenLabel: ratio(rows[1].querySelector('.sf-lookup-option-label')),
        chosenCaption: ratio(rows[1].querySelector('.sf-lookup-option-caption')),
        chip: ratio(document.querySelector('#c sf-tag .sf-tag-text, #c sf-tag .sf-tag') || document.querySelector('#c sf-tag')),
        chosenMarked: rows[1].getAttribute('aria-selected'),
      };
    });
    // The state line: the hint of an empty search.
    // The open list of #c covers #h: the focus moves by script, which closes it.
    await page.focus('#h .sf-lookup-input');
    await page.keyboard.type('a');
    await page.waitForTimeout(300);
    ratios.state = await page.evaluate(() => {
      const element = document.querySelector('#h .sf-lookup-state-text');
      const canvas = document.createElement('canvas').getContext('2d');
      const rgba = (color) => { canvas.fillStyle = '#000'; canvas.fillStyle = color; const v = canvas.fillStyle; if (v.startsWith('#')) return [1, 3, 5].map((at) => parseInt(v.slice(at, at + 2), 16)).concat(1); const p = v.match(/[\d.]+/gu).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
      const layers = [];
      for (let node = element; node; node = node.parentElement) layers.push(rgba(getComputedStyle(node).backgroundColor));
      let back = [255, 255, 255];
      for (const layer of layers.reverse()) back = back.map((c, i) => c * (1 - layer[3]) + layer[i] * layer[3]);
      const fore = rgba(getComputedStyle(element).color);
      const ink = fore.slice(0, 3).map((c, i) => c * fore[3] + back[i] * (1 - fore[3]));
      const lum = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const [a, b] = [lum(ink), lum(back)].sort((x, y) => y - x);
      return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
    });
    evidence[theme] = ratios;
    check(`${theme}: the page is in that theme`, await page.evaluate((name) => document.documentElement.classList.contains(name), theme));
    check(`${theme}: the chosen row is marked`, ratios.chosenMarked === 'true');
    for (const [part, value] of Object.entries(ratios)) {
      if (typeof value === 'number') check(`${theme}: ${part} contrast ${value} >= 4.5`, value >= 4.5, {value});
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('LOOKUP_OK');
