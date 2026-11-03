import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { BREAKPOINTS } from '../src/core/js/breakpoints.js';
import {
  BUILTIN_CATALOGUE,
  BUILTIN_TYPE_MANIFESTS,
  Composition,
  UTILITY_BREAKPOINTS,
  catalogue,
  catalogueEntry,
  checkModifiers,
  checkSourceAnswer,
  composedInstance,
  composedPart,
  composedTextPaths,
  createSourcePort,
  defineComposedType,
  extendRegistry,
  instantiateVariant,
  render,
  slotAccepts,
  upgradeComposed,
  utilityClassSpace,
  utilityClasses,
  validate,
  validateTypeManifest,
} from '../src/core/js/composition/index.mjs';

// The one block editor's contracts (owner 2026-11-03; ui-control
// control/ui-editor/UNIFIED-BLOCK-EDITOR.md): catalogue and variants, layout
// parameters as SIMAI Framework utilities, own modifiers, site blocks, named
// places and data. All additive: a Document of composition-document v1 that
// uses none of it validates and draws as before.

const root = new URL('../', import.meta.url);
const SF = { RuleLoader: {} };
for (const name of readdirSync(new URL('src/utility/', root))) {
  for (const variant of UTILITY_BREAKPOINTS.map((breakpoint) => (breakpoint === 'xs' ? 'default' : breakpoint))) {
    const file = new URL(`src/utility/${name}/${variant}/rule.js`, root);
    if (existsSync(file)) vm.runInNewContext(readFileSync(file, 'utf8'), { SF, RegExp });
  }
}
const rules = SF.RuleLoader;
const known = (name) => Object.values(rules).some((rule) => rule instanceof RegExp && rule.test(name));

const text = (value) => [{ type: 'text', value }];
const paragraph = (id, value) => ({ id, type: 'content.paragraph', data: { content: text(value) } });
const heading = (id, value) => ({ id, type: 'content.heading', data: { level: 2, content: text(value) } });
const layout = (...children) => ({ schema: 'simai.composition.document', schema_version: 1, id: 'page', profile: 'ui-layout', root: { id: 'root', type: 'layout.page', slots: { default: children } } });
const codes = (result) => result.diagnostics.map(({ code }) => code);
const manifest = (type, fields) => ({
  schema: 'simai.composition.type-manifest',
  schema_version: 1,
  type,
  version: '1.0.0',
  category: 'layout',
  mode: 'composite',
  profiles: ['ui-layout'],
  data_schema: { type: 'object', additionalProperties: false, properties: {} },
  props_schema: { type: 'object', additionalProperties: false, properties: {} },
  presentation: { views: ['default'], presets: [], modifiers: [] },
  slots: {},
  renderer: { kind: 'registered', name: type },
  assets: [],
  capabilities: ['html'],
  ...fields,
});
const draw = (tag) => ({ node, slots }) => `<${tag} data-sf-composition-id="${node.id}">${Object.entries(slots).filter(([key]) => !key.endsWith('List')).map(([, html]) => html).join('')}</${tag}>`;

// --------------------------------------------------------------- 1. catalogue

test('the breakpoints of a layout parameter are the SIMAI Framework ladder', () => {
  assert.deepEqual(UTILITY_BREAKPOINTS, Object.keys(BREAKPOINTS));
});

test('every built-in type has a place in the catalogue or is kept out of it', () => {
  for (const { type } of BUILTIN_TYPE_MANIFESTS) assert.ok(Object.hasOwn(BUILTIN_CATALOGUE, type), type);
  const { tabs, entries } = catalogue(extendRegistry());
  assert.deepEqual(Object.keys(tabs).sort(), ['blocks', 'text']);
  assert.ok(tabs.text.text.some((entry) => entry.type === 'content.paragraph'));
  assert.ok(tabs.text.media.some((entry) => entry.type === 'content.figure'));
  assert.ok(tabs.blocks.structure.some((entry) => entry.type === 'layout.area'));
  for (const hidden of ['layout.page', 'content.list-item', 'content.outlet']) assert.equal(entries.some((entry) => entry.type === hidden), false, hidden);
});

