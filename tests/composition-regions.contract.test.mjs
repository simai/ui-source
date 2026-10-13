import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createRegistry,
  describeRegions,
  normalize,
  render,
  resolveRecipe,
  stableStringify,
  validate,
} from '../src/core/js/composition/index.mjs';
import { BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

test('publishes declared-region types in the unchanged type-manifest v1 shape', () => {
  const regions = BUILTIN_TYPE_MANIFESTS.find(({ type }) => type === 'layout.regions');
  const region = BUILTIN_TYPE_MANIFESTS.find(({ type }) => type === 'layout.region');
  assert.deepEqual(Object.keys(regions.slots), ['regions']);
  assert.deepEqual(regions.slots.regions, { min: 1, max: 12, types: ['layout.region'] });
  assert.deepEqual(region.slots.default.categories, ['layout', 'content', 'smart']);
  assert.deepEqual(region.props_schema.required, ['name', 'landmark']);
  // Region names are author data, never a fixed product vocabulary.
  assert.equal(region.props_schema.properties.name.enum, undefined);
  assert.equal(region.props_schema.properties.name.pattern, '^[a-z][a-z0-9-]{0,31}$');
});

test('renders semantic landmarks in declared order without changing the Document', async () => {
  const document = await readJson('tests/fixtures/composition/regions.json');
  const before = JSON.stringify(document);
  assert.deepEqual(validate(document), { valid: true, diagnostics: [] });
  const output = await render(document);
  assert.equal(JSON.stringify(document), before);
  assert.deepEqual(output.diagnostics, []);
  const order = [...output.html.matchAll(/data-sf-region="([a-z0-9-]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(order, ['header', 'navigation', 'main', 'summary', 'facts', 'aside', 'footer']);
  assert.match(output.html, /^<div class="sf-composition-regions" data-sf-composition-id="shell"><div class="sf-composition-regions-grid">/u);
  assert.match(output.html, /<header class="sf-composition-region" data-sf-composition-id="shell-header" data-sf-region="header" data-sf-region-placement="block" data-sf-region-sticky="">/u);
  assert.match(output.html, /<nav [^>]*data-sf-region-placement="start" aria-label="Разделы">/u);
  assert.match(output.html, /<main [^>]*data-sf-region="main" data-sf-region-placement="center">/u);
  assert.match(output.html, /<section [^>]*aria-label="Сводка">/u);
  assert.match(output.html, /<footer [^>]*data-sf-region="footer" data-sf-region-placement="block">/u);
  assert.equal((output.html.match(/<main /gu) || []).length, 1);
});

test('escapes author labels and keeps the digest stable across repeated normalization', async () => {
  const document = await readJson('tests/fixtures/composition/regions.json');
  document.root.slots.regions[1].props.label = '<script>"x"</script>';
  const output = await render(document);
  assert.match(output.html, /aria-label="&lt;script&gt;&quot;x&quot;&lt;\/script&gt;"/u);
  const first = await normalize(document);
  const second = await normalize(first.document);
  assert.equal(first.digest, second.digest);
  const reordered = JSON.parse(JSON.stringify(document));
  reordered.root.slots.regions[0].props = Object.fromEntries(Object.entries(reordered.root.slots.regions[0].props).reverse());
  assert.equal((await normalize(reordered)).digest, first.digest);
});

test('region digests change only for the edited region', async () => {
  const document = await readJson('tests/fixtures/composition/regions.json');
  const before = await describeRegions((await normalize(document)).document);
  document.root.slots.regions[3].slots.default[0].data.content[0].value = 'Изменённая колонка.';
  const after = await describeRegions((await normalize(document)).document);
  assert.deepEqual(after.map(({ name }) => name), before.map(({ name }) => name));
  const changed = after.filter((entry, index) => entry.digest !== before[index].digest).map(({ name }) => name);
  assert.deepEqual(changed, ['aside']);
});

test('conformance fixtures are current and reproduce exact outcomes', async () => {
  execFileSync(process.execPath, ['scripts/generate-composition-capability-fixtures.mjs', '--check'], { cwd: root });
  execFileSync(process.execPath, ['scripts/lock-composition-capability-contracts.mjs', '--check'], { cwd: root });
  const fixture = await readJson('src/core/contracts/composition-regions-v1/fixtures/regions.json');
  assert.ok(fixture.cases.filter(({ expect }) => expect === 'valid').length >= 5);
  assert.ok(fixture.cases.filter(({ expect }) => expect === 'invalid').length >= 20);
  for (const entry of fixture.cases) {
    const checked = validate(entry.document);
    assert.deepEqual([...new Set(checked.diagnostics.map(({ code }) => code))].sort(), entry.diagnostics, entry.id);
    if (entry.expect === 'valid') {
      const normalized = await normalize(entry.document);
      assert.equal(`sha256:${normalized.digest}`, entry.digest, entry.id);
      assert.equal(stableStringify(normalized.document), entry.canonical, entry.id);
      assert.equal((await render(entry.document)).html, entry.html, entry.id);
    }
  }
});

test('custom registries without region types keep rejecting region documents', async () => {
  const document = await readJson('tests/fixtures/composition/regions.json');
  const legacy = createRegistry(BUILTIN_TYPE_MANIFESTS.filter(({ type }) => !type.startsWith('layout.region')));
  assert.ok(validate(document, legacy).diagnostics.some(({ code }) => code === 'type_unknown'));
});

const shellTemplate = {
  schema: 'simai.composition.recipe-manifest.v1',
  id: 'shell',
  parameters: {},
  slots: {
    header: { min: 0, max: 4, defaults: [{ id: 'default-title', node: { type: 'content.heading', data: { level: { literal: 1 }, content: { literal: [{ type: 'text', value: 'Сайт' }] } } } }] },
    main: { min: 1, max: 20 },
    aside: { min: 0, max: 4, defaults: [{ id: 'default-aside', node: { type: 'content.paragraph', data: { content: { literal: [{ type: 'text', value: 'Общая боковая колонка' }] } } } }] },
    footer: { min: 0, max: 4, defaults: [{ id: 'default-footer', node: { type: 'content.paragraph', data: { content: { literal: [{ type: 'text', value: 'Общий подвал' }] } } } }] },
  },
  body: {
    id: 'layout',
    node: {
      type: 'layout.regions',
      slots: {
        regions: [
          { id: 'header', node: { type: 'layout.region', props: { name: { literal: 'header' }, landmark: { literal: 'banner' } }, slots: { default: [{ id: 'header-point', insertSlot: 'header' }] } } },
          { id: 'main', node: { type: 'layout.region', props: { name: { literal: 'main' }, landmark: { literal: 'main' }, placement: { literal: 'center' } }, slots: { default: [{ id: 'main-point', insertSlot: 'main' }] } } },
          { id: 'aside', node: { type: 'layout.region', props: { name: { literal: 'aside' }, landmark: { literal: 'complementary' }, placement: { literal: 'end' }, label: { literal: 'Боковая колонка' } }, slots: { default: [{ id: 'aside-point', insertSlot: 'aside' }] } } },
          { id: 'footer', node: { type: 'layout.region', props: { name: { literal: 'footer' }, landmark: { literal: 'contentinfo' } }, slots: { default: [{ id: 'footer-point', insertSlot: 'footer' }] } } },
        ],
      },
    },
  },
};

const pageRecipe = (slots) => ({
  schema: 'simai.composition.recipe.v1',
  id: 'demo.regions',
  profile: 'ui-layout',
  locale: 'ru',
  inputs: {},
  root: { id: 'page', ref: { kind: 'template', owner: 'example/library', ref: 'shell', policy: 'pinned', revision: 'r1' }, slots },
});

const mainEntry = [{ id: 'article', node: { type: 'content.paragraph', data: { content: { literal: [{ type: 'text', value: 'Текст страницы' }] } } } }];

async function resolvePage(slots) {
  const result = await resolveRecipe(pageRecipe(slots), {
    trustedContext: { scope: 'example-site' },
    inputs: { schema: 'simai.composition.inputs.v1', scope: 'example-site', values: {} },
    executionContract: { contractDigest: 'sha256:contract', registryDigest: 'sha256:registry', rendererDigest: 'sha256:renderer' },
    ports: { readReference: async () => ({ source: shellTemplate, revision: 'r1' }) },
  });
  assert.deepEqual(result.diagnostics, []);
  return result.document;
}

test('Recipe v1 fills each region independently: inherit, replace, empty and reset', async () => {
  const inherited = await resolvePage({ main: mainEntry });
  const replaced = await resolvePage({ main: mainEntry, aside: [{ id: 'own-aside', node: { type: 'content.paragraph', data: { content: { literal: [{ type: 'text', value: 'Своя колонка' }] } } } }] });
  const emptied = await resolvePage({ main: mainEntry, aside: [] });
  const reset = await resolvePage({ main: mainEntry });
  const describe = async (document) => Object.fromEntries((await describeRegions(document)).map(({ name, digest }) => [name, digest]));
  const [a, b, c, d] = await Promise.all([inherited, replaced, emptied, reset].map(describe));
  assert.deepEqual(d, a, 'reset returns to the inherited region output');
  for (const other of [b, c]) {
    assert.equal(other.header, a.header);
    assert.equal(other.main, a.main);
    assert.equal(other.footer, a.footer);
    assert.notEqual(other.aside, a.aside);
  }
  const html = (await render(emptied)).html;
  assert.match(html, /<aside [^>]*aria-label="Боковая колонка"><\/aside>/u);
  assert.match((await render(inherited)).html, /Общая боковая колонка/u);
  assert.match((await render(replaced)).html, /Своя колонка/u);
});

test('Recipe v1 rejects an unknown region slot and a type forbidden by the region layout', async () => {
  const unknown = await resolveRecipe(pageRecipe({ main: mainEntry, sidebar: [] }), {
    trustedContext: { scope: 'example-site' },
    inputs: { schema: 'simai.composition.inputs.v1', scope: 'example-site', values: {} },
    executionContract: { contractDigest: 'sha256:contract', registryDigest: 'sha256:registry', rendererDigest: 'sha256:renderer' },
    ports: { readReference: async () => ({ source: shellTemplate, revision: 'r1' }) },
  });
  assert.equal(unknown.document, null);
  assert.equal(unknown.diagnostics[0].code, 'unknown_slot');
  const brokenTemplate = JSON.parse(JSON.stringify(shellTemplate));
  brokenTemplate.body.node.slots.regions.push({ id: 'stray', node: { type: 'content.paragraph', data: { content: { literal: [] } } } });
  const forbidden = await resolveRecipe(pageRecipe({ main: mainEntry }), {
    trustedContext: { scope: 'example-site' },
    inputs: { schema: 'simai.composition.inputs.v1', scope: 'example-site', values: {} },
    executionContract: { contractDigest: 'sha256:contract', registryDigest: 'sha256:registry', rendererDigest: 'sha256:renderer' },
    ports: { readReference: async () => ({ source: brokenTemplate, revision: 'r1' }) },
  });
  assert.equal(forbidden.document, null);
  assert.equal(forbidden.diagnostics[0].code, 'invalid_resolved_document');
});
