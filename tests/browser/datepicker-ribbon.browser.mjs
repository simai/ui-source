#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--loads=3]
// Owner decision C62 (2026-11-11) on the built bytes, ru, en-US and de, light
// and dark, at 1440 and 390, each page loaded --loads times (default 3):
// - days off: the ink is --sf-datepicker-day-off (red 40 light, red 80 dark),
//   not --sf-error by name; weekend="none" draws no day off, weekend="5,6"
//   Friday and Saturday;
// - a period is one field «с – по» with an en dash between spaces;
// - the field follows the locale: 03.09.2026 (ru, de), 09/03/2026 (en-US);
//   an empty field shows ДД.ММ.ГГГГ / MM/DD/YYYY / TT.MM.JJJJ; typing
//   09/03/2026 in en-US is September 3;
// - a read-only field opens nothing on a click, ArrowDown, Enter or Space;
// - at 390 a range opens a bottom sheet (sf-drawer placement=bottom) with a
//   ribbon of months: the weekday row stays put while the ribbon scrolls,
//   months stand one under another, two taps across a month border and
//   «Готово» make the value and one change; closing without «Готово» keeps
//   the old value; the keys cross the month border; at 1440 the popup opens.
// - with prefers-reduced-motion the sheet still opens and commits.
// Prints a JSON summary; exits 1 on a failure.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const out = process.argv[2] && resolve(process.argv[2]);
if (!out) throw new Error('Build output root is required');
const loads = Number((process.argv.find((arg) => arg.startsWith('--loads=')) || '--loads=3').split('=')[1]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/close/css/close.css', 'component/component/datepicker/css/datepicker.css',
  'smart/smart/input-date/css/input-date.css', 'smart/smart/drawer/css/drawer.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/input/js/input.js', 'smart/smart/drawer/js/drawer.js',
  'smart/smart/input-date/js/input-date.js'];
// A sheet a build does not make is skipped, as the typed-strict probe does; a script is required.
const absent = modules.filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`missing in the build: ${absent.join(', ')}`);

const failures = [];
const readings = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const LOCALES = {ru: {lang: 'ru', shown: '03.09.2026', hint: 'ДД.ММ.ГГГГ'}, 'en-US': {lang: 'en-US', shown: '09/03/2026', hint: 'MM/DD/YYYY'},
  de: {lang: 'de', shown: '03.09.2026', hint: 'TT.MM.JJJJ'}};

