#!/usr/bin/env node
// Every Smart tag a package element draws is required by its contract
// (scripts/package-rendered-tags-kit.mjs). Reads the package from --package
// <folder> (a release asset's smart/ folder, or ui-pro's components/src/smart),
// else UI_PRO_PACKAGE_ROOT, else ../ui-pro/components/src/smart. Prints one
// line per element and exits 1 when a drawn tag is not required.
//
//   node scripts/check-package-rendered-tags.mjs [--reference pro] [--package <folder>]
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {checkPackageRenderedTags} from './package-rendered-tags-kit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const name = argument('--reference') || 'pro';
const packageRoot = resolve(argument('--package') || process.env.UI_PRO_PACKAGE_ROOT || resolve(root, '../ui-pro/components/src/smart'));
if (!existsSync(packageRoot)) {
  console.error(`package-rendered-tags: no package at ${packageRoot} (pass --package <folder>)`);
  process.exit(2);
}
const reference = JSON.parse(readFileSync(resolve(root, `src/core/contracts/packages/${name}.package.json`), 'utf8'));
const results = checkPackageRenderedTags({root, reference, packageRoot});
let misses = 0;
for (const result of results) {
  misses += result.missing.length;
  const miss = result.missing.map(({tag, id}) => `${tag} (${id})`).join(', ');
  const unclaimed = result.unclaimed.length ? `; own or unclaimed tags: ${result.unclaimed.join(', ')}` : '';
  console.log(`${result.missing.length ? 'MISS' : 'ok  '} ${result.id}: ${result.drawn.length} tag(s) drawn in ${result.scripts} file(s)${miss ? `; not required: ${miss}` : ''}${unclaimed}`);
}
console.log(`package-rendered-tags: ${name} from ${packageRoot}: ${results.length} element(s), ${misses} miss(es)`);
process.exit(misses ? 1 : 0);
