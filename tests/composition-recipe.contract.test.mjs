import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { Composition, parseRecipeJson, recipeDigest, resolveRecipe } from '../src/core/js/composition/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = resolve(root, 'src/core/contracts/composition-recipe-v1/fixtures/header-switch.json');
const loadFixture = async () => JSON.parse(await readFile(fixturePath, 'utf8'));
const copy = (value) => JSON.parse(JSON.stringify(value));

function harness(fixture, mode, changes = {}) {
  const reads = [];
  const expected = fixture.expected[mode];
  const sources = fixture.sources;
  const revisions = { article: 'r1', 'header.compact': 'r1', 'header.expanded': 'r1' };
  return {
    reads,
    context: {
      trustedContext: fixture.trustedContext,
      inputs: fixture.inputs[mode],
      executionContract: expected.dependencyReceipt.executionContract,
      ports: {
        readReference: async (reference) => {
          reads.push(`${reference.kind}:${reference.ref}@${reference.revision || reference.pointer}`);
          if (changes.missingReference === reference.ref) return { status: 'missing' };
          return { source: sources[reference.ref], revision: revisions[reference.ref] };
        },
      },
      ...changes.context,
    },
  };
}

for (const mode of ['compact', 'expanded']) {
  test(`resolves the frozen ${mode} recipe document and receipt`, async () => {
    const fixture = await loadFixture();
    const { context, reads } = harness(fixture, mode);
    const result = await resolveRecipe(fixture.recipe, context);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.document, fixture.expected[mode].document);
    assert.deepEqual(result.dependencyReceipt, fixture.expected[mode].dependencyReceipt);
    assert.deepEqual(
      result.trace.map((entry) => entry.operation === 'read-input' ? `input:${entry.name}` : `${entry.kind}:${entry.ref}@${entry.revision || entry.pointer}`),
      fixture.expected[mode].expectedExternalReads,
    );
    assert.equal(reads.length, 2);
  });
}

test('does not read an inactive select branch', async () => {
  const fixture = await loadFixture();
  const { context, reads } = harness(fixture, 'compact');
  const result = await resolveRecipe(fixture.recipe, context);
  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(reads, ['template:article@r1', 'fragment:header.compact@r1']);
});

test('deduplicates exact references and inputs while preserving placement identity', async () => {
  const fixture = await loadFixture();
  fixture.sources.article.body.node.slots.default.push({ id: 'header-point-two', insertSlot: 'header' });
  fixture.sources.article.slots.header.max = 2;
  const { context, reads } = harness(fixture, 'compact');
  const result = await resolveRecipe(fixture.recipe, context);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(reads.filter((entry) => entry.includes('header.compact')).length, 1);
  assert.equal(result.dependencyReceipt.inputs.filter(({ name }) => name === 'headerMode').length, 1);
  assert.equal(new Set(result.document.root.slots.default.map(({ id }) => id)).size, result.document.root.slots.default.length);
});

test('fails closed for origin, digest, revision, cycle and budget errors', async () => {
  const fixture = await loadFixture();
  const cases = [];

  const badOrigin = copy(fixture.inputs.compact);
  badOrigin.values.body.origin.owner = 'wrong/owner';
  cases.push(harness(fixture, 'compact', { context: { inputs: badOrigin } }).context);

  const badDigest = copy(fixture.inputs.compact);
  badDigest.values.body.valueDigest = `sha256:${'0'.repeat(64)}`;
  cases.push(harness(fixture, 'compact', { context: { inputs: badDigest } }).context);

  const badRevision = harness(fixture, 'compact').context;
  badRevision.ports.readReference = async (reference) => ({ source: fixture.sources[reference.ref], revision: 'wrong' });
  cases.push(badRevision);

  const cyclic = copy(fixture);
  cyclic.sources.article.body = copy(cyclic.recipe.root);
  cases.push(harness(cyclic, 'compact').context);

  cases.push(harness(fixture, 'compact', { context: { limits: { maxExpansionSteps: 1 } } }).context);

  for (const context of cases) {
    const result = await resolveRecipe(fixture.recipe, context);
    assert.equal(result.document, null);
    assert.equal(result.dependencyReceipt, null);
    assert.ok(result.diagnostics.length > 0);
  }
});

test('checks template slot cardinality, allowed types and unused arguments', async () => {
  const fixture = await loadFixture();
  const variants = [];

  const empty = copy(fixture.recipe);
  empty.root.slots.header = [];
  variants.push(empty);

  const wrongType = copy(fixture.recipe);
  wrongType.root.slots.header = wrongType.root.slots.main;
  variants.push(wrongType);

  const unused = copy(fixture);
  unused.sources.article.body.node.slots.default = unused.sources.article.body.node.slots.default.filter(({ insertSlot }) => insertSlot !== 'header');
  variants.push(unused.recipe);

  for (let index = 0; index < variants.length; index += 1) {
    const sourceFixture = index === 2 ? { ...fixture, sources: unused.sources } : fixture;
    const result = await resolveRecipe(variants[index], harness(sourceFixture, 'compact').context);
    assert.equal(result.document, null);
    assert.ok(result.diagnostics.length > 0);
  }
});