const browser = await chromium.launch();
try {
  for (const [locale, expect] of Object.entries(LOCALES)) {
    for (const theme of ['light', 'dark']) {
      for (const width of [1440, 390]) {
        for (const reduced of width === 390 ? [false, true] : [false]) {
          for (let load = 1; load <= loads; load += 1) {
            const context = await browser.newContext({viewport: {width, height: width === 390 ? 844 : 900},
              reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: theme});
            const page = await context.newPage();
            const view = `${locale} ${theme} ${width}${reduced ? ' reduced' : ''} #${load}`;
            const origin = 'http://probe.test';
            await page.route(`${origin}/**`, (route) => {
              const url = new URL(route.request().url());
              if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'});
              const path = join(out, url.pathname);
              return existsSync(path)
                ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
                : route.fulfill({status: 404, body: ''});
            });
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(`${origin}/`);
            await page.setContent(`<!doctype html><html lang="${expect.lang}" class="theme-${theme}"><head><meta charset="utf-8"></head><body style="margin:16px">
              <p><sf-input-date id="single" value="2026-09-03" label="Date"></sf-input-date></p>
              <p><sf-input-date id="empty" label="Date"></sf-input-date></p>
              <p><sf-input-date id="range" range start-value="2026-09-01" end-value="2026-09-07" label="Period"></sf-input-date></p>
              <p><sf-input-date id="locked" readonly value="2026-09-03" label="Date"></sf-input-date></p>
              <p><sf-input-date id="none" weekend="none" input="false" value="2026-09-03"></sf-input-date></p>
              <p><sf-input-date id="fri" weekend="5,6" input="false" value="2026-09-03"></sf-input-date></p>
            </body></html>`);
            for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
            for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
            await page.waitForFunction(() => customElements.get('sf-input-date') && customElements.get('sf-drawer')
              && document.querySelector('#single input') && document.querySelector('#range input') && document.querySelector('#none .sf-datepicker-day'), null, {timeout: 10000});
            await page.waitForTimeout(300);

            const fields = await page.evaluate(() => {
              const read = (id) => document.querySelector(`#${id} input`);
              const offInk = (id) => {
                const day = document.querySelector(`#${id} .sf-datepicker-day-off:not(.sf-datepicker-another-month) .sf-datepicker-day-date`);
                return day ? getComputedStyle(day).color : null;
              };
              const probe = document.createElement('span');
              document.body.append(probe);
              const ink = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
              const offDays = (id) => [...document.querySelectorAll(`#${id} .sf-datepicker-day-off:not(.sf-datepicker-another-month)`)]
                .map((day) => new Date(`${day.dataset.date}T00:00`).getDay());
              return {
                single: read('single').value, hint: read('empty').placeholder, range: read('range').value,
                lockedHasPopup: read('locked').hasAttribute('aria-haspopup'),
                dayOffInk: offInk('fri'), red: ink('light-dark(var(--sf-red-40), var(--sf-red-80))'),
                noneOff: offDays('none').length, friOff: [...new Set(offDays('fri'))].sort(),
              };
            });
            check(`${view}: single shown in the locale`, fields.single === expect.shown, fields);
            check(`${view}: empty hint in the locale`, fields.hint === expect.hint, fields);
            check(`${view}: range with an en dash`, /^\d\d[./]\d\d[./]2026 – \d\d[./]\d\d[./]2026$/u.test(fields.range), fields);
            check(`${view}: day-off ink is the palette red`, fields.dayOffInk === fields.red, fields);
            check(`${view}: weekend=none draws no day off`, fields.noneOff === 0, fields);
            check(`${view}: weekend=5,6 is Friday and Saturday`, JSON.stringify(fields.friOff) === '[5,6]', fields);
            check(`${view}: a read-only field names no popup`, fields.lockedHasPopup === false, fields);

            // Read-only: nothing opens.
            await page.click('#locked input');
            for (const key of ['ArrowDown', 'Enter', ' ']) await page.keyboard.press(key);
            await page.waitForTimeout(150);
            const lockedOpen = await page.evaluate(() => document.querySelector('#locked').open
              || Boolean(document.querySelector('#locked .sf-datepicker-container'))
              || [...document.querySelectorAll('[data-sf-drawer-root]')].some((root) => root.getAttribute('aria-hidden') === 'false'));
            check(`${view}: read-only opens nothing`, lockedOpen === false);

            // Typing in the locale's order (en-US: month first).
            if (locale === 'en-US') {
              await page.fill('#empty input', '09/03/2026');
              await page.press('#empty input', 'Enter');
              const typed = await page.evaluate(() => document.querySelector('#empty').value);
              check(`${view}: 09/03/2026 typed is September 3`, typed === '2026-09-03', {typed});
            }

            // The range.
            const changes = await page.evaluate(() => {
              window.__changes = [];
              document.querySelector('#range').addEventListener('change', (event) => window.__changes.push(event.detail.value));
            });
            void changes;
            await page.click('#range input');
            await page.waitForTimeout(width === 390 ? 700 : 300);
            if (width === 1440) {
              const popup = await page.evaluate(() => ({open: document.querySelector('#range').open,
                grid: Boolean(document.querySelector('#range .sf-datepicker-grid')), sheet: Boolean(document.querySelector('.sf-datepicker--sheet .sf-datepicker-ribbon'))}));
              check(`${view}: the popup opens on a wide screen`, popup.open && popup.grid && !popup.sheet, popup);
            } else {
              const sheet = await page.evaluate(() => {
                const body = document.querySelector('.sf-datepicker--sheet');
                const root = body?.closest('[data-sf-drawer-root]');
                const ribbon = body?.querySelector('.sf-datepicker-ribbon');
                const weekdays = body?.querySelector('.sf-datepicker-sheet-weekdays');
                const months = [...(ribbon?.querySelectorAll('.sf-datepicker-ribbon-month') || [])];
                const before = weekdays?.getBoundingClientRect().top;
                const firstTop = months[0]?.getBoundingClientRect().top;
                const secondTop = months[1]?.getBoundingClientRect().top;
                return {placement: root?.getAttribute('data-sf-drawer-placement'), open: root?.getAttribute('aria-hidden') === 'false',
                  months: months.length, stacked: secondTop > firstTop, weekdaysTop: before,
                  top: ribbon?.querySelector('.sf-datepicker-ribbon-month')?.dataset.month,
                  focused: document.activeElement?.dataset?.date || null,
                  foot: Boolean(body?.querySelector('.sf-datepicker-sheet-foot sf-button')),
                  cell: Math.round(body?.querySelector('.sf-datepicker-day')?.getBoundingClientRect().height || 0),
                  pageScroll: window.scrollY};
              });
              check(`${view}: a bottom sheet with a ribbon of months`, sheet.placement === 'bottom' && sheet.open && sheet.months >= 12 && sheet.stacked && sheet.foot, sheet);
              check(`${view}: the ribbon opens on the start, focused`, sheet.focused === '2026-09-01', sheet);
              // Scroll the ribbon: the weekday row stays where it is.
              const pinned = await page.evaluate(async () => {
                const body = document.querySelector('.sf-datepicker--sheet');
                const ribbon = body.querySelector('.sf-datepicker-ribbon');
                const weekdays = body.querySelector('.sf-datepicker-sheet-weekdays');
                const foot = body.querySelector('.sf-datepicker-sheet-foot');
                const at = [weekdays.getBoundingClientRect().top, foot.getBoundingClientRect().top];
                ribbon.scrollTop += 600;
                await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
                return {moved: ribbon.scrollTop > 0, same: weekdays.getBoundingClientRect().top === at[0] && foot.getBoundingClientRect().top === at[1]};
              });
              check(`${view}: weekdays and foot pinned while the ribbon scrolls`, pinned.moved && pinned.same, pinned);
              // Two taps across a month border and «Готово».
              await page.evaluate(() => document.querySelector('.sf-datepicker--sheet [data-date="2026-09-28"]').scrollIntoView({block: 'center'}));
              await page.click('.sf-datepicker--sheet [data-date="2026-09-28"]');
              await page.click('.sf-datepicker--sheet [data-date="2026-10-06"]');
              const summary = await page.evaluate(() => document.querySelector('.sf-datepicker-sheet-summary').textContent.trim().replace(/\s+/gu, ' '));
              await page.click('.sf-datepicker-sheet-done button');
              await page.waitForTimeout(500);
              const after = await page.evaluate(() => ({value: document.querySelector('#range').value, changes: window.__changes,
                open: [...document.querySelectorAll('[data-sf-drawer-root]')].some((root) => root.getAttribute('aria-hidden') === 'false'),
                field: document.querySelector('#range input').value}));
              check(`${view}: «Готово» makes the value and one change`, JSON.stringify(after.value) === '["2026-09-28","2026-10-06"]'
                && after.changes.length === 1 && !after.open, {...after, summary});
              // Open again, pick, close with Escape: the value stays.
              await page.click('#range input');
              await page.waitForTimeout(700);
              await page.keyboard.press('ArrowRight');
              await page.keyboard.press('PageDown');
              const keyed = await page.evaluate(() => document.activeElement?.dataset?.date || null);
              check(`${view}: keys cross the month border`, keyed === '2026-10-29', {keyed});
              await page.click(`.sf-datepicker--sheet [data-date="${keyed}"]`).catch(() => {});
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
              const kept = await page.evaluate(() => ({value: document.querySelector('#range').value, changes: window.__changes.length}));
              check(`${view}: closing without «Готово» keeps the value`, JSON.stringify(kept.value) === '["2026-09-28","2026-10-06"]' && kept.changes === 1, kept);
              readings.push({view, sheet, summary, after, keyed});
            }
            check(`${view}: no page errors`, errors.length === 0, {errors});
            await context.close();
          }
        }
      }
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({failures, readings: readings.slice(0, 6)}, null, 2));
if (failures.length) process.exit(1);
