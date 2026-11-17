#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Framework order FO-4 (the view set study, ui-control control/research/
// 2026-11-17-view-round-1/framework-orders.md): sf-input-choice 1.7.0,
// appearance list. At 1440 and 390, light and dark, `loads` fresh loads each
// (3 by default). Measured: the three option visuals -- an avatar (sf-avatar)
// and a colour circle before the name, the name itself as a tonal badge --
// each on the row's line; a searchable field searches the options in hand
// (case and accents folded) and says «nothing found»; a field with a host
// provider shows the first page, «Показать ещё» asks for the next one with the
// cursor, a search asks the provider with the query and drops an older answer,
// an error is said with «Повторить», which asks again; a chosen option the
// pages have not reached keeps its row; typing in the search box changes no
// value. No sideways scroll and a clean console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const avatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#4a7"/></svg>')}`;
const VISUALS = [
  {value: 'anna', label: 'Анна Смирнова', avatar},
  {value: 'boris', label: 'Борис Петров', avatar: {text: 'БП'}},
  {value: 'red', label: 'Красный', swatch: '#e53935'},
  {value: 'blue', label: 'Синий', swatch: 'oklch(0.6 0.15 250)'},
  {value: 'new', label: 'Новая', scheme: 'primary'},
  {value: 'done', label: 'Готово', scheme: 'success'},
];
const j = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');
const BODY = `<main style="display:flex;flex-direction:column;gap:24px;inline-size:min(100%,32rem)">
  <sf-input-choice id="visuals" appearance="list" flow="column" multiple label="Видно в строке" items='${j(VISUALS)}'></sf-input-choice>
  <sf-input-choice id="local" appearance="list" flow="column" searchable label="Город" items='${j([{value: 'msk', label: 'Москва'}, {value: 'spb', label: 'Санкт-Петербург'}, {value: 'kzn', label: 'Казань'}, {value: 'ekb', label: 'Екатеринбург'}])}'></sf-input-choice>
  <sf-input-choice id="paged" appearance="list" flow="column" multiple searchable label="Сотрудники" value="u-120" items='${j([{value: 'u-120', label: 'Сотрудник 120'}])}'></sf-input-choice>
</main>`;

const rows = (tab, id) => tab.evaluate((id) => [...document.querySelectorAll(`#${id} .sf-choice-input`)].map((one) => one.value), id);
const status = (tab, id) => tab.evaluate((id) => {
  const line = document.querySelector(`#${id} .sf-choice-status`);
  const more = document.querySelector(`#${id} .sf-choice-more`);
  return {text: line && !line.hidden ? line.textContent.trim() : '', more: more ? (more.getAttribute('text') || more.textContent.trim()) : ''};
}, id);

