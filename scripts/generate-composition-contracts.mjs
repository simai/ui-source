#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { VALUE_TYPES } from '../src/core/js/composition/routing.mjs';
import { fieldKindRegistry } from '../src/core/js/composition/fields.mjs';
import { stableStringify } from '../src/core/js/composition/index.mjs';
import { schemaFields } from '../src/core/js/composition/schema-name.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'src/core/contracts/composition-types.v1.json');
const editorOutputPath = resolve(root, 'src/core/contracts/composition-editor-manifests.v1.json');
const portOutputPath = resolve(root, 'src/core/contracts/composition-ports.v1.json');
const kindOutputPath = resolve(root, 'src/core/contracts/composition-editor-field-kinds.v1.json');
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
  entries: BUILTIN_PORT_MANIFESTS,
})), null, 2)}\n`;
const kindOutput = `${JSON.stringify(fieldKindRegistry(), null, 2)}\n`;
const current = (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };

if (process.argv.includes('--check')) {
  if (current(outputPath) !== output || current(editorOutputPath) !== editorOutput || current(portOutputPath) !== portOutput || current(kindOutputPath) !== kindOutput) {
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
  process.stdout.write(`${outputPath}\n${editorOutputPath}\n${portOutputPath}\n${kindOutputPath}\n`);
}
