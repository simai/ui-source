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

// Recipe 1.1.0 (2026-10-19, asked for by Larena): the contract's formats and
// its canonicalization profile take either form of their names. A recipe in
// the older form gives the bytes and digests 1.0.1 fixed, unchanged; a recipe
// named without a version gives a Document and a receipt named without one,
// with the digests fixtures/format-names.json records.
const contractDir = resolve(root, 'src/core/contracts/composition-recipe-v1');
const loadFormatNames = async () => JSON.parse(await readFile(resolve(contractDir, 'fixtures/format-names.json'), 'utf8'));
const named = (value, name) => { const { schema, ...rest } = copy(value); return { schema: name, schema_version: 1, ...rest }; };

test('a recipe in the older form keeps the digests Recipe 1.0.1 published', async () => {
  const fixture = await loadFixture();
  const published = {
    recipe: 'sha256:86722d90b48c9a5c14821bc7bb45ccbb5897c3ee12f2a68cdc0f9d930f6d3222',
    template: 'sha256:fb78019b90f2c64d36e660ab37e917e821677812933d01d3e2d930c891251d09',
    compact: 'sha256:6a687e4833ec5c11d775e44e722a799cfd2aff6bdc12978e17c7f7c5b982d38c',
    expanded: 'sha256:65f4b0e79fba6d4338768c28c73534835cefaff46cd57aa09328c25a849ddaea',
  };
  assert.equal(await recipeDigest(fixture.recipe), published.recipe);
  for (const mode of ['compact', 'expanded']) {
    const result = await resolveRecipe(fixture.recipe, harness(fixture, mode).context);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.dependencyReceipt.recipeDigest, published.recipe, mode);
    assert.equal(result.dependencyReceipt.documentDigest, published[mode], mode);
    assert.equal(result.dependencyReceipt.references[0].digest, published.template, mode);
    assert.equal(result.dependencyReceipt.executionContract.canonicalization, 'simai.recipe.canonical-json.v1', mode);
    assert.equal(result.document.schema, 'simai.composition.document.v1');
    assert.equal(result.dependencyReceipt.schema, 'simai.composition.dependencies.v1');
  }
});

test('a recipe, its template manifest and its inputs named without a version resolve to the recorded bare-form digests', async () => {
  const fixture = await loadFixture();
  const names = await loadFormatNames();
  const sources = { ...fixture.sources, article: named(fixture.sources.article, 'simai.composition.recipe-manifest') };
  for (const mode of ['compact', 'expanded']) {
    const expected = fixture.expected[mode];
    const bare = names.bareResolution[mode];
    const result = await resolveRecipe(named(fixture.recipe, 'simai.composition.recipe'), {
      trustedContext: fixture.trustedContext,
      inputs: named(fixture.inputs[mode], 'simai.composition.inputs'),
      executionContract: { ...expected.dependencyReceipt.executionContract, canonicalization: 'simai.recipe.canonical-json' },
      ports: { readReference: async (reference) => ({ source: sources[reference.ref], revision: 'r1' }) },
    });
    assert.deepEqual(result.diagnostics, [], mode);
    assert.deepEqual(result.document, named(expected.document, 'simai.composition.document'), 'the same tree under the bare name');
    assert.deepEqual({ schema: result.dependencyReceipt.schema, schema_version: result.dependencyReceipt.schema_version }, bare.receiptSchema);
    assert.equal(result.dependencyReceipt.executionContract.canonicalization, bare.canonicalization);
    assert.equal(result.dependencyReceipt.recipeDigest, bare.recipeDigest);
    assert.equal(result.dependencyReceipt.documentDigest, bare.documentDigest);
    assert.deepEqual(result.dependencyReceipt.references.map(({ ref, digest }) => ({ ref, digest })), bare.references);
    assert.deepEqual(result.dependencyReceipt.inputs, expected.dependencyReceipt.inputs, 'input value digests do not depend on the envelope name');
  }
});

