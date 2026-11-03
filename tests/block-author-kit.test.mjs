import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkBlock, frameworkRoot, loadFramework } from '../kits/block/check.mjs';
import { newBlock } from '../kits/block/new.mjs';

// The block author kit (kits/block/, docs/developer/block-author-guide.md):
// its sample block and its template pass the check, and the check refuses a
// broken manifest, a renderer that is not registered, unsafe output, a form
// that does not build, and a block that does not keep an unknown type opaque.

const kit = fileURLToPath(new URL('../kits/block/', import.meta.url));
const sample = join(kit, 'examples/sample-quote');
const cards = join(kit, 'examples/sample-cards');
const framework = await loadFramework();
const scratch = mkdtempSync(join(tmpdir(), 'sf-block-kit-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

let copies = 0;
// A copy of the sample block (or another example) with one change made to it.
function variant(change, from = sample) {
  copies += 1;
  const folder = join(scratch, `block-${copies}`);
  cpSync(from, folder, { recursive: true });
  const json = (name, edit) => {
    const path = join(folder, name);
    const value = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify(edit(value) ?? value));
  };
  const text = (name, edit) => writeFileSync(join(folder, name), edit(readFileSync(join(folder, name), 'utf8')));
  change({ folder, json, text });
  return folder;
}
const codes = (report, group) => report.groups.find((entry) => entry.id === group).problems.map((problem) => problem.code);
const failed = (report) => report.groups.filter((group) => !group.ok).map((group) => group.id);
const cli = (...args) => spawnSync(process.execPath, ['--no-warnings', join(kit, 'check.mjs'), ...args], { encoding: 'utf8' });

test('the sample block passes every group of the check, with no warning', async () => {
  const report = await checkBlock(sample, { framework });
  assert.equal(report.type, 'sample.quote');
  assert.deepEqual(failed(report), []);
  assert.deepEqual(report.groups.map((group) => group.id), ['manifest', 'renderer', 'form', 'output', 'unknown']);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.cases, 7);
  const run = cli(sample);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^BLOCK_CHECK_PASS sample\.quote@1\.1\.0 groups=5 cases=7 warnings=0$/mu);
});

test('the template passes, and a block made from it under a product name passes as it is', async () => {
  assert.deepEqual(failed(await checkBlock(join(kit, 'template'), { framework })), []);
  const folder = join(scratch, 'acme-price-card');
  newBlock('acme.price-card', folder);
  const report = await checkBlock(folder, { framework });
  assert.equal(report.type, 'acme.price-card');
  assert.deepEqual(failed(report), []);
  const editor = JSON.parse(readFileSync(join(folder, 'editor.json'), 'utf8'));
  assert.deepEqual(editor.fields.map((field) => [field.label_key, field.owner]), [['acme.price_card.title', 'acme/price-card'], ['acme.price_card.tone', 'acme/price-card']]);
  assert.match(readFileSync(join(folder, 'renderer.mjs'), 'utf8'), /class="acme-price-card acme-price-card--/u);
  assert.throws(() => newBlock('content.card-2', join(scratch, 'reserved')), /block_namespace_reserved/u);
  assert.throws(() => newBlock('Acme', join(scratch, 'bad')), /block_type_invalid/u);
  assert.throws(() => newBlock('acme.other', folder), /block_folder_not_empty/u);
});

test('a broken manifest fails the manifest group', async () => {
  const reserved = await checkBlock(variant(({ json }) => json('type.json', (type) => ({ ...type, type: 'content.pull-quote' }))), { framework });
  assert.ok(codes(reserved, 'manifest').includes('type_namespace_reserved'));
  assert.ok(codes(reserved, 'manifest').includes('editor_type_registration_mismatch'), 'the editor manifest binds the exact type');

  const malformed = await checkBlock(variant(({ json }) => json('type.json', (type) => ({ ...type, version: '1.0', colour: 'red' }))), { framework });
  assert.ok(codes(malformed, 'manifest').includes('manifest_schema_pattern'));
  assert.ok(codes(malformed, 'manifest').includes('manifest_schema_additional_property'));

  const schema = await checkBlock(variant(({ json }) => json('type.json', (type) => {
    type.data_schema.properties.source.format = 'uri';
    type.data_schema.properties.html = { type: 'string' };
    type.props_schema.additionalProperties = true;
  })), { framework });
  assert.deepEqual(new Set(codes(schema, 'manifest')), new Set(['schema_keyword_unsupported', 'schema_key_forbidden', 'schema_not_closed']));

  const foreign = await checkBlock(variant(({ json }) => json('editor.json', (editor) => { editor.fields[0].owner = 'simai/framework'; })), { framework });
  assert.deepEqual(codes(foreign, 'manifest'), ['editor_owner_foreign']);

  const run = cli(variant(({ json }) => json('type.json', (type) => ({ ...type, version: 'one' }))));
  assert.equal(run.status, 1);
  assert.match(run.stdout, /FAIL {2}manifest/u);
  assert.match(run.stdout, /^BLOCK_CHECK_FAIL sample\.quote@one problems=\d+/mu);
});

test('a renderer that is not registered fails the renderer group', async () => {
  const missing = await checkBlock(variant(({ folder }) => rmSync(join(folder, 'renderer.mjs'))), { framework });
  assert.deepEqual(codes(missing, 'renderer'), ['renderer_file_missing', 'renderer_unavailable']);
  assert.ok(codes(missing, 'output').includes('case_html_mismatch'), 'nothing is drawn in its place');

  const notFunction = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => `${source.replace('export default function', 'function')}\nexport default 'quote';\n`)), { framework });
  assert.deepEqual(codes(notFunction, 'renderer'), ['renderer_not_function', 'renderer_unavailable']);

  const taken = await checkBlock(variant(({ json }) => json('type.json', (type) => { type.renderer.name = 'content.quote'; })), { framework });
  assert.deepEqual(codes(taken, 'renderer'), ['renderer_name_taken']);

  const noId = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replace(' data-sf-composition-id="${escapeHtml(node.id)}"', ''))), { framework });
  assert.ok(codes(noId, 'renderer').includes('renderer_node_id_missing'));

  const dropped = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replace("${slots.default || ''}", ''))), { framework });
  assert.ok(codes(dropped, 'renderer').includes('renderer_slot_dropped'));
});