test('a product type takes a fixed group or its namespace, a tab, words and variants', () => {
  const card = manifest('acme.promo', {
    catalogue: { group: 'marketing', label_key: 'acme.promo.name', keywords: { en: ['banner'], ru: ['баннер'] }, order: 10 },
    props_schema: { type: 'object', additionalProperties: false, properties: { tone: { enum: ['plain', 'accent'] } } },
    slots: { default: { min: 0, max: 10, categories: ['content'] } },
    variants: [
      { id: 'accent', label_key: 'acme.promo.accent', props: { tone: 'accent' }, slots: { default: [heading('title', 'Sale'), paragraph('text', 'Now.')] } },
      { id: 'plain', label_key: 'acme.promo.plain' },
    ],
  });
  const registry = extendRegistry([card], { 'acme.promo': draw('section') });
  assert.deepEqual(validateTypeManifest(card, registry), { valid: true, diagnostics: [] });
  const entry = catalogueEntry(card);
  assert.equal(entry.group, 'marketing');
  assert.equal(entry.tab, 'blocks');
  assert.deepEqual(entry.variants.map(({ id }) => id), ['accent', 'plain']);
  assert.equal(catalogueEntry(manifest('acme.other', {})).group, 'acme', 'a product type falls into its namespace');
  // A variant becomes a node with new ids; inserting it twice gives no clash.
  const first = instantiateVariant(card, 'accent', { id: 'promo-1' });
  const second = instantiateVariant(card, 'accent', { id: 'promo-2' });
  assert.deepEqual(first.slots.default.map(({ id }) => id), ['promo-1-title', 'promo-1-text']);
  assert.equal(first.props.tone, 'accent');
  assert.equal(validate(layout(first, second), registry).valid, true);
  // The manifest's own problems: an unknown group, a broken variant.
  const broken = { ...card, catalogue: { group: 'gadgets' }, variants: [{ id: 'x', label_key: 'acme.x', props: { tone: 'loud' } }] };
  const checked = validateTypeManifest(broken, registry);
  assert.deepEqual([...new Set(codes(checked))].sort(), ['catalogue_group_unknown', 'schema_enum']);
  assert.ok(checked.diagnostics.some((item) => item.path.startsWith('$.variants.x')));
});

// ----------------------------------------------- 2. layout parameters as utilities

test('a responsive layout parameter prints SIMAI Framework utilities mobile first, a prefix only where it changes', async () => {
  const grid = manifest('acme.grid', {
    props_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        cols: { type: 'integer', minimum: 1, maximum: 12, 'x-simai-utility': { class: 'grid-col-{value}', responsive: true } },
        gap: { type: 'integer', minimum: 0, maximum: 8, 'x-simai-utility': { class: 'gap-{value}', responsive: true } },
        span: { type: 'integer', minimum: 1, maximum: 12, 'x-simai-utility': { class: 'col-span-{value}' } },
      },
    },
    slots: { default: { min: 0, max: 12, categories: ['content'] } },
  });
  const registry = extendRegistry([grid], { 'acme.grid': ({ node, slots }) => `<div class="grid" data-sf-composition-id="${node.id}">${slots.default || ''}</div>` });
  assert.deepEqual(validateTypeManifest(grid, registry).diagnostics, []);
  const node = { id: 'g', type: 'acme.grid', props: { cols: { xs: 1, md: 2, lg: 3, xl: 3 }, gap: 6, span: 2 } };
  assert.deepEqual(utilityClasses(node, grid), ['grid-col-1', 'md:grid-col-2', 'lg:grid-col-3', 'gap-6', 'col-span-2']);
  const { html, diagnostics } = await render(layout(node), { registry });
  assert.deepEqual(diagnostics, []);
  assert.match(html, /<div class="grid grid-col-1 md:grid-col-2 lg:grid-col-3 gap-6 col-span-2" data-sf-composition-id="g">/u);
  assert.doesNotMatch(html, /style=/u, 'no inline style for grid, gap or padding');
  // Every class a parameter can print is a real utility.
  for (const property of Object.values(grid.props_schema.properties)) for (const name of utilityClassSpace(property)) assert.ok(known(name), name);
  // A value per screen is checked value by value; an unknown screen is refused.
  assert.deepEqual(codes(validate(layout({ ...node, props: { cols: { md: 13 } } }), registry)), ['schema_maximum']);
  assert.deepEqual(codes(validate(layout({ ...node, props: { cols: { tablet: 2 } } }), registry)), ['breakpoint_unknown']);
  assert.deepEqual(codes(validate(layout({ ...node, props: { span: { md: 2 } } }), registry)), ['schema_type'], 'a parameter that is not responsive holds one value');
});

