// sf-input-choice gaps inside a card (owner C68 and C72, DEV C71, 2026-11-12):
// a quarter step from the name to the description, a wrapped badge with the
// same 4 above it, and the icon as far from the name as sf-button size 1 puts
// its text from its icon. Measured on the built bytes by ui-control evidence
// 2026-11-12-input-choice-c68-c71.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/smart/input-choice/scss/_smart__choice.scss', import.meta.url), 'utf8');
const rule = (selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, selector);
  return css.slice(at, css.indexOf('}', at));
};

test('the name and the description are a quarter step apart, as a wrapped badge and the name', () => {
  assert.match(rule('.sf-choice .sf-choice-body'), /row-gap: var\(--sf-space-1\\\/4\);/u);
  assert.match(rule('.sf-choice .sf-choice-title'), /gap: var\(--sf-space-1\\\/4\) var\(--sf-space-1\\\/3\);/u);
});

test('the icon is as far from the name as the text of sf-button size 1 from its icon', () => {
  assert.match(rule('.sf-choice .sf-choice-icon'), /margin-inline-end: calc\(var\(--sf-ui-1--text-space-x\) - var\(--sf-space-1\\\/3\)\);/u);
  const buttons = readFileSync(new URL('../src/component/buttons/scss/_css__buttons.scss', import.meta.url), 'utf8');
  assert.match(buttons, /--sf-button-text-container--padding-inline-start: var\(--sf-ui-1--text-space-x\);/u);
});
