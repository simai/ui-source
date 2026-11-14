// The accordion study's defects that existing owner decisions already settle
// (control/research/2026-11-14-accordion.md, ui-control): AC-4 (C105 H2),
// AC-5 (C77, C105 H4), AC-6 (C107), AC-8 (find-in-page), AC-9 (the box
// before the code) and AC-14 (content colour and space).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('src/component/accordion/scss/_css__accordion.scss');
const runtime = read('src/component/accordion/js/_accordion.js');
const core = read('src/core/scss/_sf_css__placeholder.scss');

const sizeRule = (step) => {
  const rule = sheet.match(new RegExp(`\\.sf-accordion\\.sf-accordion--size-${step.replace('/', '\\\\\\/')} \\{([^}]*)\\}`));
  assert.ok(rule, `size ${step} has its rule`);
  return rule[1];
};

test('AC-4: icon, title, badge and marker stand a row step apart (C105 H2)', () => {
  const trigger = sheet.match(/\n\.sf-accordion-trigger \{([^}]*)\}/u)[1];
  assert.match(trigger, /gap: var\(--sf-space-1\\\/2\);/u);
  assert.doesNotMatch(trigger, /gap: var\(--sf-space-1\);/u);
});

test('AC-5: at 1/2, 1 and 2 the inset is the value inset of sf-input of that size (C77)', () => {
  assert.match(sizeRule('1/2'), /--sf-accordion--trigger-padding-inline: max\(var\(--sf-space-1\\\/2\), var\(--sf-b2\)\);/u);
  assert.match(sizeRule('1'), /--sf-accordion--trigger-padding-inline: var\(--sf-space-1\);/u);
  assert.match(sizeRule('2'), /--sf-accordion--trigger-padding-inline: var\(--sf-space-2\);/u);
  // The same values sf-input reads.
  const inputs = read('src/component/inputs/scss/_css__inputs.scss');
  assert.match(inputs, /\.sf-input\.sf-input--size-1\\\/2 \{\s*--sf-input--inset: max\(var\(--sf-space-1\\\/2\), var\(--sf-b2\)\);/u);
  assert.match(inputs, /\.sf-input\.sf-input--size-2 \{\s*--sf-input--inset: var\(--sf-space-2\);/u);
  // Sizes C77 does not name keep the size's space-x.
  assert.match(sizeRule('1/3'), /--sf-accordion--trigger-padding-inline: var\(--sf-ui-1\\\/3--space-x\);/u);
  assert.match(sizeRule('3'), /--sf-accordion--trigger-padding-inline: var\(--sf-ui-3--space-x\);/u);
});

test('AC-6: the header icons take the control icon role (C107)', () => {
  assert.match(sheet, /\.sf-accordion \.sf-accordion-trigger \.sf-icon \{\s*color: var\(--sf-icon--color, var\(--sf-accordion-icon-color, var\(--sf-on-surface-icon\)\)\);/u);
  assert.match(sheet, /\.sf-accordion \.sf-accordion-trigger:is\(:hover, :active\) \.sf-icon \{\s*color: var\(--sf-icon--color, var\(--sf-accordion-icon-color, currentColor\)\);/u);
});

test('AC-14: the content is body text, the header inset from every edge', () => {
  assert.match(sheet, /--sf-accordion--content-padding: var\(--sf-accordion--trigger-padding-inline\);/u);
  for (const step of ['1/3', '1/2', '1', '2', '3']) {
    assert.doesNotMatch(sizeRule(step), /--sf-accordion--content-padding/u, step);
  }
  assert.match(sheet, /color: var\(--sf-accordion-content--color, var\(--sf-accordion-content-color, var\(--sf-on-surface\)\)\);/u);
});

test('AC-8, C154 (6): every closed panel is hidden="until-found" and opens on beforematch', () => {
  assert.match(runtime, /const UNTIL_FOUND = 'until-found';/u);
  assert.match(runtime, /this\.content\?\.addEventListener\('beforematch', this\.onBeforeMatch\);/u);
  // The hidden class (display: none) would take the text out of the search.
  const hide = runtime.slice(runtime.indexOf('  hideContent() {'));
  assert.match(hide.slice(0, hide.indexOf('\n  }\n')), /^  hideContent\(\) \{\s*this\.content\.setAttribute\('hidden', UNTIL_FOUND\);\s*this\.content\.classList\.remove\('hidden'\);\s*$/u);
  // A closed findable panel shows no padding.
  assert.match(sheet, /\.sf-accordion \.sf-accordion-content\[hidden='until-found'\] \{\s*padding-block: 0;/u);
  // Core's reset leaves until-found to the browser.
  assert.match(read('src/core/scss/_sf_css__preset.scss'), /\[hidden\]:not\(\[hidden="until-found"\]\)/u);
});

test('AC-9: before its code the bare element holds its box from core.css', () => {
  assert.match(core, /:where\(sf-accordion:not\(:defined\)\) \{\s*--sf-accordion--box-header: var\(--sf-ui-3--control-height\);/u);
  assert.match(core, /min-block-size: max\(var\(--sf-skeleton-block-size, calc\(var\(--sf-px\) \* 0\)\), var\(--sf-accordion--box-header\)\);/u);
  assert.match(core, /> details > summary\) \{[\s\S]*min-block-size: var\(--sf-accordion--box-header\);/u);
  for (const step of ['1/3', '1/2', '1', '2', '3']) {
    assert.ok(core.includes(`:where(sf-accordion[size="${step}"]:not(:defined))`), step);
  }
  // The same insets as the class sheet.
  assert.match(core, /sf-accordion\[size="1\/2"\]:not\(:defined\)\) \{[^}]*--sf-accordion--box-inset: max\(var\(--sf-space-1\\\/2\), var\(--sf-b2\)\);/u);
  // Values from the systems only (C18): no raw length outside the comments.
  const rules = core.slice(core.indexOf('sf-accordion before it draws'), core.indexOf('Its menu waits for its own code'))
    .replace(/\/\*[\s\S]*?\*\//gu, '');
  assert.doesNotMatch(rules, /\b\d+(?:px|rem|em)\b/u);
});
