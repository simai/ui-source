import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';
import {formatPlaceholder, localeDateFormat, localeWeekStart, localeWeekend, weekendDays} from '../src/smart/input-date/js/locale-calendar.js';

// Owner decision C62 (2026-11-11, ui-control control/docs-review/decisions.md):
// the calendar and the date field. Each point of the gap analysis
// (control/evidence/2026-11-11-datepicker-c62-gap) has its checks here.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sorted = (set) => [...set].sort((a, b) => a - b);

// Point 2: days off are the locale's, and a product with working weekends
// says so. They were Saturday and Sunday for every locale.
test('the days off follow the locale', () => {
  assert.deepEqual([...localeWeekend('ru')].sort(), [0, 6]);
  assert.deepEqual([...localeWeekend('de')].sort(), [0, 6]);
  assert.deepEqual([...localeWeekend('en-US')].sort(), [0, 6]);
  assert.deepEqual([...localeWeekend('ar-EG')].sort(), [5, 6]);
  // A locale Intl refuses keeps Saturday and Sunday.
  assert.deepEqual([...localeWeekend('not a locale')].sort(), [0, 6]);
  assert.equal(localeWeekStart('ru'), 1);
  assert.equal(localeWeekStart('en-US'), 0);
  assert.equal(localeWeekStart('not a locale'), 1);
});

test('the weekend setting: empty, none, or a list of days', () => {
  assert.deepEqual(sorted(weekendDays('', 'ru')), [0, 6]);
  assert.deepEqual(sorted(weekendDays('', 'ar-EG')), [5, 6]);
  assert.deepEqual(sorted(weekendDays('none', 'ru')), []);
  assert.deepEqual(sorted(weekendDays(' None ', 'ru')), []);
  // Intl's numbering (7 Sunday) and Date#getDay's (0 Sunday) both read.
  assert.deepEqual(sorted(weekendDays('6,7', 'ar-EG')), [0, 6]);
  assert.deepEqual(sorted(weekendDays('6 0', 'ar-EG')), [0, 6]);
  assert.deepEqual(sorted(weekendDays('5,6', 'ru')), [5, 6]);
  assert.deepEqual(sorted(weekendDays('0', 'ru')), [0]);
  // What is not a day is left out; nothing left is the locale's.
  assert.deepEqual(sorted(weekendDays('6,8,x', 'ru')), [6]);
  assert.deepEqual(sorted(weekendDays('8,x', 'ar-EG')), [5, 6]);
});

test('the grid reads the days off from the setting, not a fixed pair', () => {
  const source = read('src/smart/input-date/index.js');
  assert.doesNotMatch(source, /\[0, 6\]\.includes/u, 'Saturday and Sunday are no longer hard-coded');
  assert.match(source, /const daysOff = this\.weekendDays;/u);
  assert.match(source, /const weekend = daysOff\.has\(date\.getDay\(\)\);/u);
  assert.match(source, /label: weekend\s*\?\s*`\$\{getDateLabel\(date, this\.locale\)\}, \$\{this\.sfWord\('day-off'\)\}`/u);
  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  assert.equal(manifest.settings.weekend.type, 'string');
  assert.equal(manifest.settings.weekend.default, '');
  assert.match(manifest.settings.weekend.summary, /none/u);
});

// Point 3: a period is one field «с – по»; two fields are a recipe.
test('a period is one field with an en dash between spaces', () => {
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /const RANGE_SEPARATOR = ' \\u2013 ';/u);
  assert.match(source, /return `\$\{this\.formattedStartValue\}\$\{RANGE_SEPARATOR\}\$\{this\.formattedEndValue\}`;/u);
  assert.match(source, /mask \+= `\$\{RANGE_SEPARATOR\}\$\{mask\}`;/u);
  assert.doesNotMatch(source, /\$\{this\.formattedStartValue\} - \$\{this\.formattedEndValue\}/u, 'no hyphen between the dates');
  const snapshot = read('src/smart/input-date/static/default/range.html');
  assert.ok(snapshot.includes('value="01.09.2026 – 07.09.2026"'));
  assert.ok(!snapshot.includes('2026 - '));
  const guide = read('src/smart/input-date/docs/smart-datepicker-guide.md');
  assert.ok(guide.includes('## A period: one field, or two as a recipe'));
  assert.ok(guide.includes('id="check-in"') && guide.includes('id="check-out"'));
  assert.ok(guide.includes("checkOut.setAttribute('min-date', start)"));
});

