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
  assert.ok(template.includes('@input=${(event) => context.component.handleInputInput(event)}'));

  const source = await read('src/smart/datepicker/index.js');
  // A range stays on the grid: one field holding two dates has no single format
  // to read back, so `range` makes the field read-only. So does a field the host
  // declares read-only; a disabled one cannot be typed in either.
  assert.match(source, /get readonly\(\) \{\s*return this\.range \|\| this\.getBooleanAttr\('readonly', false\);/u);
  assert.match(source, /get typed\(\) \{\s*return !this\.readonly && !this\.disabled;/u);
  // The template reads the value the component resolves: `!this.typed` also
  // counted `disabled`, so a range or disabled field drew read-only while
  // `readonly` said false (template-context probe, rel135).
  assert.ok(source.includes('readonly: this.readonly,'));
  assert.ok(!source.includes('readonly: !this.typed'));
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

// The field's own change carries the display text. Left to bubble, a host
// reading event.target.value on a change from sf-datepicker would store
// «14.10.2026» where it expects the ISO value -- and before typing was possible
// no native change could ever leave the component.
test('the field keeps its native change and input to itself', async () => {
  const source = await read('src/smart/datepicker/index.js');
  assert.match(source, /if \(event\?\.type === 'change'\) event\.stopPropagation\(\);/u);
  assert.match(source, /handleInputInput\(event\) \{\s*if \(this\.typed\) event\?\.stopPropagation\?\.\(\);/u);
  // The change a host listens for is still the component's own, said once.
  assert.ok(source.includes('this.emitChange();'));
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

// A date set by the `value` attribute could not be cleared: the getter read
// `date || value`, and clearing removes `date`, so the attribute came back and
// the change said the old date -- which broke clearing in the field set's date
// editor too. `value` is the initial value; a present `date`, even empty, wins.
test('a value set by the attribute can be cleared', async () => {
  const source = await read('src/smart/datepicker/index.js');
  assert.match(source, /get date\(\) \{\s*if \(this\.hasAttribute\('date'\)\) return this\.getAttribute\('date'\) \|\| '';\s*return this\.getAttribute\('value'\) \|\| '';/u);
  assert.doesNotMatch(source, /this\.getAttribute\('date'\) \|\| this\.getAttribute\('value'\)/u);
  const start = source.indexOf('setState(nextState = {}, callback = null) {');
  assert.ok(start > 0, 'the component keeps a cleared date');
  const body = source.slice(start, source.indexOf('\n    }\n', start));
  assert.ok(body.includes('super.setState(nextState, callback);'));
  assert.match(body, /if \(clears && this\.hasAttribute\('value'\)\) this\.setAttribute\('date', ''\);/u);
  const manifest = JSON.parse(await read('src/smart/datepicker/smart.manifest.json'));
  assert.match(manifest.inputs.properties.value.description, /initial value/u);
});

// «20.11.202630.10.2026» -- two dates glued by a paste -- was read as the date
// 202630-11-20: the parser took the first three runs of digits. Typed text is
// now one whole date in the format, with a four-digit year from 1000 to 9999.
test('typed text is one whole date in the format, never a different date', async () => {
  const source = await read('src/smart/datepicker/index.js');
  assert.match(source, /const MIN_YEAR = 1000;\s*const MAX_YEAR = 9999;/u);
  assert.ok(source.includes('new RegExp(`^${source}$`)'), 'the pattern is anchored at both ends');
  assert.doesNotMatch(source, /text\.match\(\/\\d\+\/g\)/u, 'no loose digit scan');
  // Load the parser alone and run it.
  const code = `${source.match(/const ISO_DATE_RE = .*;/u)[0]}\n`
    + `${source.slice(source.indexOf('function isValidDate'), source.indexOf('function normalizeMonth('))}\nexport {parseDateValue};`;
  const parser = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  const parse = (text, format) => {
    const date = parser.parseDateValue(text, format);
    return date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : null;
  };
  assert.equal(parse('20.11.2026'), '2026-11-20');
  assert.equal(parse('2026-11-20'), '2026-11-20');
  assert.equal(parse('20/11/2026'), '2026-11-20');
  assert.equal(parse('1.2.2026'), '2026-2-1');
  assert.equal(parse('20.11.26', 'DD.MM.YY'), '2026-11-20');
  assert.equal(parse('11/20/2026', 'MM/DD/YYYY'), '2026-11-20');
  for (const wrong of ['20.11.202630.10.2026', '20.11.2026 - 30.10.2026', '20.11.99999', '20.11.0999', '0999-01-01',
    '20.11.2026 x', '31.02.2026', '20.11.____', '2026']) {
    assert.equal(parse(wrong), null, wrong);
  }
});