test('layout.area: a text area whose padding and visibility are utilities per screen', async () => {
  const area = { id: 'a', type: 'layout.area', props: { padding: { xs: 2, lg: 4 }, hidden: { md: true, lg: false } }, slots: { default: [paragraph('p', 'Text.')] } };
  const { html, diagnostics } = await render(layout(area));
  assert.deepEqual(diagnostics, []);
  assert.equal(html, '<main data-sf-composition-id="root"><div class="md:hidden lg:block p-2 lg:p-4" data-sf-composition-area="" data-sf-composition-id="a"><p data-sf-composition-id="p">Text.</p></div></main>');
  // The parameter form shows the phone's value and the screens that differ.
  const editor = Composition.BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'layout.area');
  const projected = Composition.projectEditorFields(editor, BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.area'), area);
  assert.deepEqual(projected.diagnostics, []);
  assert.deepEqual(projected.fields.map(({ key, value, screens }) => [key, value, screens]), [['padding', 2, { xs: 2, lg: 4 }], ['hidden', false, { md: true, lg: false }]]);
  const plain = await render(layout({ id: 'a', type: 'layout.area' }));
  assert.equal(plain.html, '<main data-sf-composition-id="root"><div data-sf-composition-area="" data-sf-composition-id="a"></div></main>', 'the default prints no class');
  const type = BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.area');
  for (const property of Object.values(type.props_schema.properties)) for (const name of utilityClassSpace(property)) assert.ok(known(name), name);
  assert.deepEqual(codes(validate(layout({ id: 'a', type: 'layout.area', slots: { default: [{ id: 's', type: 'layout.section' }] } }))), ['slot_child_category_forbidden'], 'an author writes content, not layout');
});

test('a Document that uses none of it draws as before', async () => {
  const fixture = JSON.parse(readFileSync(new URL('tests/fixtures/composition/columns.json', root), 'utf8'));
  const before = await render(fixture);
  assert.equal(before.notices, undefined);
  assert.equal(before.runtime, undefined);
  assert.doesNotMatch(before.html, /grid-col|data-sf-composition-area/u);
});

// ------------------------------------------------------------ 3. own modifiers

test('own modifiers: classes the utility rules know are printed, the rest left out and reported', async () => {
  const node = { id: 'p', type: 'content.paragraph', data: { content: text('Hi') }, extensions: { 'simai.composition:modifiers': { utilities: ['md:p-x-3', 'hidden', 'evil-class', 'lg:gap-2', 'x"><script>'] } } };
  const document = layout(node);
  const checked = validate(document, undefined, { utilityRules: rules });
  assert.equal(checked.valid, true, 'an unknown class never refuses a Document');
  assert.deepEqual(checked.notices.map(({ code, class: name }) => [code, name]), [['modifier_unknown', 'evil-class'], ['modifier_invalid', 'x"><script>']]);
  const drawn = await render(document, { options: { utilityRules: rules } });
  assert.equal(drawn.html, '<main data-sf-composition-id="root"><p class="md:p-x-3 hidden lg:gap-2" data-sf-composition-id="p">Hi</p></main>');
  assert.deepEqual(drawn.notices.map(({ code }) => code), ['modifier_unknown', 'modifier_invalid']);
  // Without the rules nothing unchecked is printed.
  const blind = await render(document);
  assert.doesNotMatch(blind.html, /class=/u);
  assert.ok(blind.notices.every(({ code }) => ['modifier_rules_unavailable', 'modifier_invalid'].includes(code)));
  assert.deepEqual(checkModifiers(['p-2', 'nope'], { rules }), { kept: ['p-2'], dropped: [{ class: 'nope', reason: 'modifier_unknown' }] });
  // A class joins the element's own once.
  const figure = { id: 'f', type: 'content.divider', extensions: { 'simai.composition:modifiers': { utilities: ['m-block-4'] } } };
  const divider = await render({ ...layout(figure), profile: 'ui-layout' }, { options: { utilityRules: rules } });
  assert.match(divider.html, /<hr class="sf-divider sf-divider-horizontal m-block-4" data-sf-composition-id="f">/u);
});

