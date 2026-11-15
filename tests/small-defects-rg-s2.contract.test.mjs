// Small defects of the Smart register, round 2 (RG-S2-10, RG-S2-15, RG-S2-26) and
// sf-segmented's buttons look: what the sources and passports promise.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = (relative) => readFile(path.resolve(root, relative), 'utf8');
const json = async (relative) => JSON.parse(await text(relative));

test('RG-S2-10: every sf-help-mark setting carries a description in its passport (D09)', async () => {
  const component = await json('src/smart/help-mark/component.json');
  for (const name of ['heading', 'size', 'placement']) {
    assert.ok(String(component.settings[name].summary ?? '').trim(), `component.json ${name} has a summary`);
  }
  const manifest = await json('src/smart/help-mark/smart.manifest.json');
  const empty = Object.entries(manifest.inputs.properties).filter(([, input]) => !String(input.description ?? '').trim()).map(([name]) => name);
  assert.deepEqual(empty, [], 'no manifest input without a description');
});

test('RG-S2-15: the password reveal is named by its next action and carries no aria-pressed (C12 (3), C123 (4))', async () => {
  const template = await text('src/smart/input/js/templates/default.js');
  const reveal = template.slice(template.indexOf('class="sf-field-action sf-input-reveal"'));
  const button = reveal.slice(0, reveal.indexOf('</button>'));
  assert.doesNotMatch(button, /aria-pressed/u, 'the reveal has no aria-pressed');
  assert.match(template, /revealed\s*\?\s*context\.component\?\.sfWord\?\.\('conceal'\) \|\| 'Hide password'\s*:\s*context\.component\?\.sfWord\?\.\('reveal'\) \|\| 'Show password'/u);
  const ru = await json('src/smart/input/lang/ru.json');
  const en = await json('src/smart/input/lang/en.json');
  assert.equal(ru.runtime.reveal, 'Показать пароль');
  assert.equal(ru.runtime.conceal, 'Скрыть пароль');
  assert.equal(en.runtime.reveal, 'Show password');
  assert.equal(en.runtime.conceal, 'Hide password');
});

test('RG-S2-26: chips="wrap|row" is a final name (C174 (5)); create keeps its PROVISIONAL value names', async () => {
  const component = await json('src/smart/input-lookup/component.json');
  assert.doesNotMatch(component.settings.chips.summary, /PROVISIONAL/u);
  const manifest = await json('src/smart/input-lookup/smart.manifest.json');
  assert.doesNotMatch(manifest.inputs.properties.chips.description, /PROVISIONAL/u);
  assert.match(component.settings.create.summary, /PROVISIONAL/u);
});

test('sf-segmented buttons look tells sf-button on-surface for secondary; the track keeps secondary', async () => {
  const template = await text('src/smart/segmented/js/templates/default.js');
  assert.match(template, /const BUTTON_SCHEME = \{secondary: 'on-surface'\};/u);
  assert.match(template, /scheme=\$\{selected \? BUTTON_SCHEME\[context\.scheme\] \?\? context\.scheme : 'on-surface'\}/u);
  assert.match(template, /segmented \? `sf-button-group--\$\{context\.scheme\}` : ''/u, 'the track class keeps the segmented scheme');
});
