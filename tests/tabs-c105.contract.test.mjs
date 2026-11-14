// sf-tabs 1.3.1: horizontal spacing by owner decision C105 (R229 spacing audit
// T1, T3, T6, T8). The geometry is measured on a build by the C105 audit gate;
// these tests hold the rules that give it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('src/component/tabs/scss/_css__tabs.scss');
const rule = (selector) => {
  const at = sheet.indexOf(`\n  ${selector} {`);
  assert.ok(at >= 0, selector);
  return sheet.slice(at, sheet.indexOf('}', at));
};
const LOOKS = ':is(.sf-tabs--underline, .sf-tabs--vertical) > .sf-tabs-top-container > .sf-tabs-top .sf-button';

test('T1 / T3: a line or vertical tab keeps the button icon gap of its size (H1)', () => {
  assert.match(rule(`.sf-tabs${LOOKS}`), /column-gap: var\(--sf-tabs--icon-gap, var\(--sf-ui-1--text-space-x\)\);/u);
  assert.match(rule(`.sf-tabs.sf-tabs--size-1-2${LOOKS}`), /--sf-tabs--icon-gap: var\(--sf-ui-1\\\/2--text-space-x\);/u);
  assert.match(rule(`.sf-tabs.sf-tabs--size-2${LOOKS}`), /--sf-tabs--icon-gap: var\(--sf-ui-2--text-space-x\);/u);
});

test('C99 stays: the line label has no padding of its own', () => {
  assert.match(rule('.sf-tabs--underline > .sf-tabs-top-container > .sf-tabs-top .sf-button .sf-button-text-container'), /padding-inline: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(rule('.sf-tabs--vertical > .sf-tabs-top-container > .sf-tabs-top .sf-button .sf-button-text-container'), /padding-inline: calc\(var\(--sf-px\) \* 0\);/u);
});

test('T6: plates stand a neighbour step apart (H5)', () => {
  assert.match(rule('.sf-tabs--pills > .sf-tabs-top-container > .sf-tabs-top'), /--sf-tabs-top--gap: var\(--sf-tabs-gap, var\(--sf-space-1\\\/4\)\);/u);
});

test('T8: «Ещё» with errors: badge a quarter step after the label, chevron the icon gap after the badge', () => {
  assert.match(rule('.sf-tabs-more > .sf-button:has(> .sf-tabs-more-errors) > .sf-button-text-container'), /--sf-button-text-container--padding-inline-end: calc\(var\(--sf-px\) \* 0\);/u);
  for (const [size, token] of [['1\\/2', '1\\/2'], ['1', '1'], ['2', '2']]) {
    const blocks = sheet.split(`\n  .sf-tabs-more > .sf-button.sf-button--size-${size} > .sf-badge.sf-tabs-more-errors {`).slice(1).map((one) => one.slice(0, one.indexOf('}')));
    assert.ok(blocks.some((one) => one.includes(`margin-inline-end: var(--sf-ui-${token}--text-space-x);`)), size);
  }
  assert.match(rule('.sf-tabs-errors,\n  .sf-tabs-more-errors'), /margin-inline-start: var\(--sf-space-1\\\/4\);/u);
});
