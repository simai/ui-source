// Navigation joint pass, area b (DEV letter on pair 5.20261115.1622, defects
// RG-NV 1-12; owner decision C237): breadcrumbs, link, pagination. Browser
// measurements live in the acceptance evidence; this file pins the source.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));

test('RG-NV 1: the breadcrumbs runtime wraps a bare name; the sheet cuts one before it runs', async () => {
  const runtime = await read('src/component/breadcrumbs/js/breadcrumbs.js');
  const item = await read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss');
  assert.match(runtime, /function wrapLabels\(root\)/u);
  assert.match(runtime, /wrapLabels\(root\);\n\s+clearGenerated\(root\);/u);
  assert.match(runtime, /if \(isLabelWrap\(mutation\)\) return;/u);
  assert.match(item, /> \.sf-breadcrumbs-item-container:not\(:has\(> \*\)\) \{\n\s+display: block;\n\s+overflow: hidden;\n\s+text-overflow: ellipsis;\n\s+white-space: nowrap;/u);
  assert.match(item, /hover > \.sf-breadcrumbs-item-container:not\(:has\(> \*\)\) \{\n\s+text-decoration-line: underline;/u);
});

test('RG-NV 2: an icon-only crumb is a square target of the 1/3 height', async () => {
  const item = await read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss');
  assert.match(item, /\.sf-breadcrumbs-item:is\(a, button\):has\(> \.sf-breadcrumbs-item-container > :is\(\.sf-icon, sf-icon\):only-child\) \{\n\s+justify-content: center;\n\s+min-inline-size: var\(--sf-breadcrumbs--target\);/u);
});

test('RG-NV 3: «…» asks the Loader for sf-menu-context and opens the menu', async () => {
  const runtime = await read('src/component/breadcrumbs/js/breadcrumbs.js');
  assert.match(runtime, /globalThis\.SF\.Loader\.ensure\(\['sf-menu-context'\]\)/u);
  assert.match(runtime, /if \(menuReady\(\) \|\| \(await requestMenu\(\)\)\) \{/u);
  assert.match(runtime, /if \(menuReady\(\) \|\| menuReachable\(\)\) ellipsis\.setAttribute\('aria-haspopup', 'menu'\);/u);
  // A measuring probe the menu puts beside «…» does not fold the trail again.
  assert.match(runtime, /isGenerated\(node\) \|\| transient\.has\(node\)/u);
  // An icon-only crumb is named in the menu by its aria-label, with its icon.
  assert.match(runtime, /if \(glyph\) crumb\.icon = glyph;/u);
});

test('RG-NV 4: a crumb rings as a link, two pixels off', async () => {
  const item = await read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss');
  assert.match(item, /:focus-visible \{\n\s+--sf-breadcrumbs-item--background-color: var\(--sf-transparent-for-focus\);\n\s+outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\n\s+outline-offset: var\(--sf-a2\);/u);
  assert.equal((await json('src/component/breadcrumbs/passport.json')).version, '1.3.6'); // AM-39: 1.3.6 above fix/heavy-page-recalc's 1.3.5 // C282: 1.2.0 moved on by the language-file patch (Russian is a language file)
});

test('RG-NV 5, 6: sf-link is a run of its text, inline; a link with an icon is one inline-flex control', async () => {
  const css = await read('src/component/link/scss/_css__link.scss');
  const base = css.match(/\n {2}\.sf-link \{[^}]*\}/u)[0];
  assert.match(base, /display: inline;/u);
  assert.match(base, /font: inherit;/u);
  assert.doesNotMatch(base, /var\(--sf-text-size-1\)|var\(--sf-text-height-1\)/u);
  assert.match(css, /\.sf-link:has\(> :is\(\.sf-link__icon, \.sf-link-icon\)\) \{\n[^}]*display: inline-flex;/u);
  assert.match(css, /--sf-icon--font-size: 1lh;\n\s+--sf-icon--width: 1em;\n\s+--sf-icon--height: 1em;\n\s+--sf-link-icon--size: 1em;/u);
  assert.equal((await json('src/component/link/passport.json')).version, '1.3.0'); // group build 10: 1.2.0 moved on by the merged branches or a GB10 patch
});

test('RG-NV 7, 8, 9: a page number is the ghost page button, no plate, as wide as its number', async () => {
  const css = await read('src/component/pagination/scss/_css__page_number.scss');
  assert.match(css, /--sf-page-number--background-color: var\(--sf-pagination-page-background-color, transparent\);/u);
  assert.match(css, /--sf-page-number--color: var\(--sf-pagination-page-color, var\(--sf-on-surface\)\);/u);
  assert.doesNotMatch(css, /--sf-surface-page/u);
  assert.match(css, /--sf-page-number--background-color: var\(--sf-pagination-current-background-color, var\(--sf-primary-container\)\);\n\s+--sf-page-number--color: var\(--sf-pagination-current-color, var\(--sf-on-primary-container\)\);/u);
  assert.match(css, /--sf-page-number--background-color: var\(--sf-place--control-hover, var\(--sf-surface-container-hover\)\);/u);
  assert.match(css, /inline-size: auto;\n\s+min-inline-size: max\(/u);
  assert.equal((await json('src/component/pagination/passport.json')).version, '1.6.4'); // group build 9: 1.5.0 moved on by the merged branches or a GB9 patch // group build 10: 1.5.1 moved on by the merged branches or a GB10 patch // defects-d11: component.pagination 1.6.2 above 1.6.1 on fix/c178-findings: a place never below its own number (RG-NV 9) // fix/rtl-direction-icons: one RTL turn
});

test('RG-NV 10, 11: the row size reaches the arrows; the count row keeps the icon ink; a Smart number never breaks', async () => {
  const css = await read('src/component/pagination/scss/_css__pagination.scss');
  assert.match(css, /\.sf-pagination\.sf-pagination--size-1\\\/2 \.sf-icon-button \{\n\s+--sf-icon-button--padding-bottom: var\(--sf-icon-button-padding-block, var\(--sf-ui-1\\\/2--space-y-tightness-default\)\);/u);
  assert.doesNotMatch(css, /\.sf-pagination-main \.sf-pagination-container \.sf-icon-button[^{]*> \.sf-icon \{\n\s+--sf-icon--color: var\(--sf-on-surface-variant\);/u);
  assert.match(css, /\.sf-pagination-slot > \.sf-pagination-page > \.sf-button-text-container \{\n\s+--sf-button-text-container--padding-inline-start: 0;\n\s+--sf-button-text-container--padding-inline-end: 0;\n\s+white-space: nowrap;/u);
});

test('RG-NV 12: sf-pagination numbers fit seven or five places by its own room', async () => {
  const source = await read('src/smart/pagination/index.js');
  assert.match(source, /return Boolean\(this\._sfNarrow\?\.matches\) \|\| this\._sfCramped === true;/u);
  assert.match(source, /fitPlaces\(\) \{/u);
  assert.match(source, /this\.noteFooterParts\(\);\n(?:\s+this\.\w+\(\);\n)*\s+this\.fitPlaces\(\);/u);
  assert.equal((await json('src/smart/pagination/component.json')).version, '1.8.9'); // group build 9: 1.7.2 moved on by the merged branches or a GB9 patch // C282: 1.8.4 moved on by the language-file patch (Russian is a language file) // group build 10: 1.8.7 moved on by the merged branches or a GB10 patch
});

test('C237: sf-page-number--circle is a retired name that draws the square', async () => {
  const css = await read('src/component/pagination/scss/_css__page_number.scss');
  assert.doesNotMatch(css, /\.sf-page-number--circle \{/u);
  assert.doesNotMatch(css, /--sf-radius-circle/u);
  const {default: table} = await import('../src/core/js/retired-classes.table.js');
  const record = table.records.find((entry) => entry.journal === 'class-page-number-circle-retired');
  assert.deepEqual(record.names, {'sf-page-number--circle': 'sf-page-number--square'});
  assert.equal(record.remove_after, '2027-01-01');
  const journal = await json('contracts/changes/journal.json');
  assert.ok(journal.records.some((entry) => entry.id === 'class-page-number-circle-retired' && entry.decision === undefined && entry.remove_after === '2027-01-01'));
});
