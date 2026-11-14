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

test('C145 (2): a filter has no empty square; chosen, a check mark on the primary container', () => {
  assert.match(template, /return context\.active\s*\? html`<sf-icon icon="check" root-class="sf-tag-icon sf-tag-check" aria-hidden="true"><\/sf-icon>`\s*: nothing;/u);
  assert.match(css, /\.sf-tag:not\(\.active\) \.sf-tag-check \{\s*display: none;/u);
  assert.doesNotMatch(css, /\.sf-tag-check \{[^}]*border:/u);
  assert.match(tag, /if \(host\.type === 'checkbox' && !slotted\('leading'\) && !host\.href\) return \['check'\];/u);
});

test('C145 (3): sf-tag-group is a list of tags 4 apart', () => {
  assert.match(groupCss, /column-gap: var\(--sf-space-1\\\/4\);/u);
  assert.match(groupCss, /row-gap: var\(--sf-space-1\\\/4\);/u);
  assert.match(group, /this\.setAttribute\('role', 'list'\)/u);
  assert.match(group, /tag\.setAttribute\('role', 'listitem'\)/u);
  const names = json('contracts/registry/names.json');
  assert.ok(JSON.stringify(names).includes('"sf-tag-group"'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/tag-group\/rule\.js';/u);
  const manifest = json('src/smart/tag-group/component.json');
  assert.equal(manifest.version, '1.0.0');
  assert.deepEqual(manifest.settings.selection.enum ?? manifest.settings.selection.values ?? ['none', 'one', 'many'], ['none', 'one', 'many']);
  // The core holds its box before its code.
  assert.match(read('src/core/scss/_sf_css__placeholder.scss'), /:where\(sf-tag-group:not\(:defined\)\) \{[^}]*gap: var\(--sf-space-1\\\/4\);/u);
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
  // Outside a field a 1/2 tag on a desktop is 32: its cross is 12, as a compact 1 of the same 32.
  assert.match(css, /\.sf-tag\.sf-tag--size-1\\\/2:not\(\[data-sf-density="compact"\] \*\),[^{]*\{\s*--sf-tag--close-size: var\(--sf-micro--cross-1\);/u);
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
  assert.match(read('src/component/dropdown/scss/_css__dropdown.scss'), /\.sf-dropdown\.sf-dropdown--tag \.sf-dropdown-tag-container \{\s*--sf-dropdown-tag-container--gap: var\(--sf-space-1\\\/4\);/u);
});

test('versions: sf-tag 1.8.0, component.tags 1.7.0, sf-tag-group 1.0.0, sf-dropdown 1.12.0, component.dropdown 1.10.0, sf-input-lookup 1.12.0', () => {
  assert.equal(json('src/smart/dropdown/component.json').version, '1.12.0');
  assert.equal(json('src/component/dropdown/passport.json').version, '1.10.0');
  assert.equal(json('src/smart/input-lookup/component.json').version, '1.12.0');
  assert.equal(json('src/smart/tag/component.json').version, '1.8.0');
  assert.equal(json('src/smart/tag/smart.manifest.json').version, '1.8.0');
  assert.equal(json('src/component/tags/passport.json').version, '1.7.0');
  assert.equal(json('src/smart/tag-group/smart.manifest.json').version, '1.0.0');
});
