#!/usr/bin/env node
// The naming gate on this checkout (scripts/component-names-kit.mjs): every
// Smart tag family first, its passport family the first word, one package
// per tag. Prints one line per problem and exits 1 when there is one. The
// candidate runs it as tests/component-names.release-gate.test.mjs.
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import tagAliases from '../src/core/js/tag-aliases.generated.js';
import {checkComponentNames, readFrameworkComponents, splitOpen} from './component-names-kit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (relative) => JSON.parse(readFileSync(resolve(root, relative), 'utf8'));
const framework = readFrameworkComponents(root);
const packages = json('contracts/registry/package-tags.json');
const problems = checkComponentNames({
  registry: json('contracts/registry/names.json'),
  framework,
  packages,
  tagAliases,
});
// Listed open problems are printed too: listed, not hidden.
const {fresh, listed, gone} = splitOpen(problems, packages.open);
for (const line of listed) console.log(`open (listed in package-tags.json): ${line}`);
for (const line of fresh) console.log(`NEW: ${line}`);
for (const line of gone) console.log(`GONE (remove it from package-tags.json open): ${line}`);
console.log(`component names: ${framework.length} Framework tags, ${listed.length} open problem(s) listed, ${fresh.length} new, ${gone.length} gone`);
process.exit(fresh.length || gone.length ? 1 : 0);
