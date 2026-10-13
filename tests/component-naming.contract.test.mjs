import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The manifest schema allows a product to name its own components, because a
// product host is a first-class author of composites. The Framework's own
// components still carry the Framework's names, and that is an owner rule, not
// a rule of the contract.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifests = readdirSync(resolve(root, 'src/smart'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `src/smart/${entry.name}/smart.manifest.json`)
  .filter((path) => existsSync(resolve(root, path)));

test('Framework components keep the Framework names', () => {
  assert.ok(manifests.length > 20, 'the manifests are found');
  for (const path of manifests) {
    const manifest = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
    assert.match(manifest.id, /^smart\.[a-z][a-z0-9-]*$/u, `${path}: id`);
    assert.match(manifest.custom_element, /^sf-[a-z0-9]+(?:-[a-z0-9]+)*$/u, `${path}: element`);
    const declarative = manifest.composition?.declarative;
    if (!declarative) continue;
    assert.match(declarative.type, /^smart\.[a-z][a-z0-9-]*$/u, `${path}: composition type`);
    assert.match(declarative.renderer.name, /^sf-[a-z0-9]+(?:-[a-z0-9]+)*$/u, `${path}: renderer`);
  }
});

test('the contract accepts a product name it does not own', () => {
  const schema = JSON.parse(readFileSync(resolve(root, 'contracts/schema/smart-component-manifest.v2.schema.json'), 'utf8'));
  const element = new RegExp(schema.properties.custom_element.pattern, 'u');
  const type = new RegExp(schema.properties.composition.properties.declarative.properties.type.pattern, 'u');
  for (const name of ['sf-table', 'lr-records-list', 'docara-page-tree']) {
    assert.ok(element.test(name), `element ${name}`);
  }
  for (const name of ['smart.data-view', 'larena.records-list', 'docara.page-tree']) {
    assert.ok(type.test(name), `type ${name}`);
  }
  for (const name of ['Table', 'table', 'sf_table', '-table']) {
    assert.ok(!element.test(name), `element ${name} is still rejected`);
  }
  assert.ok(!type.test('dataview'), 'a type without a vendor is still rejected');
});
