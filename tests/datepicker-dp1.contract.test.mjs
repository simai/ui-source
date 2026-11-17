// RG-DP-1..6 (2026-11-16, DEV msg-5241318c; study forms-datepicker-study.html
// on pair 5.20261115.1622; owner decision C62). The calendar drew no mark for
// today, kept a day off's red on the primary fill of a period's end when the
// markup did not also say active (1.01:1), drew the focus colour on a chosen
// day's primary fill (1.44:1 light, 1.31:1 dark), sized the popup as seven days
// plus --sf-space-1 while its paddings are two --sf-space-1/3 (a day 35.4 on a
// phone, 32.6 compact), drew sf-input-date's period field as a read-only one,
// and named its popup dialog by the shown month without aria-modal. This test
// holds the fix in the source and, when the gate names a build
// (UI_CORE_ROOT=<ui root>, distr/ beside), in the built sheet too.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// The builder writes [aria-current=date] and splits :is() lists; both forms read alike.
const flat = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\[aria-current=date\]/gu, '[aria-current="date"]').replace(/\s+/gu, ' ').replace(/\s*([{}:;,>])\s*/gu, '$1');

// Every rule as [selectors, declarations], at-rule wrappers dropped.
function rules(css) {
  const out = [];
  for (const match of flat(css).matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    // C273: a block opens with `@include paint.part(shape);`, which is no selector (group build 10).
    const head = match[1].replace(/^.*@(?:layer|media)[^{]*$/u, '').replace(/^[^]*;/u, '').trim();
    out.push([head, match[2]]);
  }
  return out;
}
const ruleFor = (css, test) => rules(css).filter(([head]) => test(head)).map(([, body]) => body).join(';');

const sheet = [
  read('src/component/datepicker/scss/_css_day.scss'),
  read('src/component/datepicker/scss/_css_datepicker_custom.scss'),
  read('src/component/datepicker/scss/_css_datepicker.scss'),
].join('\n');

const builtSheet = (() => {
  const root = process.env.UI_CORE_ROOT;
  if (!root) return null;
  const dir = join(resolve(root), 'distr/component/datepicker/css');
  const name = existsSync(dir) && readdirSync(dir).find((file) => /^datepicker(\.min)?\.css$/u.test(file));
  assert.ok(name, `built datepicker sheet under ${dir}`);
  return readFileSync(join(dir, name), 'utf8');
})();

function checkSheet(css, where) {
  // RG-DP-4: seven days of the control height and the two paddings.
  const width = ruleFor(css, (head) => head === '.sf-datepicker');
  assert.match(width, /--sf-datepicker--inline-size:calc\(var\(--sf-datepicker-day--height,var\(--sf-ui-1--control-height\)\)\s?\*\s?7\s?\+\s?var\(--sf-datepicker--padding-left,var\(--sf-space-1\\\/3\)\)\s?\+\s?var\(--sf-datepicker--padding-right,var\(--sf-space-1\\\/3\)\)\)/u, `${where}: popup width is 7 days + 2 paddings`);
  assert.doesNotMatch(width, /\*\s?7\s?\+\s?var\(--sf-space-1\)/u, `${where}: no --sf-space-1 added to the grid`);

  // RG-DP-1: today, by aria-current or the class: ring inside and the number in primary.
  const marks = ['[aria-current="date"]', '.sf-datepicker-day-today'];
  const isToday = (head) => marks.some((mark) => head.includes(`.sf-datepicker-day${mark.startsWith('[') ? '' : '.'}${mark.startsWith('[') ? mark : mark.slice(1)}`) || head.includes(`:is(.sf-datepicker-day-today,[aria-current="date"])`));
  for (const mark of marks) {
    const own = (head) => isToday(head) && head.includes(mark);
    const ring = ruleFor(css, (head) => own(head) && !head.endsWith('.sf-datepicker-day-date'));
    assert.match(ring, /box-shadow:inset 0 0 0 var\(--sf-px\) var\(--sf-primary\)/u, `${where}: today's ring (${mark})`);
    const number = ruleFor(css, (head) => own(head) && head.endsWith('.sf-datepicker-day-date'));
    assert.match(number, /--sf-datepicker-day-date--color:var\(--sf-primary\)/u, `${where}: today's number (${mark})`);
  }
  for (const head of rules(css).map(([one]) => one).filter(isToday)) {
    for (const chosen of [':not(.active)', ':not(.sf-datepicker-day-start)', ':not(.sf-datepicker-day-end)']) {
      assert.ok(head.includes(chosen), `${where}: a chosen day keeps its fill (${chosen})`);
    }
  }

  // RG-DP-2: no day-off or neighbouring-month ink on a period's end.
  const inks = rules(css).filter(([head, body]) => /--sf-datepicker-day-(date|info)--color/u.test(body)
    && /sf-datepicker-(day-off|another-month)/u.test(head));
  assert.ok(inks.length >= 4, `${where}: the day-off and neighbouring-month inks`);
  for (const [head] of inks) {
    assert.ok(head.includes(':not(.sf-datepicker-day-start):not(.sf-datepicker-day-end)'), `${where}: ${head} spares a period's ends`);
  }

  // RG-DP-3: the focus on a chosen day is the fill's ink, one ring width further in.
  // (The builder splits the :is() list and adds a .focus-visible twin.)
  for (const chosen of ['.active', '.sf-datepicker-day-start', '.sf-datepicker-day-end']) {
    const focus = ruleFor(css, (head) => head.startsWith('.sf-datepicker-day') && head.includes(chosen) && head.includes(':focus-visible') && !head.includes('forced'));
    assert.match(focus, /outline-color:var\(--sf-datepicker-selected-color,var\(--sf-on-primary\)\)/u, `${where}: focus ink on a chosen day (${chosen})`);
    assert.match(focus, /outline-offset:calc\(var\(--sf-focus--width\)\s?\*\s?-2\)/u, `${where}: focus ring inside the fill (${chosen})`);
  }
}

test('the class sheet marks today, spares period ends, rings chosen days and sizes the popup on the ladder', () => {
  checkSheet(sheet, 'source');
  if (builtSheet) checkSheet(builtSheet, 'build');
});

test('sf-input-date draws a period as an ordinary field and names its popup by the field', () => {
  const source = read('src/smart/input-date/index.js');
  const template = read('src/smart/input-date/js/templates/default.js');
  // RG-DP-5: only a locked value makes the text box read-only; a range is pickOnly.
  assert.ok(source.includes('readonly: this.valueLocked,'), 'the text box is read-only only when locked');
  assert.match(source, /get pickOnly\(\) \{\s*return !this\.typed && !this\.valueLocked && !this\.disabled;/u);
  assert.match(source, /handleInputBeforeInput\(event\) \{\s*if \(this\.pickOnly\) event\?\.preventDefault\?\.\(\);/u);
  assert.ok(template.includes("inputmode=${context.pickOnly ? 'none' : nothing}"));
  assert.ok(template.includes('@beforeinput=${(event) => context.component.handleInputBeforeInput(event)}'));
  // RG-DP-6: the popup dialog is named by the field and is modal.
  assert.match(source, /get dialogLabel\(\) \{\s*if \(this\.label \|\| this\.ariaLabel\) return this\.label \|\| this\.ariaLabel;/u);
  assert.equal(template.split("aria-modal=${context.input ? 'true' : nothing}").length - 1, 2, 'both popups say aria-modal');
  assert.ok(template.includes('aria-label=${context.input ? context.dialogLabel : context.calendarLabel}'));
  assert.ok(template.includes('aria-label=${context.input ? context.dialogLabel : context.labels.time}'));
  assert.ok(!template.includes("role=${context.input ? 'dialog' : 'group'} aria-label=${context.calendarLabel}"));
});
