import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

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