// --------------------------------------------------------- 4. site blocks

const promoDefinition = (version, extra = {}) => ({
  type: 'site.promo',
  version,
  profiles: ['ui-layout'],
  catalogue: { group: 'marketing', label_key: 'site.promo.name' },
  root: {
    id: 'box',
    type: 'layout.area',
    props: { padding: 4 },
    slots: { default: [heading('title', 'Default title'), paragraph('lead', 'Default lead.'), ...(extra.children || [])] },
  },
  exposed: [{ key: 'padding', path: 'box', target: 'props.padding', label_key: 'site.promo.padding' }, ...(extra.exposed || [])],
});

test('a site block is a type made of blocks; an instance stores only its version, values and texts', async () => {
  const v1 = defineComposedType(promoDefinition('1.0.0'));
  assert.deepEqual(v1.diagnostics, []);
  assert.equal(v1.manifest.renderer.name, 'composed');
  assert.deepEqual(v1.manifest.props_schema.properties.padding.default, 4, 'the tree\'s value is the default');
  const registry = extendRegistry([v1.manifest]);
  assert.deepEqual(validateTypeManifest(v1.manifest, registry).diagnostics, []);
  assert.deepEqual(composedTextPaths(v1.manifest, registry), ['title/content', 'lead/content']);
  const instance = { ...composedInstance(v1.manifest, 'promo-1'), props: { padding: 2 }, data: { texts: { 'title/content': text('Spring sale') } } };
  const document = layout(instance);
  assert.deepEqual(validate(document, registry), { valid: true, diagnostics: [] });
  const drawn = await render(document, { registry });
  assert.deepEqual(drawn.diagnostics, []);
  assert.equal(drawn.html, '<main data-sf-composition-id="root"><div class="p-2" data-sf-composition-area="" data-sf-composition-id="promo-1"><h2 data-sf-composition-id="promo-1:title">Spring sale</h2><p data-sf-composition-id="promo-1:lead">Default lead.</p></div></main>');
  assert.deepEqual(composedPart('promo-1:title'), { instance: 'promo-1', node: 'title', root: false });
  // The author edits texts and exposed values only: anything else is refused.
  assert.ok(codes(validate(layout({ ...instance, props: { tone: 'x' } }), registry)).includes('schema_additional_property'));
  assert.ok(codes(validate(layout({ ...instance, slots: { default: [] } }), registry)).includes('leaf_slots_forbidden'));
  assert.ok(codes(validate(layout({ ...instance, data: { texts: { 'title/content': [{ type: 'link', href: 'javascript:alert(1)', children: text('x') }] } } }), registry)).includes('unsafe_url'));
  // A site block never holds itself.
  const cyclic = defineComposedType({ ...promoDefinition('1.0.1'), root: { id: 'box', type: 'layout.area', slots: { default: [{ id: 'self', type: 'site.promo' }] } } }, registry);
  assert.ok(codes(cyclic).includes('composed_cycle'));
});

