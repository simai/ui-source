import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// The base property view (owner decision C180, 2026-11-14; ui-control
// control/research/2026-11-14-view-property-base.md, prototypes/
// view-property-base-study.html): no component of its own --
// sf-list-description (C33) in sf-drawer (C157), sf-modal or on a page. The
// browser half is tests/browser/property-base-c180.browser.mjs.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const sheet = read('src/smart/list-description/scss/_smart__list-description.scss');
const component = JSON.parse(read('src/smart/list-description/component.json'));
const docs = read('src/smart/list-description/docs.md');
const drawerSheet = read('src/smart/drawer/scss/_smart__drawer.scss');
const drawerJs = read('src/smart/drawer/index.js');
const rule = (selector, source = sheet) => {
  const at = source.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} has a rule`);
  return source.slice(at, source.indexOf('}', at));
};

test('C180 (1): no new component -- the base is sf-list-description in sf-drawer, sf-modal or a page', () => {
  const smart = readFileSync(join(root, 'contracts/generated/smart-component-contract-registry.json'), 'utf8');
  for (const name of ['sf-view-property', 'sf-view-property-base', 'sf-property-view']) assert.doesNotMatch(smart, new RegExp(`"${name}"`, 'u'), `${name} is not a Framework component`);
  const section = docs.slice(docs.indexOf('## Свойства записи в панели'));
  assert.ok(docs.includes('## Свойства записи в панели'), 'the docs show the list in a panel (study VB-8)');
  assert.match(section, /<sf-drawer[^>]*heading=/u);
  assert.match(section, /slot="header-action"/u);
  assert.match(section, /sf-modal/u);
});

test('C180 (2): the panel head is one row -- title, one icon action, sf-button-close inside, a button group apart; the foot only for more', () => {
  assert.match(drawerJs, /<slot name="header-action"|slot="header-action"|header-action/u, 'sf-drawer has a place for one head action');
  assert.match(drawerJs, /<sf-button-close/u, 'the close is sf-button-close (C14)');
  const head = rule('.sf-drawer-head', drawerSheet);
  assert.match(head, /gap: var\(--sf-space-1\\\/3\);/u, 'the head buttons are a button group apart (8, compact 4)');
  assert.match(rule('.sf-drawer-title', drawerSheet), /font-size: var\(--sf-heading-4--size\);/u, 'the title is the window title step (C157 (7) = C159 (5))');
  const section = docs.slice(docs.indexOf('## Свойства записи в панели'));
  assert.match(section, /slot="footer"/u);
  assert.match(section, /больше одного/u);
});

test('C180 (3): layout auto puts a label beside its value from a list wider than 20rem; a phone stacks; one label size', () => {
  assert.match(sheet, /@container \(max-width: #\{mq\.container-step\(g0\)\}\) \{\s*@include list-description-stacked-auto;/u, 'auto stacks at the ladder step g0 (a 20rem panel), not g2');
  assert.doesNotMatch(sheet, /container-step\(g2\)/u, 'the 24rem step no longer stacks a 24rem panel');
  assert.match(sheet, /@media not all and \(min-width: map\.get\(bp\.\$breakpoint-array, md\)\) \{\s*@include list-description-stacked-auto;/u, 'on a phone (below md) a label is always over its value');
  assert.match(rule('.sf-list-description-label'), /font-size: var\(--sf-list-description--below-font-size\);/u, 'the label is the rung below in every layout');
  assert.match(component.settings.layout.summary, /20rem/u);
});

test('C180 (4): on a phone a side panel is the whole screen without corners (C157 (4))', () => {
  const phone = drawerSheet.slice(drawerSheet.indexOf('@media not all and (min-width: map.get(bp.$breakpoint-array, md))'));
  const panel = phone.slice(0, phone.indexOf('}'));
  assert.match(panel, /inline-size: 100%;/u);
  assert.match(panel, /border-radius: 0;/u);
});

test('C180 (5): long values wrap whole, mono by characters; cut only with overflow="truncate"', () => {
  assert.equal(component.settings.overflow.default, 'wrap');
  assert.match(rule('.sf-list-description-text'), /overflow-wrap: anywhere;/u);
  assert.match(rule('.sf-list-description-text--mono'), /word-break: break-all;/u);
  assert.match(rule('.sf-list-description--truncate .sf-list-description-text'), /text-overflow: ellipsis;/u);
});
