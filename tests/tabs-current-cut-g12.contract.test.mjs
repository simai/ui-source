import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Group build 16 G12 (view record study VRS-2): a tab is at most as wide as its
// row, so the row is laid out with each tab's own width -- its box plus the
// part of its label it cuts. A current tab wider than a narrow row then does
// not fit and is the shortened one with an ellipsis (sf-tabs-squeezed), never
// a tab at the row's width with its label cut hard.
test('G12: the row is fitted with the tabs\' own widths, cut labels included', () => {
  const source = read('src/smart/tabs/index.js');
  assert.match(source, /const cut = \(host\) => \{[\s\S]*?text\.scrollWidth - text\.clientWidth/u);
  assert.match(source, /const own = widths\.map\(\(value, at\) => value \+ cut\(hosts\[at\]\)\);/u);
  assert.match(source, /let kept = fitInOrder\(own, gap, room\(\)\);/u);
  assert.match(source, /fitBesideMore\(\{widths: own, gap, room: room\(\), must, current/u);
  // The observer still expects the boxes at the widths they are drawn.
  assert.match(source, /this\.expectTabSizes\(hosts, widths, kept\);/u);
  assert.equal(JSON.parse(read('src/smart/tabs/component.json')).version, '1.5.6'); // GB18: VO-1 attribute order, panels example; // GB16-5/6: the label beside the glyph, name tooltips; // GB16 returns: the tightest row // GB19 touch size (C428)
});

test('G12: the shortened tab truncates with an ellipsis', () => {
  const sheet = read('src/component/tabs/scss/_css__tabs.scss');
  assert.match(sheet, /\.sf-tabs-top > \.sf-tabs-squeezed \.sf-button-text-container,[\s\S]*?overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/u);
});
