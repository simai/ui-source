import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

// sf-input-date's wrapper is inline-flex: on its parent's text baseline its
// height followed the calendar icon, held at font-size 0 until the icon font
// arrives, so the field was 1 px taller held than loaded -- ui-view view-flow
// «ask» at 390, 339 -> 338 on first paint (2026-11-11, the waiver
// msg-779b2aee). Top-aligned in the field's class sheet (7c27981e3), the line
// box does not depend on the icon. Measured frame by frame on group build 7
// (2026-11-15): view-flow ask holds 338 from the first frame with the icon
// font held past the code; forced back to the baseline, it moves 339 -> 338.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the wrapper stays top-aligned, so its height never follows the held icon (view-flow ask, 2026-11-11)', () => {
  const css = read('src/component/datepicker/scss/_css_datepicker.scss');
  assert.match(css, /\.sf-datepicker-wrap \{\s*vertical-align: top;\s*\}/u);
  const template = read('src/smart/input-date/js/templates/default.js');
  assert.ok(template.includes("joinClasses('sf-datepicker-wrap',"), 'the wrapper is the field root the rule names');
  // C293 DF-7: the wrapper is a block flex column now (it takes the row, as sf-input does), so it
  // stands on no text baseline at all; the top alignment stays for a host that makes it inline.
  assert.match(css, /\.sf-datepicker-wrap \{\n {4}display: flex;\n {4}flex-direction: column;\n {4}position: relative;\n {2}\}/u);
});