test('the canonicalization profile is read under either name, and no other', async () => {
  const fixture = await loadFixture();
  const run = (canonicalization) => {
    const { context } = harness(fixture, 'compact');
    const executionContract = { ...context.executionContract };
    if (canonicalization === undefined) delete executionContract.canonicalization;
    else executionContract.canonicalization = canonicalization;
    return resolveRecipe(fixture.recipe, { ...context, executionContract });
  };
  const older = await run('simai.recipe.canonical-json.v1');
  const bare = await run('simai.recipe.canonical-json');
  const unnamed = await run(undefined);
  for (const result of [older, bare, unnamed]) assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(bare.document, older.document);
  assert.equal(bare.dependencyReceipt.documentDigest, older.dependencyReceipt.documentDigest);
  assert.equal(bare.dependencyReceipt.recipeDigest, older.dependencyReceipt.recipeDigest);
  assert.equal(bare.dependencyReceipt.executionContract.canonicalization, 'simai.recipe.canonical-json', 'the receipt keeps the name it was given');
  assert.deepEqual(unnamed.dependencyReceipt, older.dependencyReceipt, 'no name is the older one, as in 1.0.1');
  const other = await run('simai.recipe.canonical-json.v2');
  assert.equal(other.document, null);
  assert.equal(other.diagnostics[0].code, 'incompatible_profile');
});

test('the format-name cases are the contract schemas in both forms', async () => {
  const names = await loadFormatNames();
  const schemas = Object.fromEntries(await Promise.all(['recipe', 'manifest', 'inputs', 'dependencies'].map(async (name) => [`${name}.schema.json`, JSON.parse(await readFile(resolve(contractDir, `${name}.schema.json`), 'utf8'))])));
  const covered = new Set([...names.positive, ...names.negative].map(({ schema }) => schema));
  assert.deepEqual([...covered].sort(), Object.keys(schemas).sort());
  for (const [file, schema] of Object.entries(schemas)) {
    const [label, bare] = schema.properties.schema.enum;
    assert.match(label, /\.v1$/u, file);
    assert.equal(bare, label.slice(0, -3), file);
    assert.ok(names.positive.some((testCase) => testCase.schema === file && testCase.operations.some(({ value }) => value === bare)), `${file}: a positive bare-name case`);
    assert.ok(names.negative.some((testCase) => testCase.schema === file && testCase.operations.length === 1 && testCase.operations[0].value === bare), `${file}: the bare name without schema_version is refused`);
  }
  assert.deepEqual(schemas['dependencies.schema.json'].properties.executionContract.properties.canonicalization.enum, ['simai.recipe.canonical-json.v1', 'simai.recipe.canonical-json']);
});

test('the Recipe contract lock is current and pins the published corpus', async () => {
  const { spawnSync } = await import('node:child_process');
  const checked = spawnSync(process.execPath, [resolve(root, 'scripts/lock-composition-recipe-contract.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  const lock = JSON.parse(await readFile(resolve(contractDir, 'contract.lock.json'), 'utf8'));
  assert.equal(lock.schema, 'simai.composition.recipe-contract-lock.v1', 'ui-builder reads the lock by this label');
  assert.equal(lock.version, '1.1.0');
  assert.equal(lock.fixtures['fixtures/header-switch.json'], 'sha256:a5a3105d42e3403d5d4a99d86155b4a2d5609e54abc7c9638e56c2bb1f7e26eb', 'the 1.0.1 corpus is unchanged');
  for (const [file, digest] of Object.entries({
    'common.schema.json': 'sha256:09945cc8485e7b1a5f8ee8add6938da720ffc6c434c6e86c13fe6f98a95b2fe4',
    'limits.json': 'sha256:2a8b3d66ed8f4b183f721ffe257f472cfeb835c6e9829d374a3a420122025e10',
    'fixtures/canonicalization.json': 'sha256:ab6e3aef30bbceef84bdd1314b301d20fe1196b32d6d83f59feb32e376b44239',
    'fixtures/limit-boundaries.json': 'sha256:c507d0f534868fea42c735e9f741aa228699a487652d4212feba9a4d40a04eb2',
    'fixtures/schema-negative.json': 'sha256:66d4611c4ed4699ff86d1ec3de26cfcc6e52307766b8c7844113dff838737401',
  })) assert.equal(lock.normativeFiles[file], digest, `${file} keeps its 1.0.1 bytes`);
});