test('rejects duplicate local ids before any external read', async () => {
  const fixture = await loadFixture();
  fixture.recipe.root.slots.main[0].id = fixture.recipe.root.slots.header[0].id;
  const { context, reads } = harness(fixture, 'compact');
  const result = await resolveRecipe(fixture.recipe, context);
  assert.equal(result.document, null);
  assert.equal(result.diagnostics[0].code, 'duplicate_id');
  assert.deepEqual(reads, []);
});

test('keeps the existing document API and exposes Recipe through ESM and SF.Composition', async () => {
  assert.equal(Composition.resolveRecipe, resolveRecipe);
  assert.equal(Composition.Recipe.resolve, resolveRecipe);
  assert.equal(globalThis.SF.Composition.resolveRecipe, resolveRecipe);
  assert.equal(await recipeDigest({ b: 1, a: 2 }), await recipeDigest({ a: 2, b: 1 }));
});

test('parses canonical JSON with duplicate-key and numeric safeguards', async () => {
  const vectors = JSON.parse(await readFile(resolve(root, 'src/core/contracts/composition-recipe-v1/fixtures/canonicalization.json'), 'utf8'));
  for (const vector of vectors.positive) {
    const parsed = parseRecipeJson(vector.canonical);
    assert.equal(await recipeDigest(parsed), vector.digest, vector.name);
  }
  for (const json of vectors.negativeJsonTexts) {
    assert.throws(() => parseRecipeJson(json), undefined, json);
  }
});

test('enforces every published hard-limit boundary', async () => {
  const fixture = await loadFixture();
  const boundaries = JSON.parse(await readFile(resolve(root, 'src/core/contracts/composition-recipe-v1/fixtures/limit-boundaries.json'), 'utf8'));
  for (const boundary of boundaries.cases) {
    const allowed = harness(fixture, 'compact', { context: { limits: { [boundary.limit]: boundary.inclusiveAllowed } } });
    assert.equal((await resolveRecipe(fixture.recipe, allowed.context)).diagnostics.length, 0, boundary.limit);
    const rejected = harness(fixture, 'compact', { context: { limits: { [boundary.limit]: boundary.firstRejected } } });
    const result = await resolveRecipe(fixture.recipe, rejected.context);
    assert.equal(result.document, boundary.errorDocument, boundary.limit);
    assert.equal(result.diagnostics[0].code, boundary.expectedCode, boundary.limit);
  }
});

test('enforces the schema-negative corpus at the runtime boundary', async () => {
  const fixture = await loadFixture();
  const cases = JSON.parse(await readFile(resolve(root, 'src/core/contracts/composition-recipe-v1/fixtures/schema-negative.json'), 'utf8')).cases;
  for (const testCase of cases) {
    const recipe = copy(fixture.recipe);
    const inputs = copy(fixture.inputs.compact);
    const target = testCase.base === 'recipe' ? recipe : inputs;
    let owner = target;
    for (const segment of testCase.operation.path.slice(0, -1)) owner = owner[segment];
    const key = testCase.operation.path.at(-1);
    if (testCase.operation.kind === 'delete') delete owner[key];
    else owner[key] = testCase.operation.value;
    const context = harness(fixture, 'compact', { context: { inputs } }).context;
    const result = await resolveRecipe(recipe, context);
    assert.equal(result.document, null, testCase.id);
    assert.ok(result.diagnostics.length > 0, testCase.id);
  }
});

test('resolves parameters, slot defaults and a follow-published snapshot', async () => {
  const recipe = {
    schema: 'simai.composition.recipe.v1', id: 'demo.follow', profile: 'ui-layout',
    root: {
      id: 'page',
      ref: { kind: 'template', owner: 'example/library', ref: 'page', policy: 'follow-published', pointer: 'published' },
      params: { title: { literal: [{ type: 'text', value: 'Заголовок' }] } },
    },
  };
  const source = {
    schema: 'simai.composition.recipe-manifest.v1', id: 'page',
    parameters: { title: { type: 'array' } },
    slots: {
      content: {
        min: 1, max: 1, types: ['content.paragraph'],
        defaults: [{ id: 'default-content', node: { type: 'content.paragraph', data: { content: { literal: [{ type: 'text', value: 'Текст по умолчанию' }] } } } }],
      },
    },
    body: {
      id: 'shell', node: { type: 'layout.page', slots: { default: [
        { id: 'heading', node: { type: 'content.heading', data: { level: { literal: 1 }, content: { parameter: 'title' } } } },
        { id: 'content-point', insertSlot: 'content' },
      ] } },
    },
  };
  const result = await resolveRecipe(recipe, {
    trustedContext: { scope: 'site-1' },
    executionContract: { contractDigest: 'sha256:contract', registryDigest: 'sha256:registry', rendererDigest: 'sha256:renderer' },
    ports: { readReference: async () => ({ source, revision: 'r2', generation: 'g7' }) },
  });
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.document.root.slots.default[0].data.content[0].value, 'Заголовок');
  assert.match(result.document.root.slots.default[1].data.content[0].value, /умолчанию/u);
  assert.deepEqual(result.dependencyReceipt.logicalPointers, [{
    kind: 'template', owner: 'example/library', ref: 'page', pointer: 'published', generation: 'g7', resolvedRevision: 'r2', scope: 'site-1',
  }]);
});
