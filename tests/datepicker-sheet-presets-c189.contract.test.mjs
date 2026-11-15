import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

// Owner decision C189 (9) (2026-11-15, ui-control control/docs-review/
// decisions.md; recipe report-period): the quick periods of sf-input-date are
// in the phone's bottom sheet too. The sheet showed none of them (recipe gaps
// check 2026-11-15: 390 ribbon sheet, presets 0).

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the ribbon sheet draws the quick ranges between its head and the weekdays', () => {
  const template = read('src/smart/input-date/js/templates/ribbon.js');
  const head = template.indexOf('class="sf-datepicker-sheet-head"');
  const presets = template.indexOf('${renderRibbonPresets(context)}');
  const weekdays = template.indexOf('class="sf-datepicker-sheet-weekdays"');
  assert.ok(head > 0 && presets > head && weekdays > presets, 'head, presets, weekdays in this order');
  // The popup's list: one group named by the presets word, aria-pressed buttons, one tab stop,
  // the popup's keys, and «Свой период» after the ranges.
  assert.ok(template.includes('class="sf-datepicker-presets sf-datepicker-sheet-presets flex gap-1/4" role="group" aria-label=${context.labels.presets}'));
  assert.ok(template.includes('@keydown=${(event) => context.component.handlePresetKeydown(event)}'));
  assert.ok(template.includes("aria-pressed=${item.pressed ? 'true' : 'false'}"));
  assert.ok(template.includes("tabindex=${item === focusable ? '0' : '-1'}"));
  assert.ok(template.includes('@click=${() => context.component.pickRibbonPreset(item)}'));
  assert.ok(template.includes('@click=${() => context.component.pickRibbonCustomRange()}>${context.labels.customRange}'));
  assert.match(template, /if \(!items\.length\) return nothing;/u);
});

test('a range in the sheet is the value at once, as in the popup; the draft follows it', () => {
  const source = read('src/smart/input-date/index.js');
  // The popup's own choice: the value, one change, the close by close-on-select.
  assert.match(source, /pickRibbonPreset\(item\) \{\s*if \(!this\._ribbon\) return;\s*this\._choosePreset\(item\);\s*\}/u);
  assert.match(source, /if \(this\.closeOnSelect\) this\._closePanel\(\{restoreFocus: true\}\);\s*else if \(this\._sheetOpen\) this\.showRibbonPreset\(item\);/u);
  // The sheet opens with the pressed range of the value, and a day tapped lets it go.
  assert.match(source, /preset: this\.activePreset\?\.id \|\| '',/u);
  assert.match(source, /ribbon\.preset = '';\s*ribbon\.focus = value;/u);
  assert.match(source, /presetItems: this\.presetItems\.map\(\(item\) => \(\{\.\.\.item, pressed: Boolean\(ribbon\.preset\) && item\.id === ribbon\.preset\}\)\),/u);
  assert.match(source, /customPressed: !ribbon\.preset && Boolean\(ribbon\.start\),/u);
  // «Свой период» changes the draft only; the action acts on the sheet while it is open.
  assert.match(source, /pickRibbonCustomRange\(\) \{[\s\S]*?ribbon\.start = '';\s*ribbon\.end = '';\s*ribbon\.preset = '';[\s\S]*?this\.focusRibbonDay\(\);\s*\}/u);
  assert.match(source, /if \(this\._sheetOpen\) this\.pickRibbonCustomRange\(\);\s*else this\._chooseCustomRange\(\);/u);
  // The pressed range is scrolled into its row when the sheet shows.
  assert.match(source, /this\.showRibbonPressedPreset\(\);\s*this\.focusRibbonDay\(\);/u);
});

test('the sheet row is one line that scrolls sideways, 4 apart, a control of size 1/2 tall', () => {
  const css = read('src/component/datepicker/scss/_css_datepicker.scss');
  const rule = css.slice(css.indexOf('.sf-datepicker.sf-datepicker--sheet .sf-datepicker-sheet-presets {'));
  const body = rule.slice(0, rule.indexOf('}'));
  for (const line of ['flex: none;', 'flex-wrap: nowrap;', 'overflow-x: auto;', 'scrollbar-width: none;', 'touch-action: pan-x;',
    'margin-block-end: var(--sf-space-1\\/3);']) {
    assert.ok(body.includes(line), line);
  }
  const button = css.slice(css.indexOf('.sf-datepicker.sf-datepicker--sheet .sf-datepicker-sheet-presets .sf-datepicker-preset {'));
  assert.ok(button.slice(0, button.indexOf('}')).includes('min-block-size: var(--sf-ui-1\\/2--control-height);'));
});
