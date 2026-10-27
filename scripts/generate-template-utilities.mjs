#!/usr/bin/env node
// Usage: node scripts/generate-template-utilities.mjs [--check]
//
// The utility classes each Smart component's templates write, by load rule:
// src/core/js/template-utilities.generated.json, {"cl-tabs": ["display/default",
// ...]}. The Loader adds them to the component's relations, so the utilities a
// template draws with are asked for in the wave that asks for the component --
// they used to arrive after it rendered, the page drawn once without them
// (simai.interaction-rules, assets-asked-together; a measured page asked for
// them in a sixth wave, 2026-10-18).
//
// A token counts when a default-variant utility rule (src/utility/<name>/
// default/rule.js) matches it exactly; responsive and state variants are found
// by the Loader on the page as before. With --check nothing is written and the
// exit code says whether the file is current.
import {readFileSync, readdirSync, existsSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
const output = join(root, 'src/core/js/template-utilities.generated.json');

// Read rule files the way the Loader's bundle runs them: each assigns into
// SF.RuleLoader.
const readRules = (files) => {
  const SF = {RuleLoader: {}};
  for (const file of files) vm.runInNewContext(readFileSync(file, 'utf8'), {SF, RegExp});
  return SF.RuleLoader;
};
const utilityFiles = readdirSync(join(root, 'src/utility'), {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(root, 'src/utility', entry.name, 'default/rule.js'))
  .filter((file) => existsSync(file));
const utilities = Object.entries(readRules(utilityFiles)).filter(([, rule]) => rule instanceof RegExp);

const sources = (folder) => {
  const files = [join(folder, 'index.js')];
  const templates = join(folder, 'js/templates');
  if (existsSync(templates)) for (const name of readdirSync(templates)) if (/\.m?js$/u.test(name)) files.push(join(templates, name));
  return files.filter((file) => existsSync(file));
};
// Class-like tokens of the source, comments cut out. Read loosely on purpose: a
// word that also names a utility (hidden, block) adds a small stylesheet to the
// wave that is going out anyway, while a class missed is the late wave this
// file exists to remove.
const tokensOf = (source) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1 ');
  return new Set(code.match(/[a-z][a-z0-9-]*(?:[/.][a-z0-9-]+)*/gu) ?? []);
};

const map = {};
const smartRoot = join(root, 'src/smart');
for (const folder of readdirSync(smartRoot, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
  const ruleFile = join(smartRoot, folder, 'rule.js');
  if (!existsSync(ruleFile)) continue;
  // A folder renamed by standard 1.3.8 §3, §21 keeps its former bundle name as
  // a forwarding rule with no tags (src/smart/input/rule.js: cl-inputs); the
  // element's own rule is the one that names tags.
  const names = Object.entries(readRules([ruleFile])).filter(([, rule]) => rule?.tags?.length).map(([name]) => name);
  if (names.length !== 1) continue;
  const tokens = new Set();
  for (const file of sources(join(smartRoot, folder))) for (const token of tokensOf(readFileSync(file, 'utf8'))) tokens.add(token);
  const used = utilities.filter(([, rule]) => [...tokens].some((token) => rule.test(token))).map(([key]) => key).sort();
  if (used.length) map[names[0]] = used;
}

const text = `${JSON.stringify(map, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = existsSync(output) ? readFileSync(output, 'utf8') : '';
  if (current !== text) {
    console.error('src/core/js/template-utilities.generated.json is stale: run node scripts/generate-template-utilities.mjs');
    process.exit(1);
  }
  console.log('TEMPLATE_UTILITIES_CURRENT');
} else {
  writeFileSync(output, text);
  console.log(`${Object.keys(map).length} components, ${Object.values(map).reduce((sum, list) => sum + list.length, 0)} utility relations`);
}
