// GB17 F1b (dispatcher decision under C401): a labels="start" form draws its labels in the read list's
// label type at every width, so the label column -- as wide as its longest label -- is the read list's
// and each control starts where the read value stood (768: 141 -> 125 before the fix).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const form = read('src/smart/form/scss/_smart__form.scss');
const list = read('src/smart/list-description/scss/_smart__list-description.scss');

test('the read list labels in the rung below at every width', () => {
  assert.match(list, /--sf-list-description--below-font-size: var\(--sf-text-size-1\\\/2\);/u);
  assert.match(list, /\.sf-list-description-label \{[^}]*font-size: var\(--sf-list-description--below-font-size\);/u);
});

test('a labels="start" form takes that type after the field label rule below 60rem', () => {
  const below = form.indexOf('@media not all and (min-width: 60rem)');
  const start = form.indexOf('.sf-form[data-labels="start"] {\n  --sf-form--label-size: var(--sf-text-size-1\\/2);');
  assert.ok(below > 0, 'the field label rule below 60rem (C153 (1)) stays for the other placements');
  assert.ok(start > 0, 'labels="start" sets the read list\'s label type');
  assert.match(form.slice(start, start + 200), /--sf-form--label-line: var\(--sf-text-height-1\\\/2\);/u);
  assert.equal(JSON.parse(read('src/smart/form/component.json')).version, '1.15.0'); // FS-6, FS-9 merged above F1b
});