test('a new version reaches every instance; the author\'s texts and values stay', async () => {
  const v1 = defineComposedType(promoDefinition('1.0.0')).manifest;
  const instances = ['a', 'b'].map((id) => ({ ...composedInstance(v1, id), props: { padding: 1 }, data: { texts: { 'title/content': text(`Title ${id}`), 'lead/content': text(`Lead ${id}`) } } }));
  const document = layout(...instances);
  // Version 2 adds a note and lets the author pick the note's text block; the
  // stored Document is not touched.
  const v2 = defineComposedType(promoDefinition('1.1.0', { children: [paragraph('note', 'New in 1.1.')] }), extendRegistry()).manifest;
  const drawn = await render(document, { registry: extendRegistry([v2]) });
  assert.deepEqual(drawn.diagnostics, []);
  for (const id of ['a', 'b']) {
    assert.match(drawn.html, new RegExp(`<h2 data-sf-composition-id="${id}:title">Title ${id}</h2><p data-sf-composition-id="${id}:lead">Lead ${id}</p><p data-sf-composition-id="${id}:note">New in 1.1.</p>`, 'u'));
  }
  assert.ok(drawn.notices.every(({ code }) => code === 'composed_version_behind'));
  const upgraded = upgradeComposed(document, extendRegistry([v2]));
  assert.deepEqual(upgraded.changes.map(({ id, from, to, dropped }) => [id, from, to, dropped]), [['a', '1.0.0', '1.1.0', { texts: [], values: [] }], ['b', '1.0.0', '1.1.0', { texts: [], values: [] }]]);
  assert.deepEqual(upgraded.document.root.slots.default[0].data, instances[0].data, 'texts stay byte for byte');
  assert.deepEqual(upgraded.document.root.slots.default[0].props, { padding: 1 });
  assert.equal(document.root.slots.default[0].extensions['simai.composition:composed'].version, '1.0.0', 'the input is not changed');
  // Version 3 removes the lead and narrows padding: what is gone is reported,
  // the rest stays.
  const v3Definition = promoDefinition('2.0.0');
  v3Definition.root.slots.default = [heading('title', 'Default title')];
  const v3 = defineComposedType(v3Definition).manifest;
  const narrowed = { ...v3, props_schema: { ...v3.props_schema, properties: { padding: { ...v3.props_schema.properties.padding, minimum: 2 } } } };
  const before = validate(document, extendRegistry([narrowed]));
  assert.ok(codes(before).includes('schema_minimum'), 'a narrowed value is refused until the upgrade');
  const moved = upgradeComposed(document, extendRegistry([narrowed]));
  assert.deepEqual(moved.changes[0].dropped, { texts: ['lead/content'], values: ['padding'] });
  assert.deepEqual(moved.document.root.slots.default[0].data, { texts: { 'title/content': text('Title a') } });
  assert.equal(validate(moved.document, extendRegistry([narrowed])).valid, true);
  // An orphaned text is kept and not drawn before the upgrade.
  const orphan = validate(layout(instances[0]), extendRegistry([v3]));
  assert.equal(orphan.valid, true);
  assert.ok(orphan.notices.some(({ code }) => code === 'composed_text_orphaned'));
});

// ------------------------------------------------------------ 5. named places

test('named places: each slot declares what it accepts, by type, category or catalogue group, with its words', async () => {
  const hero = manifest('acme.hero', {
    catalogue: { group: 'marketing' },
    slots: {
      text: { min: 0, max: 10, categories: ['content'], groups: ['text'], label_key: 'acme.hero.text', empty_key: 'acme.hero.text_empty' },
      media: { min: 0, max: 1, groups: ['media'], label_key: 'acme.hero.media', empty_key: 'acme.hero.media_empty' },
    },
  });
  const registry = extendRegistry([hero], { 'acme.hero': draw('section') });
  assert.deepEqual(validateTypeManifest(hero, registry).diagnostics, []);
  const figure = { id: 'img', type: 'content.figure', data: { src: '/a.webp', alt: '' } };
  const node = { id: 'h', type: 'acme.hero', slots: { text: [heading('t', 'Title')], media: [figure] } };
  assert.equal(validate(layout(node), registry).valid, true);
  assert.deepEqual(codes(validate(layout({ ...node, slots: { text: [figure] } }), registry)), ['slot_child_group_forbidden']);
  assert.deepEqual(codes(validate(layout({ ...node, slots: { media: [figure, { ...figure, id: 'img2' }] } }), registry)), ['slot_cardinality']);
  assert.equal(slotAccepts(registry, hero, 'media', 'content.figure'), true);
  assert.equal(slotAccepts(registry, hero, 'media', 'content.paragraph'), false);
  const media = catalogue(registry, { parent: 'acme.hero', slot: 'media' });
  assert.deepEqual(Object.keys(media.tabs), ['text'], 'a tab with nothing that fits is not shown');
  assert.ok(media.entries.every((entry) => entry.group === 'media'));
  assert.deepEqual(Composition.slotPlaces(hero).map(({ name, empty_key: empty }) => [name, empty]), [['text', 'acme.hero.text_empty'], ['media', 'acme.hero.media_empty']]);
});