// Point 4: typing follows the locale -- the parts' order and the signs from
// Intl formatToParts, not a fixed DD.MM.YYYY.
test('the date format is the locale\'s order and signs', () => {
  assert.equal(localeDateFormat('ru'), 'DD.MM.YYYY');
  assert.equal(localeDateFormat('ru-RU'), 'DD.MM.YYYY');
  assert.equal(localeDateFormat('de'), 'DD.MM.YYYY');
  assert.equal(localeDateFormat('en-US'), 'MM/DD/YYYY');
  assert.equal(localeDateFormat('en-GB'), 'DD/MM/YYYY');
  assert.equal(localeDateFormat('fr'), 'DD/MM/YYYY');
  assert.equal(localeDateFormat('sv-SE'), 'YYYY-MM-DD');
  assert.equal(localeDateFormat('en-CA'), 'YYYY-MM-DD');
  // A sign after the last part is not typed: «12.11.2026 г.», «2026. 11. 12.».
  assert.equal(localeDateFormat('bg'), 'DD.MM.YYYY');
  assert.equal(localeDateFormat('hu'), 'YYYY. MM. DD');
  // Right-to-left marks are not signs.
  assert.equal(localeDateFormat('ar-EG'), 'DD/MM/YYYY');
  assert.equal(localeDateFormat('not a locale'), 'DD.MM.YYYY');
});

test('the hint is the format in the locale\'s letters', () => {
  assert.equal(formatPlaceholder('DD.MM.YYYY', 'ru'), 'ДД.ММ.ГГГГ');
  assert.equal(formatPlaceholder('MM/DD/YYYY', 'en-US'), 'MM/DD/YYYY');
  assert.equal(formatPlaceholder('DD.MM.YYYY', 'de'), 'TT.MM.JJJJ');
  assert.equal(formatPlaceholder('DD/MM/YYYY', 'fr'), 'JJ/MM/AAAA');
  assert.equal(formatPlaceholder('DD.MM.YYYY HH:mm', 'ru'), 'ДД.ММ.ГГГГ ЧЧ:ММ');
  assert.equal(formatPlaceholder('HH:mm', 'en-US'), 'HH:MM');
  // A script without initials gives the Latin letters.
  assert.equal(formatPlaceholder('YYYY/MM/DD', 'ja'), 'YYYY/MM/DD');
});

