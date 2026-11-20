// Owner decision C145 (2026-11-14, tags study control/research/2026-11-14-tags.md
// in ui-control): the selected filter's mark, sf-tag-group, its keys and «+N»
// panel, the link tag and the data colour dot. The drawn result is measured by
// the C145 probe on a stand (evidence 2026-11-14-tags-c145); this file holds
// the source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const css = read('src/component/tags/scss/_css__tags.scss');
const template = read('src/smart/tag/js/templates/default.js');
const tag = read('src/smart/tag/index.js');
const group = read('src/smart/tag-group/index.js');
const groupCss = read('src/smart/tag-group/js/templates/default.css');
// component.tags moves past 1.7.0 on later changes (1.8.1: a false utility hint removed, RG-B-53).
const atLeastTags = (version) => { const [a, b, c] = version.split('.').map(Number); return a > 1 || (a === 1 && (b > 7 || (b === 7 && c >= 0))); };

test('C145 (2): a filter has no empty square; chosen, a check mark on the primary container', () => {
  assert.match(template, /return context\.active\s*\? html`<sf-icon icon="check" root-class="sf-tag-icon sf-tag-check" aria-hidden="true"><\/sf-icon>`\s*: nothing;/u);
  // Important (content study T1, 2026-11-16): the icons sheet's unlayered display outranks a layer.
  assert.match(css, /\.sf-tag:not\(\.active, \[aria-pressed="true"\]\) \.sf-tag-check \{\s*display: none !important;/u);
  // The label after a hidden mark is the first part drawn: no padding of its own (T2, C76).
  assert.match(css, /\.sf-tag\.sf-tag:not\(\.active, \[aria-pressed="true"\]\) \.sf-tag-check:first-child \+ \.sf-tag-container \{\s*--sf-tag-container--padding-inline-start: 0;/u);
  assert.doesNotMatch(css, /\.sf-tag-check \{[^}]*border:/u);
  assert.match(tag, /if \(host\.type === 'checkbox' && !slotted\('leading'\) && !host\.href\) return \['check'\];/u);
});

test('C145 (3): sf-tag-group is a list of tags 4 apart', () => {
  assert.match(groupCss, /column-gap: var\((?:--sf-space-1\\\/4|--sf-gap--tags)\);/u);
  assert.match(groupCss, /row-gap: var\(--sf-space-1\\\/4\);/u);
  assert.match(group, /this\.setAttribute\('role', 'list'\)/u);
  assert.match(group, /tag\.setAttribute\('role', 'listitem'\)/u);
  const names = json('contracts/registry/names.json');
  assert.ok(JSON.stringify(names).includes('"sf-tag-group"'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/tag-group\/rule\.js';/u);
  const manifest = json('src/smart/tag-group/component.json');
  assert.equal(manifest.version, '1.1.0'); // C396: moved on by the width ladder in characters // C282: 1.0.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.0.4 moved on by the merged branches or a GB10 patch // group build 13: 1.0.6 moved on by the merged branches or the C278 language patch
  assert.deepEqual(manifest.settings.selection.enum ?? manifest.settings.selection.values ?? ['none', 'one', 'many'], ['none', 'one', 'many']);
  // The core holds its box before its code.
  assert.match(read('src/core/scss/_sf_css__placeholder.scss'), /:where\(sf-tag-group:not\(:defined\)\) \{[^}]*gap: var\((?:--sf-space-1\\\/4|--sf-gap--tags)\);/u);
});

test('C145 (4): the group is one Tab stop with the lookup chips\' keys and words', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Delete', 'Backspace']) {
    assert.match(group, new RegExp(`'${key}'`, 'u'), key);
  }
  assert.match(group, /tabIndex = (?:index === active|item === current) \? 0 : -1|tabindex/u);
  assert.match(group, /said\(/u);
  for (const locale of ['ru', 'en']) {
    const words = json(`src/smart/tag-group/lang/${locale}.json`).runtime;
    assert.ok(words.position && words['position-plain'], locale);
  }
});

test('C145 (5): «+N» opens the hidden tags in the popover, no new look', () => {
  assert.match(group, /createElement\('sf-popover'\)/u);
  assert.match(group, /slot', 'trigger'/u);
  assert.match(group, /slot', 'content'/u);
  assert.match(groupCss, /\.sf-tag-group__panel \{\s*padding: var\(--sf-space-1\\\/3\);/u);
  const manifest = json('src/smart/tag-group/component.json');
  assert.ok(manifest.relations.some((relation) => relation.name === 'popover' || relation.class === 'cl-popover' || JSON.stringify(relation).includes('popover')));
});

test('C145 (6): a tag with href is a link: no checkbox, no cross, underline on hover', () => {
  assert.match(template, /if \(context\.href\) return renderLinkTag\(context, textContent\);/u);
  assert.match(tag, /export function tagHref\(value\)/u);
  assert.match(css, /\.sf-tag\.sf-tag--link:not\(\.disabled\):hover .sf-tag-container \{\s*text-decoration-line: underline;/u);
  const settings = json('src/smart/tag/component.json').settings;
  assert.ok(settings.href);
});

test('C145 (7): a data colour is an 8 px palette dot on a neutral tag', () => {
  assert.match(tag, /export function tagHue\(value\)/u);
  assert.match(css, /\.sf-tag \.sf-tag-color-icon\.sf-tag-color-icon--hue \{\s*background-color: var\(--sf-hue\);/u);
  assert.match(css, /var\(--sf-tag--dot, var\(--sf-micro--point-1\\\/2\)\)/u);
  assert.ok(json('src/smart/tag/component.json').settings.color);
});

test('C145 (1): a tag in a field is the field less 8; its cross follows its height', () => {
  // A chip on a field's line at 1/2 on a desktop is 32: its cross is 12, as a compact 1 of the same 32.
  // Outside a field a 1/2 tag takes C132's 8 (content study T3, 2026-11-16).
  assert.match(css, /\.sf-tag\.sf-tag--inline\.sf-tag--size-1\\\/2:not\(\[data-sf-density="compact"\] \*\),[^{]*\{\s*--sf-tag--close-size: var\(--sf-micro--cross-1\);/u);
  assert.doesNotMatch(css, /\n\s*\.sf-tag\.sf-tag--size-1\\\/2:not\(\[data-sf-density="compact"\] \*\),/u);
  // A remove button without the close class reaches 24 too.
  assert.match(css, /\.sf-tag > button\.sf-icon-button:has\(> \.sf-close\):not\(\.sf-icon-button--close\)::after/u);
  // sf-input-lookup: the chip tag's own cross, an avatar of at least 16.
  const lookup = read('src/smart/input-lookup/scss/_smart__lookup.scss');
  assert.doesNotMatch(lookup, /--sf-lookup--chip-cross/u);
  assert.match(lookup, /--sf-lookup--chip-avatar: max\(var\(--sf-b6\), calc\(var\(--sf-lookup--chip-height\) - 2 \* var\(--sf-space-1\\\/4\)\)\);/u);
  assert.match(lookup, /--sf-lookup--chip-height: calc\(var\(--sf-field-action--height\) - 2 \* var\(--sf-space-1\\\/4\)\);/u);
  // sf-dropdown: the field less 8 at every size, the rows 4 apart.
  const dropdown = read('src/component/dropdown/scss/_css__custom.scss');
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(dropdown.includes(`.sf-dropdown.sf-dropdown--tag.sf-dropdown--size-${size} { --sf-dropdown-tag-line--box: calc(var(--sf-ui-${size}--control-height) - 2 * var(--sf-space-1\\/4)); }`), size);
  }
  assert.match(read('src/component/dropdown/scss/_css__dropdown.scss'), /\.sf-dropdown\.sf-dropdown--tag \.sf-dropdown-tag-container \{\s*--sf-dropdown-tag-container--gap: var\((?:--sf-space-1\\\/4|--sf-gap--tags)\);/u);
});

test('C145 amendment R238: the first tag in a field stands 4 from its start edge, as above and below', () => {
  const lookup = read('src/smart/input-lookup/scss/_smart__lookup.scss');
  // sf-input-lookup: a frame starting with a chip pads its start by the chip's inset less the border.
  assert.match(lookup, /\.sf-lookup \.sf-lookup-frame:has\(> \.sf-lookup-chip:first-child\) \{\s*padding-inline-start: var\(--sf-lookup-padding-inline, calc\(var\(--sf-space-1\\\/4\) - var\(--sf-px\)\)\);/u);
  // The empty field's placeholder keeps the C77 value inset.
  assert.match(lookup, /\.sf-lookup:not\(:has\(\.sf-lookup-chip\)\) \.sf-lookup-frame \{\s*padding-inline-start: var\(--sf-lookup-padding-inline, calc\(var\(--sf-lookup--value-inset\) - var\(--sf-px\)\)\);/u);
  // sf-dropdown's tag field (no search text) pads its start the same way.
  assert.match(read('src/component/dropdown/scss/_css__custom.scss'), /\.sf-dropdown\.sf-dropdown\.sf-dropdown--tag > \.sf-dropdown-field\.sf-dropdown-field \{[^}]*--sf-dropdown-field--padding-inline-start: calc\(var\(--sf-space-1\\\/4\) - var\(--sf-px\)\);/u);
});

test('versions: sf-tag 1.8.0, component.tags 1.7.0, sf-tag-group 1.0.1, sf-dropdown 1.12.0, component.dropdown 1.10.0, sf-input-lookup 1.12.1 (group build 6: the integration line\'s higher numbers carry these notes)', () => {
  assert.equal(json('src/smart/dropdown/component.json').version, '1.24.0'); // form fields: 1.20.6, options relabelled // C153 // group build 7: the integrated number (the branch wrote 1.14.0) // group build 9: 1.16.1 moved on by the merged branches or a GB9 patch // C282: 1.18.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.20.1 moved on by the merged branches or a GB10 patch // group build 13: 1.20.6 moved on by the merged branches or a GB11 merge // group build 14: 1.22.0 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.equal(json('src/component/dropdown/passport.json').version, '1.18.1'); // group build 7: the patch for moved files (the line had 1.13.2) // group build 9: 1.13.4 moved on by the merged branches or a GB9 patch // group build 10: 1.15.0 moved on by the merged branches or a GB10 patch // group build 13: 1.16.2 moved on by the merged branches or a GB11 merge // group build 14: 1.17.0 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.equal(json('src/smart/input-lookup/component.json').version, '1.19.0'); // group build 8: C208's patch above RG-S2's 1.15.2 (group build 7: the integrated number; the branch wrote 1.13.1) // group build 9: 1.15.3 moved on by the merged branches or a GB9 patch // C282: 1.16.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.17.1 moved on by the merged branches or a GB10 patch // group build 13: 1.17.3 moved on by the merged branches or the C278 language patch // group build 14: 1.17.4 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.equal(json('src/smart/input-lookup/smart.manifest.json').version, '1.19.0'); // group build 10: 1.17.1 moved on by the merged branches // C282: moved on by the language-file patch (Russian is a language file) // group build 9 // group build 8 // group build 13: 1.17.3 moved on by the merged branches or the C278 language patch // group build 14: 1.17.4 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.equal(json('src/smart/tag/component.json').version, '1.12.7'); // reds-before-gb15: the height property says the drawn height; // feat/button-truncate-appearance: an interactive tag is never a toggle // C282: moved on by the language-file patch (Russian is a language file) // group build 9 // group build 7: the GB6 notes numbered above the released 1.9.1 // group build 10: 1.12.1 moved on by the merged branches or a GB10 patch // group build 11: 1.12.4 moved on by the merged branches or a GB11 merge (fix/c178-findings)
  assert.equal(json('src/smart/tag/smart.manifest.json').version, '1.12.7'); // reds-before-gb15: the height property says the drawn height; // group build 10: 1.12.1 moved on by the merged branches // C282: moved on by the language-file patch (Russian is a language file) // group build 9 // group build 7 // group build 11: 1.12.4 moved on by the merged branches or a GB11 merge (fix/c178-findings)
  assert.ok(atLeastTags(json('src/component/tags/passport.json').version), 'component.tags at least 1.7.0');
  assert.equal(json('src/smart/tag-group/smart.manifest.json').version, '1.1.0'); // C396: moved on by the width ladder in characters // C282: 1.0.1 moved on by the language-file patch, above 1.0.3 on origin // first paint R222 open item 10: the printed «+N» replaced // group build 10: 1.0.4 moved on by the merged branches or a GB10 patch // group build 13: 1.0.6 moved on by the merged branches or the C278 language patch
});
