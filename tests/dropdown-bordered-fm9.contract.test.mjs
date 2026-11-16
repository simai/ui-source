import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8');
const json = async (path) => JSON.parse(await read(path));

/* FM-9 (dispatcher decision 2026-11-16): the field look is named bordered in
   every field. sf-dropdown said outlined for the same look; it takes bordered
   (the default, drawn as before) and keeps outlined as a dated alias until
   2027-01-01, noted once in SF.deprecations. The Framework's own writers of a
   dropdown write bordered. */
test('FM-9: sf-dropdown names its field look bordered', async () => {
  const manifest = await json('src/smart/dropdown/smart.manifest.json');
  assert.deepEqual(manifest.inputs.properties.appearance.enum, ['filled', 'bordered']);
  assert.equal(manifest.inputs.properties.appearance.default, 'bordered');
  for (const name of ['input', 'input-textarea', 'input-lookup', 'input-rich']) {
    const other = await json(`src/smart/${name}/smart.manifest.json`);
    assert.ok(other.inputs.properties.appearance.enum.includes('bordered'), `${name} says bordered too`);
  }
});

test('FM-9: outlined is a dated alias of bordered until 2027-01-01', async () => {
  const aliases = await json('src/smart/dropdown/aliases.json');
  const row = aliases.aliases.find((entry) => entry.kind === 'value' && entry.from === 'outlined');
  assert.ok(row, 'an alias row for outlined');
  assert.deepEqual([row.to, row.setting, row.remove_after], ['bordered', 'appearance', '2027-01-01']);
  const journal = await json('contracts/changes/journal.json');
  const record = journal.records.find((entry) => entry.id === 'value-dropdown-appearance-outlined-to-bordered');
  assert.ok(record, 'the change journal records it');
  assert.equal(record.remove_after, '2027-01-01');
  const source = await read('src/smart/dropdown/index.js');
  assert.match(source, /appearance: \{default: 'bordered', values: \['filled', 'bordered'\], aliases: \['type'\], valueAliases: \{bordered: \['outlined'\]\}\}/);
});

test('FM-9: bordered draws the class markup\'s outlined look', async () => {
  const template = await read('src/smart/dropdown/js/templates/default.js');
  assert.match(template, /const LOOK_CLASS = Object\.freeze\(\{bordered: "outlined", outlined: "outlined", filled: "filled"\}\);/);
  assert.match(template, /`sf-dropdown--\$\{LOOK_CLASS\[look\] \|\| look\}`/);
});

test('FM-9: the Framework writes bordered on its dropdowns', async () => {
  for (const path of ['src/smart/field-renderers/index.js', 'src/smart/language/js/templates/default.js', 'src/smart/pagination/js/templates/default.js']) {
    const source = await read(path);
    const dropdowns = [...source.matchAll(/<sf-dropdown\b[^>]*?>/gs)].map((match) => match[0]);
    assert.ok(dropdowns.length > 0, path);
    for (const tag of dropdowns) assert.doesNotMatch(tag, /appearance="outlined"/, `${path} writes bordered`);
  }
});
