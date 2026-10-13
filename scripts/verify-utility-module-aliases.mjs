#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {validateAliasGraph, verifyAliasModules} from './utility-module-alias-contract.mjs';

// Use the explicitly selected builder's parser/compiler, never a global install.
const builder = process.argv[2];
if (!builder || !path.isAbsolute(builder)) throw new Error('Absolute builder root required');
const require = createRequire(path.join(builder, 'package.json'));
const sass = require('sass'), postcss = require('postcss'), selectorParser = require('postcss-selector-parser');
const sourceRoot = path.resolve(import.meta.dirname, '../src');
const contract = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'core/contracts/utility-module-aliases.v1.json'), 'utf8'));
const aliases = validateAliasGraph(contract);
const modules = new Map();
for (const name of new Set([...Object.keys(aliases), ...Object.values(aliases)])) {
  const root = path.join(sourceRoot, 'utility', name);
  const registered = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'rule.js'), 'utf8'), {SF: {RuleLoader: registered}}, {timeout: 100});
  if (!Object.hasOwn(registered, name) || Object.keys(registered).length !== 1) throw new Error(`Unexpected alias registration: ${name}`);
  const rule = registered[name];
  const css = sass.compile(path.join(root, 'index.scss'), {
    loadPaths: [path.join(sourceRoot, 'core/scss'), path.join(builder, 'resources/core')], logger: sass.Logger.silent,
  }).css;
  const records = [];
  let sideEffects = false;
  postcss.parse(css).walkRules(node => {
    const conditions = [];
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (parent.type === 'atrule') conditions.unshift([parent.name, parent.params]);
    }
    if (!conditions.some(([type, value]) => type === 'layer' && value === 'sf.utilities')) sideEffects = true;
    const declarations = node.nodes.filter(item => item.type === 'decl').map(item => [item.prop, item.value, Boolean(item.important)]);
    selectorParser(selectors => selectors.each(selector => {
      const classes = [];
      selector.walkClasses(node => classes.push(node.value));
      if (!classes.length) sideEffects = true;
      records.push({selector: selector.toString().trim(), classes, conditions, declarations});
    })).processSync(node.selector);
  });
  postcss.parse(css).walkAtRules(node => {
    if (!['layer', 'media', 'supports', 'container'].includes(node.name)) sideEffects = true;
  });
  // Alias modules must be CSS-only. Any future executable import needs a new
  // explicit ownership review, not a guessed equivalence of JavaScript effects.
  for (const file of ['index.js', 'index.scss']) {
    const input = fs.readFileSync(path.join(root, file), 'utf8');
    if (file === 'index.js' && !/^\s*import\s+['"]\.\/(?:scss\/)?index\.scss['"];?\s*$/.test(input)) sideEffects = true;
  }
  const dependencies = rule && typeof rule === 'object' && !(rule instanceof RegExp)
    ? JSON.parse(JSON.stringify(rule.relation || [])) : [];
  modules.set(name, {records, dependencies, sideEffects});
}
const verified = verifyAliasModules(contract, modules);
console.log(JSON.stringify({pass: true, sourceRoot, builder, verified}, null, 2));
