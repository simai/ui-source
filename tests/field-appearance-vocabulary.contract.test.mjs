import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

/* One look vocabulary for every field (dispatcher decision 2026-11-17 on the
   Larena record forms letter msg-9e7b5015; FM-9): every field names its look
   on appearance, bordered (the default) or filled, so a record form gives one
   look to a text field, a select, a date and a number. Former names --
   sf-dropdown's outlined and sf-input-date's input-type -- keep working until
   2027-01-01, noted in SF.deprecations and said once per page in the console.
   tests/browser/field-appearance-vocabulary.browser.mjs draws them. */
const axes = json('contracts/public-api-axes.json');
const vocabulary = axes.field_appearance;

test('field looks: one list, bordered first and the default', () => {
  assert.deepEqual(vocabulary.vocabulary, ['bordered', 'filled']);
  assert.equal(vocabulary.default, 'bordered');
  assert.deepEqual(vocabulary.aliases, {outlined: 'bordered'});
  for (const name of ['input', 'input-textarea', 'input-quantity', 'input-lookup', 'input-rich', 'input-code', 'dropdown', 'input-date']) {
    assert.ok(vocabulary.components.includes(name), `${name} is a field with a look`);
  }
});

test('field looks: every field offers bordered and filled on appearance, bordered by default', () => {
  for (const name of vocabulary.components) {
    const declared = json(`src/smart/${name}/smart.manifest.json`).inputs.properties.appearance;
    assert.ok(declared, `${name} declares appearance`);
    for (const word of vocabulary.vocabulary) assert.ok(declared.enum.includes(word), `${name} offers ${word}`);
    assert.equal(declared.default, 'bordered', `${name} is bordered by default`);
    // A look of its own beside the two, only where recorded.
    const extras = declared.enum.filter((word) => !vocabulary.vocabulary.includes(word));
    assert.deepEqual(extras, vocabulary.extras[name] ?? [], `${name}: no other look than the recorded extras`);
    // A former name is answered, never offered.
    for (const former of Object.keys(vocabulary.aliases)) assert.ok(!declared.enum.includes(former), `${name} does not offer ${former}`);
  }
});

test('field looks: sf-dropdown answers outlined as bordered and says it once', () => {
  const source = read('src/smart/dropdown/index.js');
  assert.match(source, /valueAliases: \{bordered: \['outlined'\]\}/u);
  assert.match(source, /sayFieldAppearanceFormer\('sf-dropdown', \{from: 'outlined', to: 'bordered'/u);
  const row = json('src/smart/dropdown/aliases.json').aliases.find((one) => one.kind === 'value' && one.from === 'outlined');
  assert.deepEqual([row.to, row.setting, row.remove_after], ['bordered', 'appearance', '2027-01-01']);
});

test('field looks: sf-input-date takes appearance, input-type its dated former name', () => {
  const manifest = json('src/smart/input-date/component.json');
  assert.deepEqual(manifest.settings.appearance.values, ['bordered', 'filled']);
  assert.equal(manifest.settings.appearance.default, 'bordered');
  assert.match(manifest.settings['input-type'].summary, /^Legacy name for appearance, honoured until 2027-01-01/u);
  const row = json('src/smart/input-date/aliases.json').aliases.find((one) => one.from === 'input-type');
  assert.deepEqual([row.to, row.kind, row.remove_after, row.shim], ['appearance', 'attribute', '2027-01-01', 'none']);
  const source = read('src/smart/input-date/index.js');
  // appearance wins; input-type is read only without it, and said.
  assert.match(source, /get appearance\(\) \{\s+if \(this\.hasAttribute\('appearance'\)\)/u);
  assert.match(source, /if \(this\.hasAttribute\('input-type'\)\) \{\s+sayFieldAppearanceFormer\('sf-input-date', \{kind: 'attribute', from: 'input-type', to: 'appearance'/u);
  assert.match(source, /get inputType\(\) \{\s+return this\.appearance;/u);
  // The field it draws takes the resolved look.
  assert.match(read('src/smart/input-date/js/templates/default.js'), /appearance=\$\{context\.inputType\}/u);
});

test('field looks: each former name has a dated journal record', () => {
  const journal = json('contracts/changes/journal.json').records;
  for (const former of [...vocabulary.former_settings, ...vocabulary.former_values]) {
    const record = journal.find((one) => one.id === former.journal);
    assert.ok(record, `${former.journal} is recorded`);
    assert.equal(record.remove_after, '2027-01-01');
    assert.equal(record.stage, 'compat');
    assert.ok(record.items.some((item) => item.from === former.from && item.to === former.to), `${former.journal}: ${former.from} -> ${former.to}`);
  }
});

test('field looks: a former name is noted every time and said once per page', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    const {sayFieldAppearanceFormer, FIELD_APPEARANCES} = await import('../src/smart/helpers/field-appearance.js');
    assert.deepEqual([...FIELD_APPEARANCES], vocabulary.vocabulary);
    globalThis.SF?.deprecations?.clear?.();
    for (let i = 0; i < 3; i += 1) {
      sayFieldAppearanceFormer('sf-dropdown', {from: 'outlined', to: 'bordered', journal: 'value-dropdown-appearance-outlined-to-bordered'});
      sayFieldAppearanceFormer('sf-input-date', {kind: 'attribute', from: 'input-type', to: 'appearance'});
    }
    assert.equal(warnings.length, 2, 'one warning per component and name');
    assert.match(warnings[0], /sf-dropdown: appearance="outlined" is a former name until 2027-01-01; write appearance="bordered"/u);
    assert.match(warnings[1], /sf-input-date: input-type is a former name until 2027-01-01; write appearance/u);
    const notes = globalThis.SF.deprecations.list();
    const outlined = notes.find((note) => note.component === 'sf-dropdown' && note.from === 'outlined');
    assert.equal(outlined.count, 3, 'every use is noted');
    assert.equal(outlined.remove_after, '2027-01-01');
  } finally {
    console.warn = original;
  }
});
