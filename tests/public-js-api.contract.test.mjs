import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {CONTRACT, LAYERS, DOCS, LAYER_EXCEPTIONS, DOC_EXCEPTIONS, layerOf, docOf, render} from '../scripts/generate-public-js-api-layers.mjs';

// The shape of the JS API reference the documentation prints; the browser
// probe (tests/browser/public-js-api.browser.mjs) holds it against the runtime.
const contract = JSON.parse(readFileSync(new URL('../src/core/contracts/public-js-api.json', import.meta.url), 'utf8'));

test('the JS API reference names each global once, public or internal, with what it is for', () => {
  assert.equal(contract.schema, 'simai.framework.public-js-api');
  // Names carry no version (owner, 2026-10-11): the version is its own field.
  assert.equal(contract.schema_version, 1);
  const names = contract.globals.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length, 'each name once');
  for (const entry of contract.globals) {
    assert.match(entry.name, /^SF\.[A-Za-z_]+$/u, entry.name);
    assert.ok(['public', 'internal'].includes(entry.status), `${entry.name}: status`);
    assert.ok(['object', 'function', 'class', 'value'].includes(entry.kind), `${entry.name}: kind`);
    assert.ok(typeof entry.summary === 'string' && entry.summary.length > 10, `${entry.name}: summary`);
    assert.ok(typeof entry.loaded_by === 'string' && entry.loaded_by, `${entry.name}: loaded_by`);
    if (entry.members) assert.equal(new Set(entry.members).size, entry.members.length, `${entry.name}: members once`);
  }
  // The internal names are the runtime's; nothing documented may lean on them.
  assert.ok(contract.globals.some((entry) => entry.status === 'internal'));
});

// Owner decision D17 (2026-11-11): every name says its layer and whether the
// documentation lists it for authors; both are derived, and the schema holds
// the same shape.
const schema = JSON.parse(readFileSync(new URL('../src/core/contracts/public-js-api.schema.json', import.meta.url), 'utf8'));

test('every name carries its layer and documentation visibility, as derived', () => {
  assert.equal(render(readFileSync(CONTRACT, 'utf8')), readFileSync(CONTRACT, 'utf8'), 'run node scripts/generate-public-js-api-layers.mjs --write');
  const names = new Set(contract.globals.map((entry) => entry.name));
  for (const name of [...Object.keys(LAYER_EXCEPTIONS), ...Object.keys(DOC_EXCEPTIONS)]) assert.ok(names.has(name), `exception for an unlisted name ${name}`);
  for (const entry of contract.globals) {
    assert.ok(LAYERS.includes(entry.layer), `${entry.name}: layer`);
    assert.ok(DOCS.includes(entry.doc), `${entry.name}: doc`);
    assert.equal(entry.layer, layerOf(entry), `${entry.name}: layer`);
    assert.equal(entry.doc, docOf(entry), `${entry.name}: doc`);
    // An internal name is never listed for authors.
    if (entry.status === 'internal') assert.equal(entry.doc, 'internal', `${entry.name}: internal and listed`);
    // A name the documentation's Functions section groups by layer exists
    // when that layer is there; a component's API comes with its component.
    if (entry.layer === 'component') assert.match(entry.loaded_by, /^(?:component|smart)\//u, `${entry.name}: component layer`);
  }
  for (const layer of ['core', 'loader', 'smart-base', 'component']) assert.ok(contract.globals.some((entry) => entry.layer === layer && entry.doc === 'public'), `${layer}: a public name`);
});

test('the schema holds the contract\'s shape', () => {
  assert.equal(schema.$id, contract.schema);
  assert.equal(schema.properties.schema_version.const, contract.schema_version);
  const item = schema.properties.globals.items;
  assert.deepEqual(item.properties.layer.enum, LAYERS);
  assert.deepEqual(item.properties.doc.enum, DOCS);
  assert.deepEqual(item.required, ['name', 'status', 'layer', 'doc', 'kind', 'loaded_by', 'summary']);
  for (const key of Object.keys(contract)) assert.ok(key in schema.properties, `top-level ${key}`);
  for (const entry of contract.globals) {
    for (const key of item.required) assert.ok(key in entry, `${entry.name}: ${key}`);
    for (const key of Object.keys(entry)) assert.ok(key in item.properties, `${entry.name}: ${key} is not in the schema`);
    assert.ok(item.properties.status.enum.includes(entry.status) && item.properties.kind.enum.includes(entry.kind), entry.name);
    if (entry.deprecated) for (const key of Object.keys(entry.deprecated)) assert.ok(key in item.properties.deprecated.properties, `${entry.name}: deprecated.${key}`);
  }
});

// A deprecated name is a dated alias the change journal records (SF.Effects,
// SF.whenDefine): the contract's dates and replacement are the journal's, and
// the documentation keeps listing it with them until remove_after.
test('every deprecated name is the change journal\'s dated alias', () => {
  const journal = JSON.parse(readFileSync(new URL('../contracts/changes/journal.json', import.meta.url), 'utf8'));
  const records = new Map(journal.records.map((record) => [record.id, record]));
  const deprecated = contract.globals.filter((entry) => entry.deprecated);
  assert.ok(deprecated.some((entry) => entry.name === 'SF.whenDefine'), 'SF.whenDefine is deprecated');
  for (const entry of deprecated) {
    const record = records.get(entry.deprecated.journal);
    assert.ok(record, `${entry.name}: journal ${entry.deprecated.journal}`);
    assert.equal(record.kind, 'global', `${entry.name}: a global record`);
    assert.equal(record.stage, 'compat', `${entry.name}: still an alias`);
    assert.equal(entry.deprecated.since, record.deprecated_on, `${entry.name}: since`);
    assert.equal(entry.deprecated.remove_after, record.remove_after, `${entry.name}: remove_after`);
    const item = record.items.find((candidate) => candidate.from === entry.name);
    assert.ok(item, `${entry.name}: the record names it`);
    assert.equal(entry.deprecated.to, item.to, `${entry.name}: replacement`);
    assert.equal(entry.status, 'public', `${entry.name}: a dated alias stays public until it is removed`);
  }
});
