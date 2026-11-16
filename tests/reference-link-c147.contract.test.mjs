import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Owner decision C147 (2026-11-14, reference link study): the rules the
// measured behaviour rests on, so a later edit cannot drop one silently.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('src/component/reference-link/scss/_css__reference_link.scss').replace(/\/\*[\s\S]*?\*\//gu, '');
const placeholder = read('src/core/scss/_sf_css__placeholder.scss');
const template = read('src/smart/reference-link/js/templates/default.js');
const element = read('src/smart/reference-link/index.js');
const manifest = JSON.parse(read('src/smart/reference-link/component.json'));
const ru = JSON.parse(read('src/smart/reference-link/lang/ru.json'));
const en = JSON.parse(read('src/smart/reference-link/lang/en.json'));

test('two looks: inline in text beside the card; three settings added (C147 (1), (6), (8))', () => {
  assert.deepEqual(manifest.settings.appearance.values, ['card', 'inline', 'plain']);
  assert.deepEqual(manifest.settings.state.values, ['', 'missing', 'forbidden']);
  assert.equal(manifest.settings.copy.type, 'boolean');
  assert.equal(manifest.settings.copy.default, false);
  assert.match(css, /\.sf-reference-link\.sf-reference-link--inline \{\s*display: inline;/u);
  assert.match(css, /\.sf-reference-link--inline :where\(\.sf-reference-link__link\)::after \{\s*content: none;/u);
  // The icon never parts from the name: no white space between them in the template.
  assert.match(template, /\$\{iconPart\}<span class="sf-reference-link__label">/u);
});

test('a record in text: type icon one line high, 4 before the name, the number quiet and whole (C147 (2))', () => {
  assert.match(css, /\.sf-reference-link--inline :where\(\.sf-reference-link__icon, \.sf-reference-link__tab\) \{[^}]*--sf-icon--font-size: 1lh;/u);
  assert.match(css, /\.sf-reference-link--inline :where\(\.sf-reference-link__icon\) \{\s*margin-inline-end: var\(--sf-space-1\\\/4\);/u);
  assert.match(css, /__number\) \{\s*color: var\(--sf-on-surface-variant\);[^}]*white-space: nowrap;/u);
  // In text an absent icon is none; elsewhere the arrow.
  assert.match(element, /appearance'\) === 'inline' \? '' : 'arrow_forward'/u);
});

test('underline: always in text, under the pointer and on focus elsewhere (C147 (3))', () => {
  assert.match(css, /\.sf-reference-link-left > a\) \{[^}]*text-decoration-line: none;/u);
  assert.match(css, /:is\(:hover, :focus-visible\),[^{]*\{\s*text-decoration-line: underline;/u);
  assert.match(css, /\.sf-reference-link--inline :where\(\.sf-reference-link__label\) \{\s*text-decoration-line: underline;/u);
});

test('a new tab adds the sign and the words, in the page language (C147 (4))', () => {
  assert.match(template, /newTab = !gone && !disabled && Boolean\(href\) && target === '_blank'/u);
  assert.match(template, /sf-reference-link__tab sf-icon" aria-hidden="true">open_in_new</u);
  assert.equal(ru.runtime['new-tab-text'], '(откроется в новой вкладке)');
  assert.equal(en.runtime['new-tab-text'], '(opens in a new tab)');
  assert.match(css, /__tab-words\) \{\s*position: absolute;[^}]*clip-path: inset\(50%\);/u);
});

test('visited only in an opt-in region and only in text (C147 (5))', () => {
  assert.match(css, /:where\(\[data-sf-visited="on"\]\) \.sf-reference-link\.sf-reference-link--inline a\.sf-reference-link__link:visited \{\s*color: var\(--sf-link-visited\);/u);
  assert.equal((css.match(/:visited/gu) || []).length, 1);
});

test('a gone target: no link, link_off, the reason in words (C147 (6))', () => {
  assert.match(template, /const GONE_ICON = 'link_off'/u);
  assert.match(template, /href && !disabled && !gone/u);
  assert.equal(ru.runtime['missing-text'], 'удалена');
  assert.equal(ru.runtime['forbidden-text'], 'нет доступа');
  assert.match(css, /\.sf-reference-link--gone :where\([^)]*\) \{\s*color: var\(--sf-on-surface-variant\);/u);
});

test('copy is the clipboard route on the card (C147 (8)); the hover card is a hook only (C147 (7))', () => {
  assert.match(template, /data-sf-copy=\$\{copyValue\}/u);
  assert.match(template, /copyButton = copy && !inline && !size && !line && appearance !== 'plain'/u);
  assert.equal(ru.runtime['copy-label'], 'Копировать ссылку');
  assert.match(css, /__copy\) \{\s*position: absolute;\s*z-index: 1;/u);
  assert.doesNotMatch(template, /sf-popover|hover-card/u);
});

test('a long name: two lines in a card, the whole name in the Framework tooltip when cut (C147 (9))', () => {
  assert.match(css, /-webkit-line-clamp: 2;/u);
  assert.match(element, /markCutName\(\)/u);
  assert.match(element, /link\.setAttribute\('data-tooltip', surface\.id\)/u);
  assert.match(element, /'sf-tooltip sf-tooltip--dark sf-tooltip--size-1\/3/u);
});

test('the bare inline tag is a run of words before its code, not a box', () => {
  assert.match(placeholder, /:where\(sf-reference-link\[appearance="inline"\]:not\(:defined\)\):not\(:has\(> \[data-sf-static\]\)\) \{\s*display: inline;\s*block-size: auto;/u);
  assert.match(placeholder, /::before \{\s*content: attr\(label\);/u);
});
