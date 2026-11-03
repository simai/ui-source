#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { VALUE_TYPES, valueTypeName } from '../src/core/js/composition/routing.mjs';
import { fieldKindRegistry } from '../src/core/js/composition/fields.mjs';
import { EDITOR_FIELD_WORDS, EDITOR_WORDS_OWNER } from '../src/core/js/composition/editor-words.mjs';
import { stableStringify } from '../src/core/js/composition/index.mjs';
import { schemaFields } from '../src/core/js/composition/schema-name.mjs';
import { BUILTIN_CATALOGUE, CATALOGUE_GROUPS, CATALOGUE_TABS } from '../src/core/js/composition/catalogue.mjs';
import { BINDING_STATES, DATA_SHAPES, SOURCE_PORT } from '../src/core/js/composition/data.mjs';
import { UTILITY_BREAKPOINTS } from '../src/core/js/composition/utilities.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'src/core/contracts/composition-types.v1.json');
const editorOutputPath = resolve(root, 'src/core/contracts/composition-editor-manifests.v1.json');
const portOutputPath = resolve(root, 'src/core/contracts/composition-ports.v1.json');
const kindOutputPath = resolve(root, 'src/core/contracts/composition-editor-field-kinds.v1.json');
const wordsOutputPath = resolve(root, 'src/core/contracts/composition-editor-words.v1.json');
// The one block editor's tables (2026-11-03), for a host without JavaScript:
// the catalogue groups and where the SIMAI Framework's types stand, the data
// shapes with the states a data block draws and the source port's requests,
// and the breakpoints a layout parameter is held by.
const blocksOutputPath = resolve(root, 'src/core/contracts/composition-blocks.v1.json');
const output = `${JSON.stringify(JSON.parse(stableStringify({
  ...schemaFields('simai.composition.type-registry', 1),
  entries: BUILTIN_TYPE_MANIFESTS,
})), null, 2)}\n`;
const editorOutput = `${JSON.stringify(JSON.parse(stableStringify({
  ...schemaFields('simai.composition.editor-manifest-registry', 1),
  entries: BUILTIN_EDITOR_MANIFESTS,
})), null, 2)}\n`;

const portOutput = `${JSON.stringify(JSON.parse(stableStringify({
  ...schemaFields('simai.composition.port-registry', 1),
  value_types: Object.fromEntries(Object.entries(VALUE_TYPES).map(([name, type]) => [name, { summary: type.summary, schema: type.schema }])),
  // The bare name each type is read by (value-types-without-version): the
  // keys above keep the older labels so a reader keyed by them still finds them.
  value_type_names: Object.fromEntries(Object.keys(VALUE_TYPES).map((label) => [valueTypeName(label), label])),
  entries: BUILTIN_PORT_MANIFESTS,
})), null, 2)}\n`;
const kindOutput = `${JSON.stringify(fieldKindRegistry(), null, 2)}\n`;
// The words of the built-in editor manifests, for a host without JavaScript:
// the same keys renderFieldFallback reads from messages.
const wordsOutput = `${JSON.stringify(JSON.parse(stableStringify({
  ...schemaFields('simai.composition.editor-words', 1),
  owner: EDITOR_WORDS_OWNER,
  words: EDITOR_FIELD_WORDS,
})), null, 2)}\n`;
const blocksOutput = `${JSON.stringify(JSON.parse(stableStringify({
  ...schemaFields('simai.composition.blocks', 1),
  catalogue: { groups: CATALOGUE_GROUPS, tabs: CATALOGUE_TABS, builtin: BUILTIN_CATALOGUE },
  utilities: { keyword: 'x-simai-utility', breakpoints: UTILITY_BREAKPOINTS, modifiers_extension: 'simai.composition:modifiers' },
  data: { shapes: DATA_SHAPES, states: BINDING_STATES, extension: 'simai.composition:data', runtime_owner: 'section', source_port: SOURCE_PORT },
  composed: { extension: 'simai.composition:composed', renderer: 'composed', text_path: '<node id>/<field>' },
})), null, 2)}\n`;
const current = (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };

if (process.argv.includes('--check')) {
  if (current(outputPath) !== output || current(editorOutputPath) !== editorOutput || current(portOutputPath) !== portOutput || current(kindOutputPath) !== kindOutput || current(wordsOutputPath) !== wordsOutput || current(blocksOutputPath) !== blocksOutput) {
    process.stderr.write('composition_contract_registry_drift\n');
    process.exitCode = 1;
  } else {
    process.stdout.write('composition contracts are current\n');
  }
} else {
  writeFileSync(outputPath, output);
  writeFileSync(editorOutputPath, editorOutput);
  writeFileSync(portOutputPath, portOutput);
  writeFileSync(kindOutputPath, kindOutput);
  writeFileSync(wordsOutputPath, wordsOutput);
  writeFileSync(blocksOutputPath, blocksOutput);
  process.stdout.write(`${outputPath}\n${editorOutputPath}\n${portOutputPath}\n${kindOutputPath}\n${wordsOutputPath}\n${blocksOutputPath}\n`);
}