test('the field takes the locale\'s format, its mask and its hint where no host sets them', () => {
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /if \(mode === 'date'\) return written \|\| localeDateFormat\(this\.locale\);/u);
  assert.match(source, /: localeDateFormat\(this\.locale\)\} HH:mm`;/u);
  assert.doesNotMatch(source, /return written \|\| 'DD\.MM\.YYYY';/u);
  assert.match(source, /format: \{default: ''\},/u);
  assert.match(source, /get maskPattern\(\) \{\s*return this\.getAttribute\('mask-pattern'\) \|\| this\.formatToMask\(this\.format\);/u);
  assert.match(source, /if \(written \|\| !this\.typed\) return written;\s*return formatPlaceholder\(this\.format, this\.locale\);/u);
  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  assert.equal(manifest.settings.format.default, '');
  assert.equal(manifest.settings['mask-pattern'].default, '');
  assert.match(manifest.settings.format.summary, /formatToParts/u);
});

// Point 5: a read-only field does not open the calendar. `readonly` also
// counts a range (not typed), which still opens; the host's attribute locks.
test('a read-only field opens no calendar and an inline one takes no choice', () => {
  const source = read('src/smart/input-date/index.js');
  assert.match(source, /get valueLocked\(\) \{\s*return this\.getBooleanAttr\('readonly', false\);/u);
  assert.match(source, /_openPanel\(\{focusCalendar = false\} = \{\}\) \{\s*if \(this\.disabled \|\| this\.valueLocked\) return this;/u);
  assert.match(source, /'open-panel'\(\{options\} = \{\}\) \{\s*if \(this\.disabled\) return 'disabled';\s*if \(this\.valueLocked\) return 'readonly';/u);
  assert.match(source, /const open = this\.open \|\| this\._sheetOpen;\s*if \(!open && this\.disabled\) return 'disabled';\s*if \(!open && this\.valueLocked\) return 'readonly';/u);
  assert.match(source, /return this\.getBooleanAttr\('open', false\) && !\(this\.input && this\.valueLocked\);/u);
  assert.match(source, /if \(this\.disabled \|\| this\.valueLocked \|\| !day\?\.date \|\| day\.disabled\)/u);
  assert.match(source, /if \(this\.disabled \|\| this\.valueLocked \|\| !item \|\| item\.disabled\) return this;/u);
  assert.match(source, /stepTime\(part, direction = 1\) \{\s*if \(this\.disabled \|\| this\.valueLocked\) return this;/u);
  assert.match(source, /setTime\(minutes\) \{\s*if \(this\.disabled \|\| this\.valueLocked\) return this;/u);
  assert.match(source, /if \(this\._input && this\.valueLocked\) \{\s*for \(const name of \['aria-haspopup', 'aria-expanded', 'aria-controls'\]\) this\._input\.removeAttribute\(name\);/u);
  // A range is not locked by being a range.
  assert.match(source, /get readonly\(\) \{\s*return this\.range \|\| this\.getBooleanAttr\('readonly', false\);/u);
  const template = read('src/smart/input-date/js/templates/default.js');
  assert.ok(template.includes("aria-readonly=${context.valueLocked ? 'true' : nothing}"));
  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  assert.match(manifest.settings.readonly.summary, /opens no calendar/u);
});

// Point 6: on a phone a period opens a ribbon of months in the Framework's
// bottom sheet, a draft until «Готово».
test('a period on a phone opens a ribbon of months in the bottom sheet', () => {
  const source = read('src/smart/input-date/index.js');
  // Below the breakpoint lg (60rem), read from core/js/breakpoints.js, not a raw length (C18).
  assert.match(source, /import \{matchesBreakpoint\} from '\.\.\/\.\.\/core\/js\/breakpoints\.js';/u);
  assert.match(source, /if \(!this\.range \|\| !this\.input \|\| this\._ribbonUnavailable\) return false;\s*return matchesBreakpoint\('lg', \{below: true\}\);/u);
  assert.match(source, /await globalThis\.SF\?\.Loader\?\.ensure\?\.\(\['sf-drawer'\]\)/u);
  assert.match(source, /sheet\.setAttribute\('placement', 'bottom'\);/u);
  assert.match(source, /body\.className = 'sf-datepicker sf-datepicker--sheet';/u);
  // No drawer on the page: the popup.
  assert.match(source, /this\._ribbonUnavailable = true;\s*this\._openPanel\(\);/u);
  // The value changes on «Готово» only, once.
  assert.match(source, /commitRibbon\(\) \{\s*const ribbon = this\._ribbon;\s*if \(!ribbon\?\.start \|\| !ribbon\.end\) return;/u);
  assert.match(source, /this\.emitChange\(\);\s*this\._sheet\?\.close\?\.\(\{reason: 'close'\}\);/u);
  // The window grows only after the anchor month stands at the top.
  assert.match(source, /if \(!scroller \|\| !ribbon \|\| !ribbon\.shown \|\| this\._ribbonGrowing\) return;/u);
  assert.doesNotMatch(source, /__ribbonLog/u);

  const template = read('src/smart/input-date/js/templates/ribbon.js');
  assert.ok(template.includes('class="sf-datepicker-sheet-weekdays"'));
  assert.ok(template.includes('class="sf-datepicker-ribbon-title"'));
  assert.ok(template.includes('class="sf-datepicker-sheet-summary" aria-live="polite"'));
  assert.ok(template.includes('text=${context.labels.done} ?disabled=${!context.complete}'));

  const scss = read('src/component/datepicker/scss/_css_datepicker.scss');
  assert.ok(scss.includes('.sf-datepicker--sheet'));
  assert.ok(scss.includes('overflow-anchor: none;'));

  const manifest = JSON.parse(read('src/smart/input-date/component.json'));
  const drawer = manifest.relations.find((relation) => relation.name === 'cl-drawer');
  assert.equal(drawer?.lazy, true);
  for (const lang of ['ru', 'en']) {
    const words = JSON.parse(read(`src/smart/input-date/lang/${lang}.json`));
    for (const word of ['period', 'done', 'choose-start', 'choose-end']) assert.ok(JSON.stringify(words).includes(`"${word}"`), `${lang}: ${word}`);
  }
  const guide = read('src/smart/input-date/docs/smart-datepicker-guide.md');
  assert.ok(guide.includes('## A period on a phone: a ribbon of months'));
});

// The ribbon as agreed in #lenta (intent acceptance 2026-11-12, D1-D5).
test('the phone ribbon matches #lenta: one surface, focus, height, «К сегодня», red weekend headers', () => {
  const source = read('src/smart/input-date/index.js');
  const template = read('src/smart/input-date/js/templates/ribbon.js');
  const popup = read('src/smart/input-date/js/templates/default.js');
  const scss = read('src/component/datepicker/scss/_css_datepicker.scss');
  // D1: the box takes the panel's place colour, not the nested popup role read inside it.
  assert.match(scss, /--sf-surface-place: inherit;\s*--sf-surface-place-solid: inherit;\s*--sf-surface-place-ground: inherit;\s*--sf-datepicker--background-color: var\(--sf-surface-place, var\(--sf-surface-popup\)\);/u);
  assert.doesNotMatch(scss, /--sf-drawer-background/u);
  // D2: no frame-count limit; the ribbon waits for its size, and the panel's focus goes on to the day.
  assert.doesNotMatch(source, /tries < 30/u);
  assert.match(source, /waitForRibbonSize\(scroller\)/u);
  assert.match(source, /document\.addEventListener\('focusin', this\._ribbonPanelFocus, true\);/u);
  assert.match(source, /this\.stopRibbonPanelFocus\(\);/u);
  // D3: the sheet rests at its content's height under the field.
  assert.doesNotMatch(source, /setAttribute\('snap', 'full'\)/u);
  assert.match(source, /sheet\.setAttribute\('panel-style', this\.ribbonSheetStyle\(\)\);/u);
  assert.match(source, /max-block-size: max\(50%, calc\(100% - \$\{top\}px - var\(--sf-space-1\)\)\);/u);
  // D4: the ribbon's own head with «К сегодня» and the close button.
  assert.match(source, /sheet\.setAttribute\('show-close', 'false'\);/u);
  assert.ok(template.includes('class="sf-datepicker-sheet-today"'));
  assert.ok(template.includes('@click=${() => context.component.ribbonToToday()}'));
  assert.ok(template.includes('@click=${() => context.component.closeRibbon()}'));
  for (const lang of ['ru', 'en']) {
    const words = JSON.parse(read(`src/smart/input-date/lang/${lang}.json`)).runtime;
    for (const word of ['go-to-today', 'close']) assert.ok(words[word], `${lang}: ${word}`);
  }
  // D5: the weekday headers of the days off take the day-off ink, popup and ribbon.
  assert.ok(template.includes("context.weekdaysOff[at] && 'sf-datepicker-weekday-off'"));
  assert.ok(popup.includes("context.weekdaysOff?.[at] ? 'sf-datepicker-weekday sf-datepicker-weekday-off'"));
  assert.match(scss, /\.sf-datepicker-weekday\.sf-datepicker-weekday-off \{\s*--sf-datepicker-weekday--color: var\(--sf-datepicker--day-off-color\);/u);
});
