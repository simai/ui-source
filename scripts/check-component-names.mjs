#!/usr/bin/env node
// The naming gate on this checkout (scripts/component-names-kit.mjs): every
// Smart tag family first, its passport family the first word, one package
// per tag. Prints one line per problem and exits 1 when there is one. The
// candidate runs it as tests/component-names.release-gate.test.mjs.
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import tagAliases from '../src/core/js/tag-aliases.generated.js';
import {checkComponentNames, readFrameworkComponents} from './component-names-kit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (relative) => JSON.parse(readFileSync(resolve(root, relative), 'utf8'));
const framework = readFrameworkComponents(root);
const problems = checkComponentNames({
  registry: json('contracts/registry/names.json'),
  framework,
  packages: json('contracts/registry/package-tags.json'),
  tagAliases,
});
for (const line of problems) console.log(line);
console.log(`component names: ${framework.length} Framework tags, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
