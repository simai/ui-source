import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {attributesOf} from '../scripts/generate-component-files.mjs';

// Every attribute a Smart component description names is a bare HTML attribute
// name: lower case, digits and hyphens. A value never rides in the name
// (sf-input-country 1.3.0 shipped multi-country="false" as an attribute name,
// and Docara refused to build the whole pair). A value form of a setting is an
// alias row with the bare name in "from" and the value in "value".

const root = resolve(import.meta.dirname, '..');
const smart = join(root, 'src/smart');
const NAME = /^[a-z][a-z0-9-]*$/;
const ATTRIBUTE_ALIAS_KINDS = new Set(['attribute', 'setting']);

const folders = readdirSync(smart, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

function offenders(names, where) {
  return names.filter((name) => !NAME.test(name)).map((name) => `${where}: ${JSON.stringify(name)}`);
}

test('component.json: settings, generated attributes and attribute alias rows use bare names', () => {
  const bad = [];
  let seen = 0;
  for (const folder of folders) {
    const path = join(smart, folder, 'component.json');
    if (!existsSync(path)) continue;
    seen += 1;
    const component = json(path);
    bad.push(...offenders(Object.keys(component.settings ?? {}), `${folder}/component.json settings`));
    bad.push(...offenders(Object.keys(attributesOf(component)), `${folder}/component.json attributes`));
    for (const row of component.aliases?.rows ?? []) {
      if (!ATTRIBUTE_ALIAS_KINDS.has(row.kind)) continue;
      bad.push(...offenders([row.from, ...(typeof row.to === 'string' ? [row.to] : [])], `${folder}/component.json aliases`));
    }
  }
  assert.ok(seen > 0, 'no component.json found');
  assert.deepEqual(bad, []);
});

test('smart.manifest.json: every input is a bare attribute name', () => {
  const bad = [];
  let seen = 0;
  for (const folder of folders) {
    const path = join(smart, folder, 'smart.manifest.json');
    if (!existsSync(path)) continue;
    seen += 1;
    bad.push(...offenders(Object.keys(json(path).inputs?.properties ?? {}), `${folder}/smart.manifest.json inputs`));
  }
  assert.ok(seen > 0, 'no smart.manifest.json found');
  assert.deepEqual(bad, []);
});

test('aliases.json: attribute and setting rows use bare names', () => {
  const bad = [];
  for (const folder of folders) {
    const path = join(smart, folder, 'aliases.json');
    if (!existsSync(path)) continue;
    for (const row of json(path).aliases ?? []) {
      if (!ATTRIBUTE_ALIAS_KINDS.has(row.kind)) continue;
      bad.push(...offenders([row.from, ...(typeof row.to === 'string' ? [row.to] : [])], `${folder}/aliases.json`));
    }
  }
  assert.deepEqual(bad, []);
});

test('meta.mjs: every attribute is a bare name', async () => {
  const bad = [];
  for (const folder of folders) {
    const path = join(smart, folder, 'meta.mjs');
    if (!existsSync(path)) continue;
    const module = await import(pathToFileURL(path).href);
    for (const value of Object.values(module)) {
      if (value && typeof value === 'object' && value.attributes) bad.push(...offenders(Object.keys(value.attributes), `${folder}/meta.mjs`));
    }
  }
  assert.deepEqual(bad, []);
});