test('a form that cannot make the block fails the form group', async () => {
  const noAuthor = await checkBlock(variant(({ json }) => json('editor.json', (editor) => { editor.fields = editor.fields.filter((field) => field.key !== 'author'); })), { framework });
  assert.deepEqual(codes(noAuthor, 'form'), ['form_required_field_missing']);

  const wider = await checkBlock(variant(({ json }) => json('editor.json', (editor) => { editor.fields.find((field) => field.key === 'align').choices.push('end'); })), { framework });
  assert.deepEqual(new Set(codes(wider, 'form')), new Set(['form_value_breaks_document']), 'once for each case that holds the block');
  assert.match(wider.groups.find((group) => group.id === 'form').problems[0].path, /align=end/u);

  const noWords = await checkBlock(variant(({ folder }) => rmSync(join(folder, 'words.json'))), { framework });
  assert.deepEqual(failed(noWords), []);
  assert.deepEqual(noWords.warnings.map((warning) => warning.code), ['words_missing']);
});

test('output that differs from a case, or is not safe, fails the output group', async () => {
  const drift = await checkBlock(variant(({ json }) => json('cases/quote-default.json', (entry) => { entry.expect.html = entry.expect.html.replace('sample-quote--start', 'sample-quote--left'); })), { framework });
  assert.deepEqual(codes(drift, 'output'), ['case_html_mismatch']);

  const unescaped = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replaceAll('${escapeHtml(author)}', '${author}'))), { framework });
  assert.ok(codes(unescaped, 'output').includes('output_element_forbidden'));
  assert.ok(codes(unescaped, 'output').includes('output_event_handler'));

  const unchecked = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replace('const href = safeUrl(source);', 'const href = source;'))), { framework });
  assert.ok(codes(unchecked, 'output').includes('output_unsafe_url'));
  assert.ok(codes(unchecked, 'output').includes('case_html_mismatch'), 'the unsafe-address case pins that no link is drawn');
});

