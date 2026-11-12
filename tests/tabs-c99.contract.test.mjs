// sf-tabs 1.3.0: the spacing of the tabs (owner decision C99, variant A of
// ui-control prototypes/tabs-study.html#q-spacing; research
// control/research/2026-11-12-tabs.md §7, TS-1..TS-9), one test per item.
// The geometry itself is measured on a build: tests/browser/tabs-geometry.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('src/component/tabs/scss/_css__tabs.scss');
const source = read('src/smart/tabs/index.js');
const template = read('src/smart/tabs/js/templates/default.js');
const variables = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
// Every rule written for exactly this selector, joined.
const rule = (selector) => {
  const blocks = [];
  for (let at = sheet.indexOf(`\n  ${selector} {`); at >= 0; at = sheet.indexOf(`\n  ${selector} {`, at + 1)) {
    blocks.push(sheet.slice(at, sheet.indexOf('}', at)));
  }
  assert.ok(blocks.length, selector);
  return blocks.join('\n');
};
const UNDERLINE = '.sf-tabs--underline > .sf-tabs-top-container > .sf-tabs-top';

test('TS-1: no tab spacing reads a raw ladder step', () => {
  assert.doesNotMatch(sheet, /--sf-tabs-top--gap: var\(--sf-tabs-gap, var\(--sf-c\d\)\)/u);
  assert.doesNotMatch(sheet, /var\(--sf-c[026]\)/u);
});

test('TS-2: line tabs stand edge to edge', () => {
  assert.match(rule(UNDERLINE), /--sf-tabs-top--gap: var\(--sf-tabs-gap, var\(--sf-space-0\)\)/u);
});

test('TS-3: a line tab has the button padding of its size and the label none', () => {
  const base = rule(`${UNDERLINE} .sf-button`);
  assert.match(base, /--sf-tabs--padding-inline: var\(--sf-tabs-padding-inline, var\(--sf-ui-1--space-x\)\)/u);
  assert.match(base, /--sf-button--padding-inline-start: var\(--sf-tabs--padding-inline\)/u);
  assert.match(base, /--sf-button--padding-inline-end: var\(--sf-tabs--padding-inline\)/u);
  assert.match(rule(`.sf-tabs--underline.sf-tabs--size-1-2 > .sf-tabs-top-container > .sf-tabs-top .sf-button`), /var\(--sf-ui-1\\\/2--space-x\)/u);
  assert.match(rule(`.sf-tabs--underline.sf-tabs--size-2 > .sf-tabs-top-container > .sf-tabs-top .sf-button`), /var\(--sf-ui-2--space-x\)/u);
  const label = rule(`${UNDERLINE} .sf-button .sf-button-text-container`);
  assert.match(label, /padding-inline: calc\(var\(--sf-px\) \* 0\)/u);
  assert.match(label, /flex: 0 1 auto/u);
});

test('TS-4: the selected line is 2 px under the letters, not the tab border', () => {
  assert.match(sheet, /--sf-button--border-bottom-width: 0;\n\s*--sf-button--border-inline-end-width: 0;/u);
  const at = sheet.indexOf('.sf-button.selected:not(:disabled):not(.disabled) > .sf-button-text-container::after,');
  assert.ok(at > 0);
  const line = sheet.slice(at, sheet.indexOf('}', at));
  assert.match(line, /position: absolute;/u);
  assert.match(line, /inset-inline: 0;/u);
  assert.match(line, /inset-block-end: calc\(var\(--sf-tabs--line-drop\) \* -1\)/u);
  assert.match(line, /border-block-end: var\(--sf-tabs-indicator-width, calc\(var\(--sf-tabs--border-width, var\(--sf-px\)\) \* 2\)\) solid var\(--sf-tabs-indicator-color, var\(--sf-primary\)\)/u);
  assert.match(sheet, /--sf-tabs--line-drop: var\(--sf-button--padding-bottom\)/u);
  // The shortened current tab clips its label; its line is drawn by the tab.
  assert.match(sheet, /\.sf-tabs-squeezed > \.sf-button > \.sf-button-text-container \{\s*position: static;/u);
});

test('TS-5: the first tab has no start padding, the last no end padding, outside fit', () => {
  assert.match(sheet, /:not\(\[data-sf-tabs-fit\]\) > \.sf-tabs-top > :first-child > \.sf-button,[^{]*\{\s*--sf-button--padding-inline-start: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(sheet, /:not\(\[data-sf-tabs-fit\]\) > \.sf-tabs-top > :last-child > \.sf-button,[^{]*\{\s*--sf-button--padding-inline-end: calc\(var\(--sf-px\) \* 0\);/u);
});

test('TS-6: the tab spacing reads only ladder variables, which compact density moves (C79)', () => {
  const spacing = sheet.slice(sheet.indexOf('// An underline tab is a control of its size'), sheet.indexOf("// The tab's own font is its size's text role"));
  assert.doesNotMatch(spacing, /\d+(?:px|rem)\b/u);
  assert.doesNotMatch(spacing, /--sf-[a-g]\d\b/u);
});

test('TS-7: a shared row keeps every padding and is shared only when the tabs fit with it', () => {
  assert.match(source, /const edgesBack = \(\) => \{/u);
  assert.match(source, /if \(!kept && this\.fitsEqually\(hosts\.length\) && !fits\(room\(\) - edgesBack\(\)\)\) \{/u);
});

test('TS-8: vertical rows are the menu column: pitch 44, inset 16, labels at the start', () => {
  assert.match(rule('.sf-tabs--vertical > .sf-tabs-top-container > .sf-tabs-top'), /--sf-tabs-top--gap: var\(--sf-tabs-gap, var\(--sf-space-1\\\/4\)\)/u);
  const tab = rule('.sf-tabs--vertical > .sf-tabs-top-container > .sf-tabs-top .sf-button');
  assert.match(tab, /--sf-button--padding-inline-start: var\(--sf-tabs-padding-inline, var\(--sf-space-1\)\)/u);
  assert.match(rule('.sf-tabs--vertical > .sf-tabs-top-container > .sf-tabs-top .sf-button .sf-button-text-container'), /padding-inline: calc\(var\(--sf-px\) \* 0\)/u);
  assert.match(template, /text-position=\$\{vertical \? 'start' : nothing\}/u);
});

test('TS-9: one public spacing variable, --sf-tabs-padding-inline', () => {
  const tabs = variables.components.find((entry) => entry.component === 'tabs');
  const padding = tabs.variables.find((variable) => variable.name === '--sf-tabs-padding-inline');
  assert.ok(padding);
  assert.equal(padding.default, 'var(--sf-ui-1--space-x)');
  assert.equal(tabs.variables.find((variable) => variable.name === '--sf-tabs-gap').default, 'var(--sf-space-0)');
  assert.ok(tabs.variables.length <= 10);
});
