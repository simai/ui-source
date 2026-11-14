// sf-tag 1.7.0: defects of the tags study (ui-control
// control/research/2026-11-14-tags.md) against owner decisions C58, C105,
// C139 (6), C140 and C132. The drawn result is measured by the TG probe on a
// stand (evidence control/evidence/2026-11-14-tags-g4); this file holds the
// source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const css = read('src/component/tags/scss/_css__tags.scss');
const smartCss = read('src/smart/tag/js/templates/default.css');
const row = read('src/smart/tag/js/tag-row.js');

test('TG-1 (C58): a long name ends in an ellipsis, the tag is at most 20rem, the whole name is its tooltip', () => {
  const base = css.slice(css.indexOf('  .sf-tag {'), css.indexOf('\n  }\n', css.indexOf('  .sf-tag {')));
  assert.match(base, /max-inline-size: min\(var\(--sf-g0\), 100%\);/u);
  const label = css.slice(css.indexOf('  .sf-tag .sf-tag-container {'), css.indexOf('\n  }\n', css.indexOf('  .sf-tag .sf-tag-container {')));
  assert.match(label, /overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/u);
  assert.doesNotMatch(label, /overflow-wrap: anywhere/u);
  const template = read('src/smart/tag/js/templates/default.js');
  assert.match(template, /class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1\/3 sf-tag-tooltip" aria-hidden="true" hidden/u);
  assert.equal((template.match(/data-tooltip=\$\{context\.cutTooltipId \|\| nothing\}/gu) || []).length, 4, 'each trigger: checkbox, its removable form, interactive, static');
  assert.ok(json('src/smart/tag/component.json').relations.some((relation) => relation.name === 'tooltip'));
  assert.match(read('src/smart/tag/rule.js'), /\{ name: 'tooltip' \}/u);
  assert.match(read('src/smart/tag/index.js'), /label\.scrollWidth - label\.clientWidth > 0\.5/u);
});

test('TG-2 (C58): a tag keeps its width; a one-row container shows what fits and «+N»', () => {
  assert.match(css, /\.sf-tag:not\(\.sf-tag--inline\) \{\s*flex-shrink: 0;\s*\}/u);
  assert.match(smartCss, /sf-tag\[data-sf-tag-over\] \{\s*display: none !important;/u);
  assert.match(smartCss, /sf-tag\[data-sf-tag-shrink\] > \.sf-tag \{\s*flex-shrink: 1;/u);
  assert.match(row, /view\.flexWrap === 'nowrap'/u);
  // A plain count, no panel (what «+N» opens is an open owner question).
  assert.doesNotMatch(row, /addEventListener\('click'/u);
  for (const locale of ['ru', 'en']) {
    const words = json(`src/smart/tag/lang/${locale}.json`).runtime;
    assert.equal(typeof words.more, 'object', locale);
    assert.match(words.more.other, /\{n\}.*\{names\}/u, locale);
  }
  // Hosts that lay out their own chips are left alone.
  assert.match(row, /const MANAGED = 'sf-input-lookup, sf-lookup, sf-dropdown, \.sf-dropdown';/u);
});

test('TG-3 (C140 (6)): a pressed or removable status tag writes its label in the badge\'s ink', () => {
  for (const status of ['success', 'error', 'warning', 'info']) {
    assert.match(css, new RegExp(`\\.sf-tag\\.sf-tag--${status} \\.sf-tag-container \\{\\s*--sf-tag-container--color: var\\(--sf-tag-color, var\\(--sf-on-${status}-container\\)\\);`, 'u'), status);
  }
});

test('TG-7 (C58): a picture is the tag less 4 above and below, the height stays the control', () => {
  assert.match(css, /--sf-tag--picture: calc\(var\(--sf-tag--line-height\) \+ 2 \* var\(--sf-tag--picture-pad\) - 2 \* var\(--sf-space-1\\\/4\)\);/u);
  assert.match(css, /--sf-tag--picture-pull: calc\(var\(--sf-space-1\\\/4\) - var\(--sf-tag--picture-pad\)\);/u);
  const rule = css.slice(css.lastIndexOf(':is(.sf-tag.sf-tag:not(.sf-tag--inline, .sf-list-item *)'));
  for (const name of ['--sf-avatar--height', '--sf-avatar--width', '--sf-tag-color-icon--height', '--sf-icon--font-size']) {
    assert.match(rule, new RegExp(`${name}: var\\(--sf-tag--picture\\);`, 'u'), name);
  }
  assert.match(rule, /margin-block: var\(--sf-tag--picture-pull\);/u);
});

test('TG-8 (C139 (6)): closable tags in a field are one Tab stop with the lookup chips\' keys and words', () => {
  assert.match(row, /row\.closest\('\.sf-input-field'\)/u);
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Delete', 'Backspace']) assert.match(row, new RegExp(`'${key}'`, 'u'), key);
  assert.match(row, /tag\.onClose\?\.\(\)/u);
  assert.match(row, /setAttribute\('aria-live', 'polite'\)/u);
  assert.equal(json('src/smart/tag/lang/ru.json').runtime.position, '{label}, {position} из {total}, Delete — убрать');
  assert.equal(json('src/smart/tag/lang/en.json').runtime.position, '{label}, {position} of {total}, Delete to remove');
});

test('TG-10: disabled and selected reads disabled', () => {
  assert.match(css, /\.sf-tag\.sf-tag\.sf-tag\.disabled\.active \{\s*--sf-tag--background-color: var\(--sf-surface-disabled\);/u);
  // C145 (2): the check square is gone; a chosen disabled tag's mark takes the disabled ink.
  assert.match(css, /\.sf-tag\.active:is\(\.disabled, :disabled\) \.sf-tag-check \{\s*--sf-icon--color: var\(--sf-on-surface-disabled\);\s*color: var\(--sf-on-surface-disabled\);/u);
});

test('TG-15: core holds a bare sf-tag\'s box from its attributes before its code', () => {
  const core = read('src/core/scss/_sf_css__placeholder.scss');
  assert.match(core, /:where\(sf-tag:not\(:defined\)\):not\(:has\(> \[data-sf-static\]\)\) \{\s*display: inline-block;/u);
  assert.match(core, /block-size: var\(--sf-tag--box-control\);/u);
  assert.match(core, /content: attr\(text\);/u);
});

test('TG-16: the examples write the current names; the conformance page keeps the dated ones it checks', () => {
  const examples = json('src/smart/tag/examples.json');
  assert.equal(examples.examples.some((example) => example.settings.appearance === 'surface'), false);
  // The studio fixture keeps the dated name its owner contract pins (aliases stay).
  assert.equal(json('src/smart/tag/studio.fixture.json').props.type, 'default');
});

test('versions: sf-tag 1.7.0, component.tags 1.6.0', () => {
  assert.equal(json('src/smart/tag/component.json').version, '1.7.0');
  assert.equal(json('src/smart/tag/smart.manifest.json').version, '1.7.0');
  assert.equal(json('src/component/tags/passport.json').version, '1.6.0');
});