test('an unknown type stays opaque: refused whole, never half drawn, the node kept byte for byte', async () => {
  const report = await checkBlock(sample, { framework });
  assert.equal(report.groups.find((group) => group.id === 'unknown').ok, true);
  // What the group asks, asked directly of the runtime.
  const { composition } = framework;
  const entry = JSON.parse(readFileSync(join(sample, 'cases/quote-default.json'), 'utf8'));
  const before = JSON.stringify(entry.input.document);
  const blind = composition.validate(entry.input.document);
  assert.deepEqual(blind.diagnostics.map(({ code, path }) => [code, path]), [['type_unknown', '$.root.slots.default[0].type']]);
  assert.equal((await composition.render(entry.input.document)).html, '');
  assert.equal(JSON.stringify(entry.input.document), before);

  const mutating = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replace('const { author, role, source } = node.data;', 'node.data.seen = true;\n  const { author, role, source } = node.data;'))), { framework });
  assert.deepEqual(codes(mutating, 'unknown'), ['renderer_mutates_node']);
});

// The one block editor (owner 2026-11-03): the kit asks a block for its place
// in the catalogue, its variants, its layout parameters as utilities, its
// named places and the data it takes.

test('sample.cards passes: catalogue, variants, utilities per screen, a named place and data', async () => {
  const report = await checkBlock(cards, { framework });
  assert.equal(report.type, 'sample.cards');
  assert.deepEqual(failed(report), []);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.cases, 6);
  const responsive = JSON.parse(readFileSync(join(cards, 'cases/cards-responsive.json'), 'utf8'));
  assert.match(responsive.expect.html, /class="sample-cards sample-cards--accent grid grid-col-1 md:grid-col-2 lg:grid-col-3 gap-2 lg:gap-4"/u);
  const run = cli(cards);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^BLOCK_CHECK_PASS sample\.cards@1\.0\.0 groups=5 cases=6 warnings=0$/mu);
});

test('a catalogue place, a variant or a utility the SIMAI Framework does not have fails the manifest group', async () => {
  const group = await checkBlock(variant(({ json }) => json('type.json', (type) => { type.catalogue.group = 'gadgets'; }), cards), { framework });
  assert.deepEqual(codes(group, 'manifest'), ['catalogue_group_unknown']);
  const badVariant = await checkBlock(variant(({ json }) => json('type.json', (type) => { type.variants[1].props.cols = 9; }), cards), { framework });
  assert.deepEqual(codes(badVariant, 'manifest'), ['schema_maximum']);
  const utility = await checkBlock(variant(({ json }) => json('type.json', (type) => { type.props_schema.properties.cols['x-simai-utility'].class = 'columns-{value}'; }), cards), { framework });
  assert.ok(codes(utility, 'manifest').includes('utility_class_unknown'));
  const shape = await checkBlock(variant(({ json }) => json('type.json', (type) => { type.data_bindings.items.shapes = ['products']; }), cards), { framework });
  assert.ok(codes(shape, 'manifest').includes('data_shape_unknown'));
  const noPlace = await checkBlock(variant(({ json }) => json('type.json', (type) => { delete type.catalogue; }), cards), { framework });
  assert.deepEqual(failed(noPlace), []);
  assert.deepEqual(noPlace.warnings.map(({ code }) => code), ['catalogue_missing']);
});

test('a data block draws every state; one that draws nothing when its source fails fails the output group', async () => {
  const silent = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replace("const state = bindingStates.items ?? 'loading';", "const state = bindingStates.items ?? 'loading';\n  if (state === 'error') return '';")), cards), { framework });
  assert.deepEqual(codes(silent, 'output'), ['data_state_not_drawn']);
  assert.match(silent.groups.find((entry) => entry.id === 'output').problems[0].path, /^state error/u);
  const unescaped = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replace('${escapeHtml(item.title)}</h3>', '${item.title}</h3>').replace(': escapeHtml(item.title);', ': item.title;')), cards), { framework });
  assert.ok(codes(unescaped, 'output').includes('output_element_forbidden'), 'a host\'s answer is text: the block escapes it');
  const unchecked = await checkBlock(variant(({ text }) => text('renderer.mjs', (source) => source.replace('const href = safeUrl(item.url);', 'const href = item.url;')), cards), { framework });
  assert.ok(codes(unchecked, 'output').includes('output_unsafe_url'), 'and checks its addresses');
});

