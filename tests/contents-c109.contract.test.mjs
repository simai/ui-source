// sf-contents 1.6.2: owner decision C109 point 2, NI-8 (ui-control
// control/research/2026-11-12-nested-indent.md, prototype
// prototypes/nested-indent.html). A text-only list has no column to stand
// under, so a deeper level steps in by the list's own inset, H4 of the
// horizontal-spacing standard: the value inset of C77 (12 at size 1/2 on
// every width and density, 16 at size 1, 12 compact and on a phone). It was
// --sf-space-1/2, 8 in compact and on a phone. Measured by ui-control
// evidence 2026-11-12-indent-c109.
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

test('C109 version: contents 1.6.2 or later (1.7.0: C134 layout sheet)', () => {
  assert.match(manifest.version, /^1\.(6\.([2-9]|\d{2,})|([7-9]|\d{2,})\.\d+)$/u);
  assert.equal(generated.version, manifest.version);
  assert.ok(manifest['x-decisions'].some((line) => line.startsWith('version 1.6.2 (2026-11-12, owner decision C109 point 2, NI-8)')));
});

test('NI-8: the level step is the list inset (H4), resolved where the size moves it', () => {
  const root = rule('.sf-contents');
  assert.match(root, /--sf-contents--indent: var\(--sf-contents-indent, var\(--sf-contents--value-inset\)\);/u);
  assert.doesNotMatch(sheet, /--sf-contents--indent: var\(--sf-contents-indent, var\(--sf-space-1\\\/2\)\)/u);
  // Size 1 moves the inset on the same element, so the step follows it.
  assert.match(rule('.sf-contents--size-1'), /--sf-contents--value-inset: var\(--sf-space-1\);/u);
  // The levels read the one step.
  assert.match(sheet, /\.sf-contents-item\[data-depth="1"\] \.sf-contents-text \{\s*margin-inline-start: var\(--sf-contents--indent\);/u);
  assert.match(sheet, /margin-inline-start: calc\(2 \* var\(--sf-contents--indent\)\);/u);
});

test('NI-8: the public default says the inset', () => {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      if (node.name === '--sf-contents-indent') found.push(node);
      Object.values(node).forEach(walk);
    }
  };
  walk(variables);
  assert.equal(found.length, 1);
  assert.equal(found[0].default, 'max(var(--sf-space-1\\/2), var(--sf-b2))');
});
