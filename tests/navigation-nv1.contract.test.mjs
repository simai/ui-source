// Section Navigation, pair 5.20261115.1622 (DEV letter, RG-NV 30 and 31a-31l;
// owner decisions C241, C242, C243 of 2026-11-16, ui-control
// control/docs-review/decisions.md). Steps: the 1.2.0 markup is a dated alias
// and the row's line stands 8 / 8. Tabs: class markup lays out its own tabs,
// keeps the selected label medium with a reserved width, moves what does not
// fit into «Ещё»; icon tabs stand on the row's edges with the line under the
// icon. Tree: rows 4 apart with the C77 inset, the current page's glyphs in
// its ink, a closed branch holding it medium, hover on the row, the docs'
// chevron forms on the column. These pin the source; the behaviour was
// measured on a build (ui-control evidence, navigation NV1).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

const steps = read('src/component/step/scss/_css__steps.scss');
const step = read('src/component/step/scss/_css__step.scss');
const tabs = read('src/component/tabs/scss/_css__tabs.scss');
const tabsJs = read('src/component/tabs/js/_tabs.js');
const tree = read('src/component/tree/scss/_css__tree.scss');
const item = read('src/component/tree-item/scss/_css__tree_item.scss');

test('versions above every origin branch', () => {
  assert.equal(json('src/component/step/passport.json').version, '1.5.0'); // group build 10: 1.4.0 moved on by the merged branches or a GB10 patch
  assert.equal(json('src/component/tabs/passport.json').version, '1.5.2'); // GB10 fix/misc-m10: the counter's own text step (1.4.1 in group build 9) // group build 10: 1.5.1 moved on by the merged branches or a GB10 patch
  assert.equal(json('src/component/tab/passport.json').version, '1.1.0'); // group build 9: 1.0.3 moved on by the merged branches or a GB9 patch
  assert.equal(json('src/component/tree/passport.json').version, '1.6.0'); // group build 9: 1.5.0 moved on by the merged branches or a GB9 patch // group build 10: 1.5.1 moved on by the merged branches or a GB10 patch
  assert.equal(json('src/component/tree-item/passport.json').version, '1.2.0'); // group build 10: 1.1.2 moved on by the merged branches or a GB10 patch
  assert.equal(json('src/smart/tree/component.json').version, '2.4.1'); // C282: 2.4.0 moved on by the language-file patch (Russian is a language file)
});

test('C241: a row of steps puts its line 8 from the label and 8 before the next marker', () => {
  assert.match(steps, /gap: var\(--sf-steps-gap, var\(--sf-space-1\\\/3\)\);/u);
  assert.match(steps, /\.sf-steps:is\(\.sf-steps--layout-row, \[data-sf-measure\]\) \.sf-step \{[^}]*gap: var\(--sf-space-1\\\/3\);/u);
});

test('RG-NV 30: the 1.2.0 step markup draws the C101 look until 2027-01-01 and is noted', async () => {
  for (const name of ['sf-step--stage-default', 'sf-step--stage-completed', 'sf-step--stage-error', 'sf-steps-separator--directional']) {
    assert.ok(step.includes(name), `${name} is drawn`);
  }
  assert.match(step, /counter-increment: sf-step-legacy;/u);
  assert.match(step, /\.sf-step\.sf-step--stage-default:is\(\.selected, \[aria-current="step"\]\):not\(:has\(> \.sf-icon\)\)::before \{[^}]*outline: var\(--sf-step--ring\)/u);
  const table = (await import('../src/core/js/retired-classes.table.js')).default;
  const record = table.records.find(({journal}) => journal === 'class-steps-1-2-stages-retired');
  assert.ok(record);
  assert.equal(record.remove_after, '2027-01-01');
  assert.equal(record.names['sf-step--stage-completed'], 'sf-step--state-done');
  assert.equal(record.names['sf-steps-separator--directional'], null);
});

