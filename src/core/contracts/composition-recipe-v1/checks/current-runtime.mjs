import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

import { parseRecipeJson, render, resolveRecipe, stableStringify, validate } from '../../../js/composition/index.mjs';

const base = new URL('../', import.meta.url);
const read = (name) => parseRecipeJson(fs.readFileSync(new URL(name, base), 'utf8'));
const fixture = read('fixtures/header-switch.json');
const vectors = read('fixtures/canonicalization.json');
const hash = (value) => createHash('sha256').update(value).digest('hex');

for (const vector of vectors.positive) {
  const canonical = stableStringify(vector.value);
  assert.equal(canonical, vector.canonical);
  assert.equal(Buffer.from(canonical).toString('hex'), vector.utf8Hex);
  assert.equal(`sha256:${hash(canonical)}`, vector.digest);
}
for (const json of vectors.negativeJsonTexts) assert.throws(() => parseRecipeJson(json));
for (const vector of fixture.identityVectors) {
  assert.equal(`n-${hash(JSON.stringify(['sf-composition-node-v1', vector.recipeId, vector.segments]))}`, vector.expectedId);
}

for (const mode of ['compact', 'expanded']) {
  const expected = fixture.expected[mode];
  const reads = [];
  const result = await resolveRecipe(fixture.recipe, {
    trustedContext: fixture.trustedContext,
    inputs: fixture.inputs[mode],
    executionContract: expected.dependencyReceipt.executionContract,
    ports: {
      readReference: async (reference) => {
        reads.push(`${reference.kind}:${reference.ref}@${reference.revision || reference.pointer}`);
        return { source: fixture.sources[reference.ref], revision: 'r1' };
      },
    },
  });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.document, expected.document);
  assert.deepEqual(result.dependencyReceipt, expected.dependencyReceipt);
  assert.deepEqual(
    result.trace.map((entry) => entry.operation === 'read-input' ? `input:${entry.name}` : `${entry.kind}:${entry.ref}@${entry.revision || entry.pointer}`),
    expected.expectedExternalReads,
  );
  assert.equal(reads.length, 2);
  assert.equal(validate(result.document).valid, true);
  const rendered = await render(result.document);
  assert.deepEqual(rendered.diagnostics, []);
  assert.ok(rendered.html.includes('Одинаковый основной текст.'));
  assert.equal(rendered.html.includes('Дополнительная строка шапки'), mode === 'expanded');
}

console.log(JSON.stringify({
  status: 'pass',
  documents: 2,
  canonicalVectors: vectors.positive.length,
  rejectedJsonVectors: vectors.negativeJsonTexts.length,
  identityVectors: fixture.identityVectors.length,
  verified: ['Recipe resolver', 'port call order', 'inactive branch isolation', 'Document validation', 'SSR'],
  notVerified: ['product publication', 'browser styles'],
}));