test('--framework names the SIMAI Framework src folder or a built distr; a checkout root is read as its src', async () => {
  const checkout = fileURLToPath(new URL('../', import.meta.url));
  assert.equal(frameworkRoot(checkout), join(checkout, 'src'));
  assert.equal(frameworkRoot(join(checkout, 'src')), join(checkout, 'src'));
  const fromRoot = await checkBlock(sample, { framework: checkout });
  assert.deepEqual(failed(fromRoot), []);
  assert.throws(() => frameworkRoot(scratch), /block_check_framework_missing: --framework names the SIMAI Framework's src folder or a built distr/u);
  const run = cli(sample, '--framework', scratch);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /src folder or a built distr/u);
  const viaRoot = cli(sample, '--framework', checkout);
  assert.equal(viaRoot.status, 0, viaRoot.stdout + viaRoot.stderr);
  const help = cli('--help');
  assert.match(help.stdout, /--framework <dir> {2}the SIMAI Framework to check against: its src\/ folder or a built distr\//u);
});

test('a site block made by the block builder passes as a block: builtin composed, its tree held to its parameters', async () => {
  const { composition } = framework;
  const { manifest } = composition.defineComposedType({
    type: 'site.promo',
    version: '1.0.0',
    profiles: ['ui-layout'],
    catalogue: { group: 'marketing' },
    root: { id: 'box', type: 'layout.area', props: { padding: 4 }, slots: { default: [{ id: 'title', type: 'content.heading', data: { level: 2, content: [{ type: 'text', value: 'Sale' }] } }] } },
    exposed: [{ key: 'padding', path: 'box', target: 'props.padding' }],
  });
  const folder = join(scratch, 'site-promo');
  const document = { schema: 'simai.composition.document', schema_version: 1, id: 'page', profile: 'ui-layout', root: { id: 'root', type: 'layout.page', slots: { default: [{ id: 'promo', type: 'site.promo', props: { padding: 2 }, data: { texts: { 'title/content': [{ type: 'text', value: 'Spring' }] } } }] } } };
  cpSync(join(kit, 'template/cases'), join(folder, 'cases'), { recursive: true });
  for (const name of ['block-accent-with-content.json', 'block-default.json', 'invalid-title-missing.json']) rmSync(join(folder, 'cases', name));
  writeFileSync(join(folder, 'type.json'), JSON.stringify(manifest));
  writeFileSync(join(folder, 'cases/promo.json'), JSON.stringify({ schema: 'simai.composition.structured-content-conformance-case', schema_version: 1, id: 'promo', summary: 'A site block instance.', covers: ['site.promo'], input: { document }, expect: { valid: true, html: '', diagnostics: [], assets: [] } }));
  await checkBlock(folder, { framework, update: true });
  const report = await checkBlock(folder, { framework });
  assert.deepEqual(failed(report), [], JSON.stringify(report.groups));
  assert.deepEqual(report.warnings.filter(({ group }) => group === 'form'), [], 'the exposed padding takes layout.area\'s field');
  const promo = JSON.parse(readFileSync(join(folder, 'cases/promo.json'), 'utf8'));
  assert.equal(promo.expect.html, '<main data-sf-composition-id="root"><div class="p-2" data-sf-composition-area="" data-sf-composition-id="promo"><h2 data-sf-composition-id="promo:title">Spring</h2></div></main>');
  // An exposed parameter whose target type declares no editor field has no form field: a warning.
  const bare = composition.defineComposedType({
    type: 'site.promo',
    version: '1.0.0',
    profiles: ['ui-layout'],
    catalogue: { group: 'marketing' },
    root: { id: 'box', type: 'layout.area', props: { padding: 4 }, slots: { default: [{ id: 'title', type: 'content.heading', data: { level: 2, content: [{ type: 'text', value: 'Sale' }] } }] } },
    exposed: [{ key: 'padding', path: 'box', target: 'props.padding' }, { key: 'title_text', path: 'title', target: 'data.content' }],
  }).manifest;
  writeFileSync(join(folder, 'type.json'), JSON.stringify(bare));
  const unformed = await checkBlock(folder, { framework });
  assert.deepEqual(unformed.warnings.filter(({ group }) => group === 'form').map(({ code }) => code), ['composed_editor_field_missing']);
  writeFileSync(join(folder, 'type.json'), JSON.stringify({ ...manifest, props_schema: { ...manifest.props_schema, properties: {} } }));
  assert.ok(codes(await checkBlock(folder, { framework }), 'manifest').includes('composed_schema_drift'));
});
