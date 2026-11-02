# Shared display helpers: `SF.format`, `SF.breakpoints`, `SF.copyText`, initials

What more than one set of components needs is one shared part (owner's rule;
reuse audit 2026-11-02, findings 6, 7, 10 and 11). Dates, days, numbers and
file sizes, the breakpoint ladder in script, copying text and initials had been
written again in the Framework's components, in the Pro components and in the
charts, and the copies disagreed. Core publishes the helpers as soon as
`core.js` has run (`loaded_by: core` in `src/core/contracts/public-js-api.json`).

A component in this repository or in a package built on it imports the module
(`core/js/format.js`, `core/js/breakpoints.js`, `core/js/clipboard.js`,
`smart/helpers/text.js`); a page script uses the globals. The modules hold no
state of their own: the Intl formatters are kept on one global every bundle's
copy shares, and each publishes itself on `SF` only when nothing is there yet.

## `SF.format` (`core/js/format.js`)

Every function takes `{locale, node}`. The locale is `locale` when given, else
the page language of `node` (the nearest `[lang]` above it, the page's choice,
`<html lang>`, English; `page-language.js pageLocale`). A component passes
`{node: this}`; a fixed `ru-RU` is never right.

```js
const {format} = window.SF;

format.date(at, {node});                          // 3 нояб. 2026 г.   Nov 3, 2026
format.date(at, {node, date: 'short'});           // 03.11.2026        11/3/26
format.date(at, {node, date: 'long', time: 'short'}); // 3 ноября 2026 г. в 14:05
format.date(at, {node, date: null, time: 'short'});   // 14:05           2:05 PM
format.date(at, {node, intl: {hour: '2-digit', minute: '2-digit'}}); // Intl options outright

format.relativeDay(at, {node});                   // сегодня, вчера, завтра, пятница, 27 октября, 5 января 2025 г.
format.relativeDay(at, {node, capital: true, weekday: false}); // Вчера, then the date
format.relativeTime(at, {node});                  // 5 минут назад     5 minutes ago
format.dayOffset(at);                             // 0 today, -1 yesterday (calendar days)
format.msUntilNextDay();                          // ms to the reader's next midnight

format.number(1234.5, 'number', {node});          // 1 234,5           1,234.5
format.number(1234.5, 'integer', {node});         // 1 235
format.number(1234.5, 'decimal-2', {node});       // 1 234,50
format.number(0.123, 'percent', {node});          // 12,3 %            12.3%
format.number(1234, 'compact', {node});           // 1,2 тыс.          1.2K
format.number(1234.5, 'currency-RUB', {node});    // 1 234,50 ₽
format.number(45.3, 'unit-gigabyte', {node});     // 45,3 ГБ
format.number(2026, 'integer', {node, grouping: false}); // 2026

format.fileSize(1468006, {node});                 // 1,4 МБ            1.4 MB
format.fileSize(size, {node, units: ['bytes', 'KB', 'MB', 'GB']}); // a component's own words
```

- **Anything that is not a value** (no date, `NaN`, `null`) is `gap`, `''` by
  default; a chart passes `'—'`.
- **Relative days** count calendar days in the reader's time zone, not 24-hour
  spans: 23:59 yesterday is «вчера» at 00:01, and a day of a clock change is one
  day. Within the last week the weekday is said (`weekday: false` skips it);
  older dates carry the year when it is not this one. The words are the
  platform's (`Intl.RelativeTimeFormat`, numeric auto); a component that ships
  its own passes `today`, `yesterday`, `tomorrow`, and they win.
- **The day changes at midnight.** A component that shows relative days sets a
  timer for `msUntilNextDay()` plus a second's margin and draws them again,
  then sets the next one:

  ```js
  watchDay() {
    clearTimeout(this._dayTimer);
    this._dayTimer = setTimeout(() => { this.requestComponentUpdate('day'); this.watchDay(); },
      SF.format.msUntilNextDay() + 1000);
  }
  ```

- **Number words** are the chart's (`numberOptions(format, step)` returns the
  Intl options): `number` takes as many digits as `step` needs, at most six, two
  without one; `decimal-<n>` always shows `n` (0 to 20); an unknown word reads
  as `number`, an unknown currency or unit as a plain number.
- **File sizes** step by 1024 through B, KB, MB, GB (Б, КБ, МБ, ГБ in Russian;
  English words for any other language), one digit under ten of a unit and
  none above it or in bytes. Text a host already formatted is returned as it
  came. The positional form `formatFileSize(size, units, locale)` of
  `composition/file-size.mjs` still works.

## `SF.breakpoints` (`core/js/breakpoints.js`)

The steps of `core/scss/vars/_sf_var__breakpoint.scss`, in rem as the sheets
write them; `tests/breakpoint-ladder.contract.test.mjs` holds the two equal.

```js
SF.breakpoints.ladder;                       // {xs: '0rem', sm: '32rem', md: '44rem', lg: '60rem', xl: '72rem', xxl: '80rem'}
SF.breakpoints.query('lg');                  // (min-width: 60rem)
SF.breakpoints.query('md', {below: true});   // (max-width: 43.9375rem), the sheets' breakpoint-max
SF.breakpoints.matches('lg');                // is the page that wide now
const media = SF.breakpoints.media('lg');    // a MediaQueryList to follow
media?.addEventListener('change', redraw);
```

An unknown name gives `null` (no query that always matches). A component whose
threshold is deliberately not a step of the ladder -- sf-drawer's dock width,
which the page sets -- keeps its own.

## `SF.copyText` (`core/js/clipboard.js`)

```js
try {
  const how = await SF.copyText(text, {document: element.ownerDocument}); // 'native' | 'legacy'
} catch (error) {
  // 'copy_unsupported', or the platform's NotAllowedError / SecurityError:
  // select the text and tell the person to press Ctrl+C (sf-copy-button does).
}
```

The Clipboard API on a secure page; where it is absent or refused (a policy, an
embedded frame), `execCommand('copy')` over a hidden read-only field that is
removed again. `SF.Clipboard`, with a capital C, is the clipboard class
component's script API, not this function.

## Initials (`smart/helpers/text.js getInitials`)

The rule sf-avatar and the context menu draw by: the first letters of the first
two words, skipping a preposition after the first word («Отдел по работе» →
ОР); one hyphenated word reads as its parts («Жан-Поль» → ЖП), a name of
several words by its words («Анна-Мария Смирнова» → АС); a letter is a whole
grapheme (surrogate pairs and combining accents kept). An empty name is `''`,
or `{fallback: '?'}` where text must stand; `{maxLetters, skipWords, locale}`
adjust the rest.
