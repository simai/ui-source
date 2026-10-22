import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

// A date could not be typed at all: the field was rendered with a hard
// `readonly` and no attribute lifted it, so every host that edits a date had to
// pick one on the grid -- and the mask properties beside it reached a field
// nobody could type in (Larena storage QA, 2026-10-22).
test('the date field is read-only only where it has to be', async () => {
  const template = await read('src/smart/datepicker/js/templates/default.js');
  assert.ok(template.includes('?readonly=${context.readonly}'));
  assert.doesNotMatch(template, /mask-options=\$\{context\.maskOptions \|\| nothing\} readonly/u);
  assert.ok(template.includes('@change=${(event) => context.component.handleInputChange(event)}'));

  const source = await read('src/smart/datepicker/index.js');
  // A range stays on the grid: one field holding two dates has no single format
  // to read back. So does a field the host declares read-only, and a disabled one.
  assert.match(source, /get typed\(\) \{\s*return !this\.range && !this\.readonly && !this\.disabled;/u);
  assert.ok(source.includes('readonly: !this.typed,'));
});

test('typed text is read through the declared format, and a typo keeps the value', async () => {
  const source = await read('src/smart/datepicker/index.js');
  const start = source.indexOf('handleInputChange(event) {');
  assert.ok(start > 0, 'the field must answer a change');
  const body = source.slice(start, source.indexOf('handleInputClick(event) {'));
  // The same parser the component reads its own value with, so an ISO date and
  // the declared format both land.
  assert.ok(body.includes('parseDateValue(text, this.format)'));
  // Out of the allowed range is not a date either.
  assert.ok(body.includes('this.setMinDate()') && body.includes('this.setMaxDate()'));
  assert.match(body, /if \(!date \|\| outOfRange\) \{\s*restore\(\);/u);
  // An emptied field clears the value; a typo does not.
  assert.match(body, /if \(!text\) \{[\s\S]*?this\.setState\(\{date: '', context: ''\}\);[\s\S]*?this\.emitChange\(\);/u);
  // A date that parses moves the state and says so once.
  assert.match(body, /date: value,[\s\S]*?this\.emitChange\(\);/u);
});

test('Enter commits what was typed and the space bar belongs to the text', async () => {
  const source = await read('src/smart/datepicker/index.js');
  const start = source.indexOf('handleInputKeydown(event) {');
  const body = source.slice(start, source.indexOf('handleDayKeydown(event, day) {'));
  assert.match(body, /if \(this\.typed\) \{[\s\S]*?event\.key !== 'ArrowDown' && event\.key !== 'Enter'/u);
  assert.match(body, /if \(event\.key === 'Enter'\) \{\s*this\.handleInputChange\(event\);/u);
  // A read-only field keeps the keys it had: ArrowDown, Enter and Space open the grid.
  assert.ok(body.includes("if (!['ArrowDown', 'Enter', ' '].includes(event.key)) return;"));
});

test('the new behaviour is declared and documented', async () => {
  const manifest = JSON.parse(await read('src/smart/datepicker/smart.manifest.json'));
  assert.equal(manifest.inputs.properties.readonly?.default, false);
  assert.ok(manifest.inputs.properties.readonly?.description.includes('grid'));
  const guide = await read('src/smart/datepicker/docs/smart-datepicker-guide.md');
  assert.ok(guide.includes('## A date can be typed'));
  assert.ok(guide.includes('`readonly`'));
});
