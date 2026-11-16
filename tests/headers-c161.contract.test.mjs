import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {paintBlocks} from './support/paint-blocks.mjs';

// Owner decision C161 (headers study, 2026-11-14; research ui-control
// control/research/2026-11-14-headers.md): what sf-header-page and
// sf-header-site promise in their interface and sources. The pages are
// measured by tests/browser/headers-c161.browser.mjs and ui-control's probe.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = JSON.parse(read('src/smart/header-page/component.json'));
const pageSource = read('src/smart/header-page/index.js');
const pageTemplate = read('src/smart/header-page/js/templates/default.js');
const pageSheet = read('src/smart/header-page/scss/_smart__page_header.scss');
const site = JSON.parse(read('src/smart/header-site/component.json'));
const siteSource = read('src/smart/header-site/index.js');
const siteTemplate = read('src/smart/header-site/js/templates/default.js');
const layers = read('src/core/js/layer-stack.js');

test('C161 (2): the page header titles at the fourth heading step', () => {
  assert.match(pageTemplate, /<h1 class="sf-page-header-heading sf-h-4 /u);
  assert.match(page.settings.heading.summary, /C161 \(2\)/u);
});

test('C161 (3), (4): the main action ends the row, «Ещё» stands right before it', () => {
  assert.match(pageSource, /orderedActions\(\)/u);
  const row = pageTemplate.slice(pageTemplate.indexOf('sf-page-header-actions'));
  assert.ok(row.indexOf('${actions.rest}') < row.indexOf('sf-page-header-more'));
  assert.ok(row.indexOf('sf-page-header-more') < row.indexOf('${actions.main}'));
  assert.equal(page.settings.overflow.default, 'more');
});

test('C161 (5): a tabs slot ends the header, its line the header edge', () => {
  assert.ok(page.slots.tabs);
  assert.ok(pageTemplate.lastIndexOf('sf-page-header-tabs') > pageTemplate.lastIndexOf('sf-page-header-actions'));
  assert.match(pageSheet, /\.sf-page-header:has\(> \.sf-page-header-tabs\) \{\s*padding-block-end: 0;/u);
  assert.match(pageSource, /'path', 'start', 'actions', 'tabs'/u);
});

test('C161 (6): the count stays for a page without a table footer', () => {
  assert.equal(page.settings.count.type, 'string');
  assert.match(page.settings.count.summary, /table footer/u);
});

test('C161 (7): sticky is a setting, off by default, raised and path folded while scrolled', () => {
  assert.deepEqual(page.settings.sticky, {...page.settings.sticky, type: 'boolean', default: false});
  assert.equal(page['host-states']['data-scrolled'], 'boolean');
  // C273: the fill in the paint block, the shadow in the component block
  assert.match(paintBlocks(pageSheet), /\[data-scrolled='true'\] > \.sf-page-header--sticky \{\s*background-color: var\(--sf-surface-raised\);/u);
  assert.match(pageSheet, /\[data-scrolled='true'\] > \.sf-page-header--sticky \{\s*box-shadow: var\(--sf-shadow-raised\);/u);
  assert.match(pageSheet, /\[data-scrolled='true'\] > \.sf-page-header--sticky > \.sf-page-header-path \{\s*display: none;/u);
});

test('C161 (8): a collapsed site bar moves language and theme into the panel settings', () => {
  assert.match(siteSource, /const SETTING_TOOLS = 'sf-language, \[theme-switch\]';/u);
  assert.match(siteTemplate, /sf-site-header-settings" role="group"/u);
  for (const lang of ['ru', 'en']) {
    const words = JSON.parse(read(`src/smart/header-site/lang/${lang}.json`)).runtime;
    for (const key of ['settings', 'language', 'theme']) assert.ok(words[key], `${lang} ${key}`);
  }
  const [major, minor] = site.version.split('.').map(Number);
  assert.ok(major === 1 && minor >= 10, site.version);
});

test('C161 (8): a control out of the Tab order is no stop of a layer trap', () => {
  assert.match(layers, /node\.tabIndex >= 0\);/u);
});
