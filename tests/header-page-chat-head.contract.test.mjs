import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-header-page 1.10.0: the parts SIMAI Pro's conversation head needs (C161,
// msg-c5653e75): heading-level, the heading slot, description and the media
// slot. A head that uses none of them draws the markup it drew before; the
// browser side is the manifest probe p9/p10 and ui-control's evidence
// 2026-11-19-header-page-chat-head.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = JSON.parse(read('src/smart/header-page/component.json'));
const source = read('src/smart/header-page/index.js');
const template = read('src/smart/header-page/js/templates/default.js');
const sheet = read('src/smart/header-page/scss/_smart__page_header.scss');
const core = read('src/core/scss/_sf_css__placeholder.scss');

test('the chat head settings and slots are declared, defaults unchanged', () => {
  const level = page.settings['heading-level'];
  assert.deepEqual([level.type, level.integer, level.min, level.max, level.default], ['number', true, 1, 6, 1]);
  assert.equal(page.settings.description.type, 'string');
  assert.equal(page.settings.description.default, '');
  assert.ok(page.slots.media && page.slots.heading);
  assert.deepEqual(Object.keys(page.slots), ['path', 'path-end', 'start', 'media', 'heading', 'actions', 'tabs']);
  assert.ok(page.version.localeCompare('1.10.0', undefined, {numeric: true}) >= 0);
});

test('heading level 1 without a heading slot keeps the h1 literal; any other level changes the tag only', () => {
  assert.match(template, /html`<h1 class="sf-page-header-heading sf-h-4 m-0 min-w-0 truncate">\$\{heading\}<\/h1>`/u);
  assert.match(template, /unsafeStatic\(`h\$\{headingLevel\}`\)/u);
  assert.match(template, /'sf-page-header-heading sf-page-header-heading--slot sf-h-4 /u);
  assert.match(source, /value >= 1 && value <= 6 \? value : 1/u);
});

test('description and media are drawn only when given', () => {
  assert.match(template, /const name = description\s*\? html`<div class="sf-page-header-name flex flex-col min-w-0">/u);
  assert.match(template, /<div class="sf-page-header-title flex items-cross-center min-w-0">\s*\$\{hasHostSlot\('media'\) \? html`<div class="sf-page-header-media flex items-cross-center">\$\{hostSlot\('media'\)\}<\/div>` : nothing\}\$\{name\}/u);
  assert.match(sheet, /\.sf-page-header-description \{\s*font-size: var\(--sf-text-size-1\\\/3\);\s*line-height: var\(--sf-text-height-1\\\/3\);/u);
  assert.match(sheet, /\.sf-page-header-description \{\s*color: var\(--sf-on-surface-variant\);/u);
});

test('an avatar without a size takes the line rung; a size the page wrote stays', () => {
  assert.match(source, /for \(const name of \['actions', 'start'\]\)/u);
  assert.match(source, /if \(!rung\) rung = this\.description \? '1' : '1\/2';/u);
  assert.match(source, /node\.hasAttribute\('size'\) && !node\.hasAttribute\('data-sf-page-header-size'\)/u);
});

test('core counts the description line and a written media size in the bare tag box', () => {
  assert.match(core, /\[description\]:not\(\[description=""\]\) \{\s*--sf-page-header--box-line: max\(calc\(var\(--sf-heading-4--height\) \+ var\(--sf-text-height-1\\\/3\)\)/u);
  assert.match(core, /max\(var\(--sf-page-header--box-line\), var\(--sf-page-header--box-actions\), var\(--sf-page-header--box-media\)\)/u);
});

// sf-header-page 1.12.0 (AS-2, AS-3; owner decisions C420, C324).
test('path-end stands at the end of the path row, drawn only when given; the row holds the 1/2 control height, items centred', () => {
  assert.ok(page.slots['path-end']);
  assert.match(template, /hasHostSlot\('path'\) \|\| hasHostSlot\('path-end'\)/u);
  assert.match(template, /html`<div class="sf-page-header-path-end flex items-cross-center">\$\{hostSlot\('path-end'\)\}<\/div>`/u);
  assert.match(sheet, /\.sf-page-header-path:has\(> \.sf-page-header-path-end\) \{\s*align-items: center;[^}]*min-block-size: var\(--sf-ui-1\\\/2--control-height\);/u);
  assert.match(sheet, /\.sf-page-header-path-end \{[^}]*margin-inline-start: auto;/u);
  assert.match(core, /\[slot="path-end"\][^{]*\{\s*--sf-page-header--box-path: calc\(var\(--sf-ui-1\\\/2--control-height\) \+ var\(--sf-page-header-gap, var\(--sf-space-1\\\/2\)\)\);/u);
});

test('a head without actions wraps its heading whole; with actions the ellipsis stays (HD-12)', () => {
  assert.match(template, /const wrap = !hasHostSlot\('actions'\);/u);
  assert.match(template, /html`<h1 class="sf-page-header-heading sf-h-4 m-0 min-w-0 sf-page-header-heading--wrap">\$\{heading\}<\/h1>`/u);
  assert.match(template, /wrap && !slotted \? 'sf-page-header--wrap' : ''/u);
  assert.match(sheet, /\.sf-page-header--wrap \.sf-page-header-title \{\s*align-items: last baseline;/u);
  assert.match(sheet, /\.sf-page-header-heading--wrap \{\s*overflow-wrap: anywhere;/u);
});