// --------------------------------------------------------------------- 6. data

const cardsType = manifest('acme.cards', {
  category: 'content',
  mode: 'leaf',
  catalogue: { group: 'data' },
  data_bindings: { items: { shapes: ['cards'] } },
  runtime: { publishes: { pagination: { shape: 'pagination', binding: 'items' } } },
});
const pagerType = manifest('acme.pager', { category: 'content', mode: 'leaf', runtime: { accepts: { pagination: { shape: 'pagination' } } } });
const drawCards = ({ node, resolvedBindings, bindingStates }) => {
  const state = bindingStates.items;
  const items = state === 'ready' || state === 'preview' ? resolvedBindings.items.items.map((item) => `<li>${item.title}</li>`).join('') : '';
  return `<ul data-sf-composition-id="${node.id}" data-state="${state}">${items}</ul>`;
};
const drawPager = ({ node, resolvedBindings, bindingStates }) => `<nav data-sf-composition-id="${node.id}" data-state="${bindingStates.pagination}">${resolvedBindings.pagination ? `${resolvedBindings.pagination.page}/${resolvedBindings.pagination.pages}` : ''}</nav>`;
const dataRegistry = () => extendRegistry([cardsType, pagerType], { 'acme.cards': drawCards, 'acme.pager': drawPager });
const section = (...children) => ({ id: 's', type: 'layout.section', slots: { default: children } });
const list = { id: 'list', type: 'acme.cards', bindings: [{ owner: 'host', ref: 'catalogue.news', target: 'items', revision: 'r1' }], extensions: { 'simai.composition:data': { items: { mapping: { image: 'PREVIEW_PICTURE' }, sort: [{ field: 'date', direction: 'desc' }], limit: 6, page_param: 'page', params: { page: { from: 'url', key: 'page' } }, empty_text: 'No news yet' } } } };
const pager = { id: 'pager', type: 'acme.pager', bindings: [{ owner: 'section', ref: 'list#pagination', target: 'pagination' }] };

test('data: a type takes shapes; a binding names the source, the settings ride beside it, the host reads the query', () => {
  const registry = dataRegistry();
  for (const type of [cardsType, pagerType]) assert.deepEqual(validateTypeManifest(type, registry).diagnostics, [], type.type);
  assert.deepEqual(validate(layout(section(list, pager)), registry), { valid: true, diagnostics: [] });
  const wrong = (patch) => codes(validate(layout(section({ ...list, ...patch }, pager)), registry));
  assert.deepEqual(wrong({ bindings: [{ owner: 'host', ref: 'x', target: 'rows' }] }), ['binding_target_undeclared']);
  assert.deepEqual(wrong({ extensions: { 'simai.composition:data': { items: { shape: 'menu' } } } }), ['data_shape_not_taken']);
  assert.deepEqual(wrong({ extensions: { 'simai.composition:data': { items: { mapping: { colour: 'COLOR' } } } } }), ['data_mapping_field_unknown']);
  assert.deepEqual(wrong({ extensions: { 'simai.composition:data': { items: { limit: 0, sort: 'date' } } } }), ['data_sort_invalid', 'data_limit_invalid']);
  // The runtime link stays inside one section and needs a published state.
  assert.deepEqual(codes(validate(layout(section(list), { ...section(pager), id: 's2' }), registry)), ['runtime_publisher_missing']);
  assert.deepEqual(codes(validate(layout(section(list, { ...pager, bindings: [{ owner: 'section', ref: 'list#cursor', target: 'pagination' }] })), registry)), ['runtime_state_unknown']);
  // A type that declares nothing is untouched by these rules, as in v1.
  assert.equal(validate(layout({ ...paragraph('p', 'x'), bindings: [{ owner: 'section', ref: 'anything', target: 'x' }] })).valid, true);
  assert.deepEqual(codes(validate(layout({ ...paragraph('p', 'x'), extensions: { 'simai.composition:data': {} } }))), ['data_binding_undeclared']);
});

