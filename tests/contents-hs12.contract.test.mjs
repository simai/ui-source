// sf-contents 1.6.1: owner decision C77 for R191 HS-12 (ui-control
// control/research/2026-11-12-horizontal-spacing.md). The column's text and
// the open compact list's rows stand at the size's value inset, the one rule
// of fields and lists (fix/field-inset-c77: max(--sf-space-1/2, --sf-b2) at
// 1/2, --sf-space-1 at 1). Measured by ui-control evidence
// 2026-11-12-contents-hs12.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('src/smart/contents/scss/_smart__contents.scss');
const manifest = JSON.parse(read('src/smart/contents/component.json'));
const generated = JSON.parse(read('src/smart/contents/smart.manifest.json'));
const variables = JSON.parse(read('src/core/contracts/public-variables.v1.json'));

const rule = (selector) => {
  const start = sheet.indexOf(`${selector} {`);
  assert.notEqual(start, -1, selector);
  return sheet.slice(start, sheet.indexOf('}', start));
};

test('HS-12 version: contents 1.6.1 or later (1.7.x: C134)', () => {
  assert.match(manifest.version, /^1\.(6\.([1-9]\d*)|([7-9]|\d{2,})\.\d+)$/u);
  assert.equal(generated.version, manifest.version);
  assert.ok(manifest['x-decisions'].some((line) => line.startsWith('version 1.6.1 (2026-11-12, owner decision C77, R191 HS-12)')));
});

test('HS-12: size 1/2 takes the fields\' floored inset, size 1 takes --sf-space-1', () => {
  assert.match(rule('.sf-contents'), /--sf-contents--value-inset: max\(var\(--sf-space-1\\\/2\), var\(--sf-b2\)\);/u);
  assert.match(rule('.sf-contents--size-1'), /--sf-contents--value-inset: var\(--sf-space-1\);/u);
  // No phone-only rule: the floor holds on the desktop, compact and the phone.
  assert.doesNotMatch(sheet, /--sf-contents--inset: var\(--sf-contents-inset-inline, var\(--sf-space-1\\\/2\)\)/u);
});

test('HS-12: the public inset defaults to the value inset; the open list rows read it less the panel plate', () => {
  assert.match(rule('.sf-contents'), /--sf-contents--inset: var\(--sf-contents-inset-inline, var\(--sf-contents--value-inset\)\);/u);
  assert.match(sheet, /padding-inline: calc\(var\(--sf-contents--value-inset\) - var\(--sf-space-1\\\/4\)\);/u);
  assert.doesNotMatch(sheet, /padding-inline: calc\(var\(--sf-contents--space-x\) - var\(--sf-space-1\\\/4\)\);/u);
  const inset = variables.components.flatMap((c) => c.variables).find((v) => v.name === '--sf-contents-inset-inline');
  assert.equal(inset.default, 'max(var(--sf-space-1\\/2), var(--sf-b2))');
  assert.match(inset.summary, /C77/u);
});
