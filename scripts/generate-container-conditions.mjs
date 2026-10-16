import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {exactClassPattern} from './utility-exact-rule.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export const profile = JSON.parse(fs.readFileSync(path.join(root, 'src/core/contracts/container-conditions.v1.json')));
const prefixes = {'display': [''], 'flex-direction': ['flex-'], 'flex-wrap': ['flex-'], gap: ['gap-', 'row-gap-', 'col-gap-'], 'grid-template-columns': ['grid-col-'], 'justify-content': ['content-main-'], 'align-items': ['items-cross-']};
const quote = value => `'${value.replaceAll('/', '\\\\/')}'`;
const list = values => values.length ? `(${values.map(quote).join(', ')},)` : '()';
export function projections(value = profile) {
  assert.deepEqual(Object.keys(value).sort(), ['breakpoints', 'families', 'names', 'version']);
  assert.equal(value.version, 1);
  assert.ok(Array.isArray(value.breakpoints) && value.breakpoints.length > 0);
  const order = ['sm', 'md', 'lg', 'xl'];
  assert.deepEqual(value.breakpoints, order.filter(name => value.breakpoints.includes(name)), 'Use canonical increasing breakpoints without duplicates');
  assert.ok(Array.isArray(value.names) && value.names.length <= 8);
  assert.equal(new Set(value.names).size, value.names.length);
  for (const name of value.names) {
    assert.match(name, /^[a-z][a-z0-9-]{0,47}$/);
    assert.ok(!['none', 'normal', 'initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default'].includes(name), 'Reserved container name');
  }
  assert.deepEqual(Object.keys(value.families).sort(), Object.keys(prefixes).sort());
  for (const roles of Object.values(value.families)) {
    assert.ok(Array.isArray(roles) && roles.length > 0 && roles.length <= 64);
    assert.equal(new Set(roles).size, roles.length);
    for (const role of roles) assert.match(role, /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/);
  }
  const classes = [];
  for (const breakpoint of value.breakpoints) for (const name of ['', ...value.names]) {
    const condition = `cq-${breakpoint}${name ? '/' + name : ''}:`;
    for (const [family, roles] of Object.entries(value.families))
      for (const prefix of prefixes[family]) for (const role of roles) classes.push(condition + prefix + role);
  }
  const header = '// Generated from core/contracts/container-conditions.v1.json; do not edit.\n';
  const config = header + `$query-breakpoints: ${list(value.breakpoints)};\n$query-names: ${list(value.names)};\n$query-families: (\n` + Object.entries(value.families).map(([family, roles]) => `  '${family}': ${list(roles)},`).join('\n') + '\n);\n';
  const rule = (name, names) => header + `SF.RuleLoader['${name}/default'] = new RegExp(${JSON.stringify(exactClassPattern(names))});\n`;
  return new Map([
    ['src/utility/query-container/default/scss/_sf_profile.scss', config],
    ['src/utility/query-container/default/rule.js', rule('query-container', ['query-container', ...value.names.map(name => `query-container/${name}`)])],
    ['src/utility/query-layout/default/rule.js', rule('query-layout', classes)],
  ]);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  assert.ok(process.argv.slice(2).every(arg => arg === '--check'));
  for (const [name, output] of projections()) {
    const file = path.join(root, name);
    if (process.argv.includes('--check')) assert.equal(fs.readFileSync(file, 'utf8'), output, `Stale container projection: ${name}`);
    else {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, output);}
  }
  console.log(JSON.stringify({profile: 1, projections: projections().size, check: process.argv.includes('--check')}));
}