test('data at render: the host gives the data, the list publishes its page, every state draws, a failure stays inside its block', async () => {
  const registry = dataRegistry();
  const document = layout(section(list, pager));
  const asked = [];
  const answer = { items: [{ title: 'One' }, { title: 'Two' }], page: 2, pages: 5, total: 42 };
  const ready = await render(document, { registry, resolveBinding: (binding, { shape, settings }) => { asked.push([binding.ref, shape, settings.limit]); return answer; } });
  assert.deepEqual(asked, [['catalogue.news', 'cards', 6]]);
  assert.match(ready.html, /<ul data-sf-composition-id="list" data-state="ready"><li>One<\/li><li>Two<\/li><\/ul><nav data-sf-composition-id="pager" data-state="ready">2\/5<\/nav>/u);
  assert.deepEqual(ready.runtime, [{ from: 'list', state: 'pagination', to: 'pager', target: 'pagination' }]);
  const preview = await render(document, { registry, preview: true, resolveBinding: () => answer });
  assert.match(preview.html, /data-state="preview"/u);
  const empty = await render(document, { registry, resolveBinding: () => ({ items: [] }) });
  assert.match(empty.html, /<ul data-sf-composition-id="list" data-state="empty"><\/ul>/u);
  const loading = await render(document, { registry, resolveBinding: () => undefined });
  assert.match(loading.html, /data-state="loading"/u);
  const failed = await render(document, { registry, resolveBinding: () => { throw new Error('database down'); } });
  assert.match(failed.html, /<main data-sf-composition-id="root"><section data-sf-composition-id="s"><ul data-sf-composition-id="list" data-state="error"><\/ul><nav data-sf-composition-id="pager" data-state="error"><\/nav><\/section><\/main>/u, 'the page still draws');
  assert.deepEqual(failed.diagnostics.map(({ code, path }) => [code, path]), [['binding_failed', 'node:list']]);
  const malformed = await render(document, { registry, resolveBinding: () => ({ items: [{ name: 'no title' }] }) });
  assert.match(malformed.html, /data-state="error"/u);
  assert.deepEqual(malformed.diagnostics.map(({ code }) => code), ['binding_shape_mismatch']);
});

test('the source port: an editor asks the host for sources, fields and a preview, and every answer is checked', async () => {
  const host = {
    sources: async (shape) => [{ id: 'catalogue.news', label: 'News', shapes: [shape], presets: [{ id: 'news', label: 'News cards', shape: 'cards', mapping: { title: 'NAME', image: 'PREVIEW_PICTURE' } }] }],
    fields: async () => [{ key: 'NAME', label: 'Name', type: 'string' }],
    preview: async () => ({ items: [{ title: 'Demo' }], page: 1, pages: 1 }),
  };
  const port = createSourcePort(host);
  assert.equal((await port.sources('cards'))[0].id, 'catalogue.news');
  assert.equal((await port.fields('catalogue.news'))[0].key, 'NAME');
  assert.equal((await port.preview(list.bindings[0], { shape: 'cards' })).items[0].title, 'Demo');
  const drawn = await render(layout(section(list, pager)), { registry: dataRegistry(), resolveBinding: port.resolveBinding, preview: true });
  assert.match(drawn.html, /data-state="preview"><li>Demo<\/li>/u);
  await assert.rejects(createSourcePort({ ...host, sources: async () => [{ id: 'x', label: 'X', shapes: ['nonsense'] }] }).sources('cards'), /composition_source_answer_invalid:sources/u);
  assert.deepEqual(checkSourceAnswer('preview', { items: 'no' }, { shape: 'cards' }).map(({ code }) => code), ['schema_type']);
  assert.throws(() => createSourcePort({ sources() {} }), /composition_source_port_incomplete/u);
});

test('SF.Composition publishes the one block editor helpers', () => {
  for (const name of ['catalogue', 'catalogueEntry', 'instantiateVariant', 'utilityClasses', 'checkModifiers', 'defineComposedType', 'upgradeComposed', 'slotAccepts', 'createSourcePort', 'validateTypeManifest', 'DATA_SHAPES']) {
    assert.ok(name in Composition, name);
  }
});
