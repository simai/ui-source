import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// In forced colours the selected segment of a segmented sf-button-group is the
// system Highlight with HighlightText. The scheme plates set the segment's
// colour with three classes (`.sf-button-group--segmented.sf-button-group--primary
// > .sf-button-group-segment.active`), so a forced rule with two lost to them
// and put the theme's ink on Highlight: black on navy in a light forced palette
// (simai/ui-source#33, found by ui-mail's axe gate). Measured in Chrome with
// forced colours emulated: white on Highlight for every scheme once the forced
// rule is as strong as the plates.
const sheet = fs.readFileSync(new URL('../src/component/button-group/scss/_css__button-group.scss', import.meta.url), 'utf8');
const forced = sheet.slice(sheet.lastIndexOf('@media (forced-colors: active)'));

test('the forced selected segment is at least as specific as every scheme plate', () => {
  const rule = forced.match(/([^{}]*)\{\s*forced-color-adjust: none;\s*background-color: Highlight;\s*color: HighlightText;/u);
  assert.ok(rule, 'the forced rule paints Highlight and HighlightText');
  const selector = rule[1].trim().split('\n').pop().trim();
  for (const scheme of ['primary', 'secondary', 'on-surface', 'plate-raised']) {
    assert.ok(sheet.includes(`.sf-button-group--segmented.sf-button-group--${scheme} > .sf-button-group-segment.active`), `the ${scheme} plate exists`);
    assert.ok(selector.includes(`.sf-button-group--${scheme}`), `the forced rule names the ${scheme} plate inside :is()`);
  }
  assert.match(selector, /^\.sf-button-group--segmented:is\(/u);
});