for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const key = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 1200}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction(() => customElements.get('sf-input-choice') && document.querySelectorAll('#visuals .sf-choice-input').length === 6, null, {timeout: 20_000});
    // The host's source: 230 people, 50 a page, searched by name; a query «сбой» fails once.
    await tab.evaluate(() => {
      const people = Array.from({length: 230}, (_, index) => ({value: `u-${index + 1}`, label: `Сотрудник ${index + 1}`}));
      window.calls = [];
      let failed = false;
      document.getElementById('paged').provider = async (query, {cursor, limit, signal}) => {
        window.calls.push({query, cursor, limit});
        await new Promise((settle) => setTimeout(settle, query === 'медленно' ? 600 : 60));
        if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
        if (query === 'сбой' && !failed) {
          failed = true;
          throw new Error('offline');
        }
        const found = people.filter((one) => one.label.toLowerCase().includes(query.toLowerCase()));
        const at = Number(cursor ?? 0);
        return {items: found.slice(at, at + limit), nextCursor: at + limit < found.length ? String(at + limit) : null};
      };
    });
    await tab.waitForFunction(() => document.querySelectorAll('#paged .sf-choice-input').length > 1, null, {timeout: 20_000});
    await tab.waitForFunction(() => [...document.querySelectorAll('sf-avatar, sf-badge')].every((one) => one.firstElementChild), null, {timeout: 10_000}).catch(() => null);
    await tab.waitForTimeout(300);

    // The three visuals, each on the row's line.
    const visuals = await tab.evaluate(() => {
      const row = (value) => document.querySelector(`#visuals .sf-choice-input[value="${value}"]`).closest('.sf-choice-row, .sf-choice-card, label, li') ?? null;
      const line = (value) => {
        const box = row(value)?.querySelector('.sf-choice-input')?.getBoundingClientRect();
        return box ? box.top + box.height / 2 : 0;
      };
      const centre = (node) => {
        const box = node?.getBoundingClientRect();
        return box ? box.top + box.height / 2 : -100;
      };
      const avatarNode = row('anna')?.querySelector('sf-avatar.sf-choice-avatar');
      const swatch = row('red')?.querySelector('.sf-choice-swatch');
      const badge = row('new')?.querySelector('sf-badge.sf-choice-name-badge');
      return {
        avatar: Boolean(avatarNode), avatarOff: Math.abs(centre(avatarNode) - line('anna')),
        initials: Boolean(row('boris')?.querySelector('sf-avatar.sf-choice-avatar')),
        swatch: swatch ? getComputedStyle(swatch).backgroundColor : '', swatchOff: Math.abs(centre(swatch) - line('red')),
        swatchRound: swatch ? getComputedStyle(swatch).borderRadius : '',
        badge: badge ? {appearance: badge.getAttribute('appearance'), scheme: badge.getAttribute('scheme'), text: badge.textContent.trim() || badge.getAttribute('text')} : null,
        badgeOff: Math.abs(centre(badge) - line('new')),
      };
    });
    ok(`${key} visuals: an avatar before the name, on the row's line (an image and initials)`, visuals.avatar && visuals.initials && visuals.avatarOff < 2, visuals);
    ok(`${key} visuals: a colour circle before the name, on the row's line`, visuals.swatch === 'rgb(229, 57, 53)' && visuals.swatchOff < 2 && parseFloat(visuals.swatchRound) > 0, visuals);
    ok(`${key} visuals: the name as a tonal badge in its scheme, on the row's line`, visuals.badge?.appearance === 'tonal' && visuals.badge?.scheme === 'primary' && /Новая/u.test(visuals.badge?.text ?? '') && visuals.badgeOff < 2, visuals);

    // Search in hand.
    let changes = 0;
    await tab.exposeFunction('countChange', () => { changes += 1; });
    await tab.evaluate(() => document.getElementById('local').addEventListener('change', () => window.countChange()));
    await tab.locator('#local .sf-choice-search input').fill('САНКТ');
    await tab.waitForTimeout(250);
    const found = await rows(tab, 'local');
    ok(`${key} search in hand: case folded, the row kept`, found.length === 1 && found[0] === 'spb', found);
    await tab.locator('#local .sf-choice-search input').fill('Лондон');
    await tab.waitForTimeout(250);
    const none = {rows: await rows(tab, 'local'), ...(await status(tab, 'local'))};
    ok(`${key} search in hand: nothing found is said`, none.rows.length === 0 && /Ничего не найдено|не найден/iu.test(none.text), none);
    ok(`${key} search in hand: typing changes no value`, changes === 0, {changes});
    await tab.locator('#local .sf-choice-search input').fill('');

    // Host pages.
    const firstPage = {rows: await rows(tab, 'paged'), ...(await status(tab, 'paged')), calls: await tab.evaluate(() => window.calls.slice())};
    ok(`${key} pages: the first page, «Показать ещё» under it`, firstPage.rows.length === 51 && /Показать ещё/u.test(firstPage.more) && firstPage.calls[0]?.cursor === null && firstPage.calls[0]?.limit === 50, {...firstPage, rows: firstPage.rows.length});
    ok(`${key} pages: the chosen option the pages have not reached keeps its row`, firstPage.rows.includes('u-120'), firstPage.rows.slice(0, 3));
    await tab.click('#paged .sf-choice-more');
    await tab.waitForFunction(() => document.querySelectorAll('#paged .sf-choice-input').length >= 101, null, {timeout: 5000}).catch(() => null);
    const second = {rows: (await rows(tab, 'paged')).length, call: await tab.evaluate(() => window.calls.at(-1))};
    ok(`${key} pages: «Показать ещё» asks with the cursor and adds the page`, second.rows === 101 && second.call.cursor === '50', second);

    // A search: the older answer dropped, the newer drawn.
    await tab.locator('#paged .sf-choice-search input').fill('медленно');
    await tab.waitForTimeout(260);
    await tab.locator('#paged .sf-choice-search input').fill('Сотрудник 22');
    await tab.waitForTimeout(1000);
    const searched = {rows: await rows(tab, 'paged'), calls: await tab.evaluate(() => window.calls.map((one) => one.query))};
    ok(`${key} pages: a search asks the provider with the query; an older answer is dropped`, searched.rows.includes('u-22') && searched.rows.includes('u-220') && !searched.rows.includes('u-1') && searched.calls.includes('Сотрудник 22'), {rows: searched.rows, calls: searched.calls});

    // An error, then «Повторить».
    await tab.locator('#paged .sf-choice-search input').fill('сбой');
    await tab.waitForTimeout(600);
    const failed = await status(tab, 'paged');
    ok(`${key} pages: an error is said with «Повторить»`, /не удалось|ошибк/iu.test(failed.text) && /Повторить/u.test(failed.more), failed);
    await tab.click('#paged .sf-choice-more');
    await tab.waitForTimeout(500);
    const retried = {...(await status(tab, 'paged')), calls: await tab.evaluate(() => window.calls.filter((one) => one.query === 'сбой').length)};
    ok(`${key} pages: «Повторить» asks again`, retried.calls === 2 && !/Повторить/u.test(retried.more), retried);

    const sideways = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${key}: no sideways scroll`, sideways <= 0, {sideways});
    ok(`${key}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
}

await browser.close();
await server.close();
report();