test('RG-NV 31a, 31b, 31d: a tab lays out its icon and label itself', () => {
  assert.match(tabs, /\.sf-tabs > \.sf-tabs-top-container > \.sf-tabs-top :is\(\.sf-button, \.sf-icon-button\) \{\s*display: flex;\s*flex-direction: row;\s*flex-wrap: nowrap;\s*align-items: center;/u);
});

test('RG-NV 31c: class markup keeps only the selected label medium, with its width reserved', () => {
  assert.match(tabs, /\.sf-tabs-top \.sf-button > \.sf-button-text-container \{\s*font-weight: var\(--sf-weight--regular\);/u);
  assert.match(tabs, /\.sf-button\.selected > \.sf-button-text-container \{\s*font-weight: var\(--sf-weight--medium\);/u);
  assert.match(tabs, /\[data-sf-tabs-text\]::before \{\s*content: attr\(data-sf-tabs-text\) \/ "";/u);
  assert.match(tabsJs, /function syncLabelText\(label\)/u);
});

test('RG-NV 31e: class markup that does not fit moves its tabs into «Ещё», never scrolls', () => {
  assert.match(tabsJs, /import \{ fitBesideMore, fitInOrder, rowRoom, triggerExtra \} from '..\/..\/..\/core\/js\/overflow-row.js';/u);
  assert.match(tabsJs, /menuOpen\(\{ anchor, entries/u);
  assert.match(tabs, /\.sf-tabs-top-container\[data-sf-tabs-row\] > \.sf-tabs-top \{\s*flex-wrap: nowrap;\s*overflow-x: clip;/u);
  assert.match(tabs, /\.sf-tabs-top > \[data-sf-tabs-out\] \{\s*display: none !important;/u);
  // The row's own state is in data attributes the document observer does not watch.
  assert.doesNotMatch(tabsJs.match(/attributeFilter: \[[^\]]*\]/u)[0], /data-sf-tabs/u);
  // The first tab shown after «Ещё» took the ones before it stands on the row's edge (C99).
  assert.match(tabsJs, /setAttr\(buttons\[lead\], LEAD, ''\)/u);
  assert.match(tabs, /\.sf-tabs-top \.sf-button\[data-sf-tabs-lead\] \{\s*--sf-button--padding-inline-start: calc\(var\(--sf-px\) \* 0\);/u);
});

test('C242: icon tabs stand on the row edges, the line as wide as the icon and under it', () => {
  assert.match(tabs, /> \.sf-tabs-top > \.sf-icon-button:first-child,\s*[^{]*\.sf-icon-button\[data-sf-tabs-lead\] \{\s*--sf-icon-button--padding-inline-start: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(tabs, /> \.sf-tabs-top > \.sf-icon-button:last-child \{\s*--sf-icon-button--padding-inline-end: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(tabs, /\.sf-icon-button\.selected:not\(:disabled\):not\(\.disabled\)::after \{\s*inset-inline: var\(--sf-icon-button--padding-inline-start, calc\(var\(--sf-px\) \* 0\)\) auto;/u);
});

test('RG-NV 31f: the legacy sf-tab focus ring follows its plate', () => {
  assert.match(read('src/component/tab/scss/_css__sf_tab.scss'), /li:focus-visible \{\s*border-radius: var\(--sf-tab--radius, var\(--sf-radius--ui\)\);/u);
});

test('C243: tree rows 4 apart with the C77 inset by size', () => {
  assert.match(tree, /gap: var\(--sf-tree-gap, var\(--sf-tree--gap, var\(--sf-space-1\\\/4\)\)\);/u);
  assert.match(tree, /\.sf-tree \.sf-tree-group \{\s*display: flex;\s*flex-direction: column;\s*gap: var\(--sf-tree-item--gap, var\(--sf-space-1\\\/4\)\);/u);
  assert.match(tree, /padding-inline: var\(--sf-tree-item--padding-inline, var\(--sf-tree--inset\)\);/u);
  assert.match(tree, /--sf-tree--inset: max\(var\(--sf-space-1\\\/2\), var\(--sf-b2\)\);/u);
  assert.match(tree, /@media \(min-width: 60rem\) \{\s*--sf-tree--inset: var\(--sf-space-2\);/u);
});

test('RG-NV 31g-31l: current glyphs, closed branch, hover, chevron span and toggle size', () => {
  assert.match(tree, /\[aria-current='page'\] > \.sf-tree-item-container \{[^}]*--sf-tree-item-icon--color: currentColor;/u);
  assert.match(tree, /:has\(\.sf-tree-item\[aria-current='page'\]\) > \.sf-tree-item-container,\s*\.sf-tree \.sf-tree-item\.sf-tree-item--holds-current/u);
  assert.match(read('src/smart/tree/index.js'), /'sf-tree-item--holds-current'/u);
  assert.match(tree, /:not\(\.active\):not\(\[aria-selected='true'\]\) > \.sf-tree-item-container:hover \{/u);
  assert.match(tree, /> \.sf-tree-item-container:hover \{\s*background: var\(--sf-tree-selected-background-color, var\(--sf-primary-container-hover\)\);/u);
  assert.match(tree, /\.sf-tree-item-container > \.sf-tree-chevron:not\(\.sf-icon\) \{\s*display: inline-flex;/u);
  assert.match(tree, /\.sf-tree \.sf-tree-item-container > \.sf-icon-button \{[^}]*inline-size: var\(--sf-tree--column\);/u);
  assert.match(item, /\.sf-tree-item-container > \.sf-tree-chevron,\s*\.sf-tree-item-container > \.sf-icon-button > \.sf-icon \{/u);
  assert.match(item, /> \.sf-tree-chevron:not\(\.sf-icon\) \{\s*color: var\(--sf-icon--color\);/u);
  assert.match(tree, /\.sf-tree \.sf-tree-item \{\s*display: flex;\s*flex-direction: column;/u);
});
