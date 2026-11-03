import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { BREAKPOINTS } from '../src/core/js/breakpoints.js';
import {
  BUILTIN_CATALOGUE,
  BUILTIN_TYPE_MANIFESTS,
  Composition,
  PARAMETER_SETS,
  PRINTED_ELEMENTS,
  checkPrintedElements,
  elementInputs,
  parameterSetFields,
  printElement,
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
  // 2026-11-04: Elements and Layout replace Structure; every offered type has an icon.
  assert.ok(tabs.blocks.layout.some((entry) => entry.type === 'layout.area'));
  for (const type of ['layout.section', 'layout.columns', 'layout.container', 'layout.grid', 'layout.spacer']) assert.ok(tabs.blocks.layout.some((entry) => entry.type === type), type);
  for (const type of ['element.button', 'element.button-icon', 'element.badge', 'element.icon', 'content.divider']) assert.ok(tabs.blocks.elements.some((entry) => entry.type === type), type);
  assert.equal(tabs.blocks.structure, undefined);
  for (const entry of entries) assert.match(entry.icon ?? '', /^[a-z0-9_]+$/u, entry.type);
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
  assert.equal(html, '<main data-sf-composition-id="root"><div class="block md:hidden lg:block p-2 lg:p-4" data-sf-composition-area="" data-sf-composition-id="a"><p data-sf-composition-id="p">Text.</p></div></main>');
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
  const document = layout({ id: 's', type: 'layout.section', slots: { default: [{ id: 'p', type: 'content.paragraph', data: { content: text('Hi') } }] } });
  const before = await render(document);
  assert.equal(before.notices, undefined);
  assert.equal(before.runtime, undefined);
  // layout.section 1.2.0 (2026-11-04): unset, a section stands in the page
  // container with space above and below (its parameter defaults).
  assert.equal(before.html, '<main data-sf-composition-id="root"><section class="p-y-8" data-sf-composition-id="s"><div class="container m-inline-auto" data-sf-composition-part="frame"><div data-sf-composition-part="content"><p data-sf-composition-id="p">Hi</p></div></div></section></main>');
});

test('layout.columns 1.1.0: columns and gap per screen; a 1.0.0 Document stays valid', async () => {
  const type = BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.columns');
  assert.equal(type.version, '1.1.0');
  for (const property of Object.values(type.props_schema.properties)) for (const name of utilityClassSpace(property)) assert.ok(known(name), name);
  // The 1.0.0 fixture: one integer for every screen, no gap.
  const fixture = JSON.parse(readFileSync(new URL('tests/fixtures/composition/columns.json', root), 'utf8'));
  const checked = validate(fixture);
  assert.equal(checked.valid, true);
  assert.equal(checked.notices, undefined);
  const old = await render(fixture);
  assert.equal(old.notices, undefined);
  assert.match(old.html, /^<div class="sf-composition-columns grid gap-4 grid-col-2" data-sf-composition-id="columns" data-composition-columns="2">/u);
  // Three on the desktop, two on the tablet, one on the phone; a smaller gap on the phone.
  const columns = (props) => ({ id: 'c', type: 'layout.columns', props, slots: { columns: [{ id: 'a', type: 'content.paragraph', data: { content: text('A') } }] } });
  const responsive = layout(columns({ columns: { xs: 1, md: 2, lg: 3 }, gap: { xs: 2, md: 4 } }));
  assert.equal(validate(responsive).valid, true);
  const drawn = await render(responsive);
  assert.match(drawn.html, /<div class="sf-composition-columns grid grid-col-1 md:grid-col-2 lg:grid-col-3 gap-2 md:gap-4" data-sf-composition-id="c">/u, 'mobile first, a prefix only where the value changes, no inline style');
  assert.doesNotMatch(drawn.html, /style=/u);
  assert.equal(validate(layout(columns({ columns: { md: 13 } }))).valid, false, 'each screen\'s value is checked');
  assert.equal(validate(layout(columns({ gap: 9 }))).valid, false);
  // The editor manifest follows the type and adds the gap field.
  const editor = Composition.BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'layout.columns');
  assert.equal(editor.type_version, '1.1.0');
  assert.deepEqual(editor.fields.map(({ key }) => key), ['columns', 'gap']);
  const projected = Composition.projectEditorFields(editor, type, responsive.root.slots.default[0]);
  assert.deepEqual(projected.diagnostics, []);
  assert.deepEqual(projected.fields.map(({ key, value, screens }) => [key, value, screens]), [['columns', 1, { xs: 1, md: 2, lg: 3 }], ['gap', 2, { xs: 2, md: 4 }]]);
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

test('a site block\'s form is its exposed list with the target types\' editor fields', () => {
  const definition = promoDefinition('1.0.0', { exposed: [{ key: 'title_level', path: 'title', target: 'data.level' }, { key: 'area_hidden', path: 'box', target: 'props.hidden' }] });
  const { manifest } = defineComposedType(definition);
  const registry = extendRegistry([manifest]);
  const instance = { ...composedInstance(manifest, 'promo-1'), props: { padding: { xs: 2, lg: 6 } } };
  const form = Composition.composedEditorFields(manifest, instance, { registry });
  assert.deepEqual(form.diagnostics, []);
  assert.equal(form.valid, true);
  // An editor manifest v1 of the site block's version, made from the type; never stored.
  assert.deepEqual([form.manifest.type, form.manifest.type_version], ['site.promo', '1.0.0']);
  assert.deepEqual(Composition.validateEditorManifest(form.manifest, manifest).diagnostics, []);
  assert.deepEqual(form.fields.map(({ key, destination, label_key: label, value, source }) => [key, destination, label, value, source]), [
    ['padding', 'props.padding', 'site.promo.padding', 2, 'node'],
    ['title_level', 'props.title_level', 'sf.composition.content_heading.level', 2, 'default'],
    ['area_hidden', 'props.area_hidden', 'sf.composition.layout_area.hidden', false, 'default'],
  ]);
  assert.deepEqual(form.fields[0].screens, { xs: 2, lg: 6 }, 'a per-screen value keeps its screens');
  assert.deepEqual(form.origins.padding, { path: 'box', type: 'layout.area', target: 'props.padding' });
  // Without an instance the form shows the tree's values as defaults.
  assert.equal(Composition.composedEditorFields(manifest, undefined, { registry }).fields[0].value, 4);
  // A target whose type declares no editor field has no form field, and says so.
  const bare = defineComposedType(promoDefinition('1.0.0', { exposed: [{ key: 'lead_text', path: 'lead', target: 'data.content' }] })).manifest;
  const partial = Composition.composedEditorFields(bare, undefined, { registry: extendRegistry([bare]) });
  assert.deepEqual(partial.diagnostics.map(({ code, key }) => [code, key]), [['composed_editor_field_missing', 'lead_text']]);
  assert.deepEqual(partial.fields.map(({ key }) => key), ['padding']);
  assert.deepEqual(codes(Composition.composedEditorFields(BUILTIN_TYPE_MANIFESTS[0])), ['composed_type_required']);
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
  assert.match(failed.html, /<main data-sf-composition-id="root"><section class="p-y-8" data-sf-composition-id="s"><div class="container m-inline-auto" data-sf-composition-part="frame"><div data-sf-composition-part="content"><ul data-sf-composition-id="list" data-state="error"><\/ul><nav data-sf-composition-id="pager" data-state="error"><\/nav><\/div><\/div><\/section><\/main>/u, 'the page still draws');
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

test('demo data of every shape is that shape, for a preview without a source', () => {
  for (const name of Object.keys(Composition.DATA_SHAPES)) {
    assert.deepEqual(checkSourceAnswer('preview', Composition.demoData(name), { shape: name }), [], name);
  }
  assert.equal(Composition.demoData('cards', { count: 2 }).items.length, 2);
});

// --------------------------------------------- parameter sets and their parts

test('parameter sets: each set\'s classes are SIMAI Framework utilities, its fields have words', () => {
  assert.deepEqual(Object.keys(PARAMETER_SETS), ['background', 'spacing', 'width', 'grid', 'alignment', 'breakout', 'visibility']);
  for (const [name, set] of Object.entries(PARAMETER_SETS)) {
    for (const [key, schema] of Object.entries(set.properties)) {
      const space = utilityClassSpace(schema);
      assert.ok(Array.isArray(space) && space.length, `${name}.${key}`);
      for (const value of space) assert.ok(known(value), `${name}.${key}: ${value}`);
    }
    const fields = parameterSetFields({ parameter_sets: [name] });
    assert.equal(fields.length, set.fields.length);
    const words = Composition.editorFieldMessages({ fields });
    for (const field of fields) assert.notEqual(words[field.label_key], undefined, field.label_key);
  }
  // A type that names a set gets its props through a registry; the stored manifest keeps the names.
  const section = BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.section');
  assert.equal(section.version, '1.2.0');
  assert.deepEqual(section.parameter_defaults, { width: 'normal', padding_y: 8 });
  assert.deepEqual(Object.keys(section.props_schema.properties || {}), []);
  assert.deepEqual(Object.keys(extendRegistry().types.get('layout.section').props_schema.properties).sort(), ['align', 'background', 'breakout', 'columns', 'gap', 'hidden', 'padding_x', 'padding_y', 'width']);
  const own = { ...section, parameter_sets: ['alignment', 'shadow', 'alignment'], props_schema: { type: 'object', additionalProperties: false, properties: { align: { enum: ['left'] } } } };
  assert.deepEqual(codes(validateTypeManifest(own)).filter((code) => code.startsWith('parameter_set')).sort(), ['parameter_set_conflict', 'parameter_set_duplicate', 'parameter_set_unknown']);
});

test('width reaches three elements; a section that sets width full and no space draws as 1.0.0 did', async () => {
  const section = (id, props) => ({ id, type: 'layout.section', props, slots: { default: [paragraph(`${id}-p`, 'Text')] } });
  const drawn = await render(layout(section('n', { width: 'narrow' }), section('m', { width: 'normal' }), section('w', { width: 'wide' }), section('f', { width: 'full' })));
  assert.equal(drawn.notices, undefined);
  const part = (id) => drawn.html.slice(drawn.html.lastIndexOf('<section', drawn.html.indexOf(`data-sf-composition-id="${id}"`)), drawn.html.indexOf(`data-sf-composition-id="${id}-p"`));
  assert.match(part('n'), /<section class="p-y-8" data-sf-composition-id="n"><div class="container m-inline-auto" data-sf-composition-part="frame"><div class="max-w-prose m-inline-auto" data-sf-composition-part="content">/u);
  assert.match(part('m'), /<section class="p-y-8" data-sf-composition-id="m"><div class="container m-inline-auto" data-sf-composition-part="frame"><div data-sf-composition-part="content">/u);
  // max-container-N widens a .container that is its descendant, never one on the same element.
  assert.match(part('w'), /<section class="p-y-8 max-container-7" data-sf-composition-id="w"><div class="container m-inline-auto" data-sf-composition-part="frame">/u);
  // Full: the Document's own width wins over the type's default, no frame part.
  assert.match(part('f'), /<section class="p-y-8" data-sf-composition-id="f"><p /u);
  // Every set at once, per screen where it makes sense.
  const all = await render(layout(section('s', { background: 'container', padding_y: { xs: 4, md: 8 }, width: 'normal', columns: { md: 2, lg: 3 }, gap: 4, align: { md: 'center' }, breakout: true, hidden: { xl: true } })));
  assert.match(all.html, /<section class="md:text-center bg-surface-container container-breakout block xl:hidden p-y-4 md:p-y-8" data-sf-composition-id="s"><div class="container m-inline-auto" data-sf-composition-part="frame"><div class="grid grid-col-1 md:grid-col-2 lg:grid-col-3 gap-4" data-sf-composition-part="content">/u);
  assert.doesNotMatch(all.html, /style=/u);
  assert.equal(validate(layout(section('x', { width: 'huge' }))).valid, false);
  // The 1.0.0 form, when the Document asks for it: no parts, one class.
  assert.equal((await render(layout(section('o', { width: 'full', padding_y: 0 })))).html, '<main data-sf-composition-id="root"><section class="p-y-0" data-sf-composition-id="o"><p data-sf-composition-id="o-p">Text</p></section></main>');
  // The editor manifest follows the type with the sets' fields; width and
  // the space above and below default to what the section prints unset.
  const editor = Composition.BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'layout.section');
  assert.equal(editor.type_version, '1.2.0');
  assert.equal(editor.fields.find(({ key }) => key === 'width').default, 'normal');
  assert.equal(editor.fields.find(({ key }) => key === 'padding_y').default, 8);
  assert.deepEqual(editor.fields.map(({ key }) => key), ['surface', 'background', 'padding_y', 'padding_x', 'width', 'columns', 'gap', 'align', 'breakout', 'hidden']);
  const projected = Composition.projectEditorFields(editor, BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.section'), section('s', { padding_y: { xs: 4, md: 8 } }));
  assert.deepEqual(projected.diagnostics, []);
  assert.deepEqual(projected.fields.find(({ key }) => key === 'padding_y').screens, { xs: 4, md: 8 });
});

test('a renderer that draws no part gets a notice, and its classes go nowhere else', async () => {
  const type = { ...BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.area'), type: 'demo.box', version: '1.0.0', parameter_sets: ['width'], renderer: { kind: 'registered', name: 'demo.box' }, catalogue: { group: 'structure' } };
  const registry = extendRegistry([type], { 'demo.box': ({ node, slots }) => `<div data-sf-composition-id="${node.id}">${slots.default || ''}</div>` });
  const inner = { id: 'inner', type: 'layout.section', props: { width: 'narrow' }, slots: { default: [] } };
  const drawn = await render(layout({ id: 'b', type: 'demo.box', props: { width: 'narrow' }, slots: { default: [] } }), { registry });
  assert.deepEqual(drawn.notices.map(({ code, part }) => [code, part]), [['utility_part_missing', 'frame'], ['utility_part_missing', 'content']]);
  assert.doesNotMatch(drawn.html, /container|max-w-prose/u);
  assert.ok(inner);
});

// ----------------------------------------------------------- printed elements

test('a block prints smart elements with their manifest inputs, and nothing else', async () => {
  assert.deepEqual([...PRINTED_ELEMENTS].sort(), ['sf-badge', 'sf-button', 'sf-button-icon', 'sf-divider', 'sf-icon']);
  // The inputs are the manifests' own, without styles, free classes and alias names.
  for (const [element, folder] of [['sf-button', 'button'], ['sf-button-icon', 'button-icon'], ['sf-badge', 'badge'], ['sf-icon', 'icon']]) {
    const manifest = JSON.parse(readFileSync(new URL(`src/smart/${folder}/smart.manifest.json`, root), 'utf8'));
    const inputs = elementInputs(element).properties;
    for (const [key, schema] of Object.entries(inputs)) {
      assert.ok(key in manifest.inputs.properties, `${element} ${key}`);
      for (const word of ['type', 'enum', 'default', 'minimum', 'maximum']) if (word in schema) assert.deepEqual(schema[word], manifest.inputs.properties[key][word], `${element} ${key}.${word}`);
    }
    for (const key of ['root-style', 'root-class', 'template']) assert.equal(key in inputs, false, `${element} ${key}`);
  }
  assert.equal('type' in elementInputs('sf-button').properties, false, 'the legacy name for appearance is not printed');
  assert.deepEqual(printElement('sf-button', { text: 'Buy', appearance: 'tonal', size: '1', disabled: false, loading: true }), { html: '<sf-button appearance="tonal" loading text="Buy"></sf-button>', diagnostics: [] });
  assert.equal(printElement('sf-button', { text: '"><script>' }).html, '<sf-button text="&quot;&gt;&lt;script&gt;"></sf-button>');
  assert.deepEqual(codes(printElement('sf-button', { text: 'x', appearance: 'neon', 'root-style': 'color:red' })), ['element_input_unknown', 'schema_enum']);
  assert.deepEqual(codes(printElement('sf-button-icon', { icon: 'close' })), ['element_label_missing']);
  assert.deepEqual(codes(printElement('sf-marquee', {})), ['element_unknown']);
  assert.equal(printElement('sf-divider', { orientation: 'vertical' }).html, '<hr class="sf-divider sf-divider-vertical" aria-orientation="vertical">');
  // A renderer prints through `elements`; a refused element prints nothing and is reported.
  const type = { ...BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.area'), type: 'demo.cta', version: '1.0.0', renderer: { kind: 'registered', name: 'demo.cta' }, catalogue: { group: 'marketing' } };
  const registry = extendRegistry([type], { 'demo.cta': ({ node, elements }) => `<div data-sf-composition-id="${node.id}">${elements.print('sf-button', { text: 'Go', appearance: 'outline' })}${elements.print('sf-badge', { status: 'danger', text: 'x' })}</div>` });
  const drawn = await render(layout({ id: 'c', type: 'demo.cta', slots: { default: [] } }), { registry });
  assert.equal(drawn.html, '<main data-sf-composition-id="root"><div data-sf-composition-id="c"><sf-button appearance="outline" text="Go"></sf-button></div></main>');
  assert.deepEqual(drawn.diagnostics.map(({ code, path }) => [code, path]), [['schema_enum', 'node:c.status']]);
  // HTML a renderer wrote by hand is read the same way.
  assert.deepEqual(checkPrintedElements('<sf-badge text="New" status="success" class="m-1" data-x="1"></sf-badge>'), []);
  assert.deepEqual(checkPrintedElements('<sf-icon icon="star" weight="900" onclick="x()" style="color:red"></sf-icon><sf-button-icon icon="close"></sf-button-icon>').map(({ code }) => code), ['element_input_unknown', 'element_inline_style', 'schema_maximum', 'element_label_missing']);
});

test('SF.Composition publishes the one block editor helpers', () => {
  for (const name of ['catalogue', 'catalogueEntry', 'instantiateVariant', 'utilityClasses', 'checkModifiers', 'defineComposedType', 'upgradeComposed', 'slotAccepts', 'createSourcePort', 'validateTypeManifest', 'DATA_SHAPES', 'PARAMETER_SETS', 'withParameterSetFields', 'printElement', 'checkPrintedElements', 'PRINTED_ELEMENTS']) {
    assert.ok(name in Composition, name);
  }
});

// ------------------------------- visual parity: built-in Elements and Layout (2026-11-04)

const NEW_TYPES = ['layout.container', 'layout.grid', 'layout.spacer', 'element.button', 'element.button-icon', 'element.badge', 'element.icon'];

test('every built-in type manifest, its variants and its parameter defaults pass the type check', () => {
  for (const type of BUILTIN_TYPE_MANIFESTS) assert.deepEqual(validateTypeManifest(type).diagnostics, [], type.type);
  for (const type of NEW_TYPES) {
    const entry = BUILTIN_TYPE_MANIFESTS.find((manifest) => manifest.type === type);
    assert.equal(entry.version, '1.0.0', type);
    // Its own catalogue place agrees with the built-in table.
    assert.equal(entry.catalogue.group, BUILTIN_CATALOGUE[type], type);
    assert.equal(entry.catalogue.icon, Composition.BUILTIN_CATALOGUE_ICONS[type], type);
    assert.ok(Composition.BUILTIN_EDITOR_MANIFESTS.some((editor) => editor.type === type), `${type} has an editor manifest`);
  }
  const section = BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.section');
  assert.deepEqual(section.variants.map(({ id }) => id), ['plain', 'soft', 'accent', 'text', 'two-columns']);
  assert.deepEqual(catalogueEntry(section).variants.map(({ id }) => id), ['plain', 'soft', 'accent', 'text', 'two-columns']);
  assert.deepEqual(instantiateVariant(section, 'text', { id: 's1' }).slots.default.map(({ id, type }) => `${id} ${type}`), ['s1-area layout.area']);
  // A default names a property that prints a utility, with a value it takes.
  assert.deepEqual(codes(validateTypeManifest({ ...section, parameter_defaults: { width: 'huge', shadow: 2 } })).sort(), ['parameter_default_invalid', 'parameter_default_unknown']);
  assert.deepEqual(codes(validateTypeManifest({ ...section, catalogue: { group: 'layout', icon: 'Not An Icon' } })), ['catalogue_icon_invalid']);
});

test('the catalogue groups: Elements and Layout with icons and words; structure is a dated alias of layout', () => {
  assert.deepEqual(Composition.CATALOGUE_GROUPS, ['text', 'media', 'elements', 'layout', 'page-parts', 'marketing', 'data', 'forms']);
  assert.deepEqual(Object.keys(Composition.CATALOGUE_GROUP_TABLE), Composition.CATALOGUE_GROUPS);
  assert.deepEqual(Composition.CATALOGUE_GROUP_ALIASES, { structure: { group: 'layout', until: '2027-01-01' } });
  const old = manifest('acme.band', { catalogue: { group: 'structure' }, slots: { default: { min: 0, max: 5, groups: ['structure'] } } });
  assert.deepEqual(validateTypeManifest(old, extendRegistry([old], { 'acme.band': draw('div') })).diagnostics, []);
  assert.equal(catalogueEntry(old).group, 'layout');
  const registry = extendRegistry([old], { 'acme.band': draw('div') });
  assert.equal(slotAccepts(registry, old, 'default', 'layout.grid'), true, 'a slot that names structure takes the layout group');
  assert.equal(slotAccepts(registry, old, 'default', 'element.button'), false);
});

test('a section prints its type defaults unset; the Document\'s own values win, per screen too', async () => {
  const section = (id, props) => ({ id, type: 'layout.section', ...(props ? { props } : {}), slots: { default: [paragraph(`${id}-p`, 'Text')] } });
  const drawn = await render(layout(section('a'), section('b', { padding_y: { xs: 4, lg: 8 } }), section('c', { width: 'wide', padding_y: 2 })));
  assert.match(drawn.html, /<section class="p-y-8" data-sf-composition-id="a"><div class="container m-inline-auto" data-sf-composition-part="frame">/u);
  assert.match(drawn.html, /<section class="p-y-4 lg:p-y-8" data-sf-composition-id="b"><div class="container m-inline-auto" data-sf-composition-part="frame">/u);
  assert.match(drawn.html, /<section class="p-y-2 max-container-7" data-sf-composition-id="c"><div class="container m-inline-auto" data-sf-composition-part="frame">/u);
  const type = extendRegistry().types.get('layout.section');
  assert.deepEqual(Composition.effectiveProps({ id: 'x', type: 'layout.section', props: { width: 'narrow' } }, type), { width: 'narrow', padding_y: 8 });
});

test('the Elements and Layout types draw SIMAI Framework utilities and smart elements only', async () => {
  const document = layout({
    id: 's', type: 'layout.section', slots: { default: [
      { id: 'c', type: 'layout.container', slots: { default: [paragraph('c-p', 'Narrow')] } },
      { id: 'g', type: 'layout.grid', slots: { default: [{ id: 'g1', type: 'content.card' }, { id: 'g2', type: 'content.card' }] } },
      { id: 'sp', type: 'layout.spacer' },
      { id: 'b', type: 'element.button', data: { text: 'Подробнее' }, props: { icon: 'arrow_forward', icon_position: 'end' } },
      { id: 'bi', type: 'element.button-icon', data: { label: 'Нравится' } },
      { id: 'bd', type: 'element.badge' },
      { id: 'i', type: 'element.icon', props: { size: '4' } },
    ] },
  });
  document.locale = 'ru';
  const output = await render(document);
  assert.deepEqual(output.diagnostics, []);
  assert.equal(output.notices, undefined);
  const html = output.html;
  assert.match(html, /<div data-sf-composition-id="c"><div class="container m-inline-auto" data-sf-composition-part="frame"><div class="max-w-prose m-inline-auto" data-sf-composition-part="content">/u);
  assert.match(html, /<div data-sf-composition-id="g"><div class="grid grid-col-1 md:grid-col-3 gap-4" data-sf-composition-part="content"><div class="min-w-0"><div class="sf-card"/u);
  assert.match(html, /<div class="p-top-6" aria-hidden="true" data-sf-composition-id="sp"><\/div>/u);
  assert.match(html, /<div data-sf-composition-id="b"><sf-button icon="arrow_forward" icon-position="end" text="Подробнее"><\/sf-button><\/div>/u);
  assert.match(html, /<div data-sf-composition-id="bi"><sf-button-icon appearance="tonal" aria-label="Нравится" icon="favorite"><\/sf-button-icon><\/div>/u);
  assert.match(html, /<div data-sf-composition-id="bd"><sf-badge appearance="tonal" scheme="primary" size="1\/2" text="Метка"><\/sf-badge><\/div>/u, 'unset, the badge reads its word in the Document\'s language');
  assert.match(html, /<div data-sf-composition-id="i"><sf-icon icon="star" size="4"><\/sf-icon><\/div>/u);
  assert.deepEqual(checkPrintedElements(html), []);
  assert.doesNotMatch(html, /style=/u);
  for (const type of NEW_TYPES) {
    const entry = extendRegistry().types.get(type);
    for (const property of Object.values(entry.props_schema.properties)) for (const name of utilityClassSpace(property)) assert.ok(known(name), `${type}: ${name}`);
  }
  assert.deepEqual(output.assets, ['component/card', 'smart/badge', 'smart/button', 'smart/button-icon', 'smart/icon']);
  // An English Document, and a value the element refuses.
  const english = await render(layout({ id: 'b2', type: 'element.button' }));
  assert.match(english.html, /<sf-button text="Button"><\/sf-button>/u);
  assert.equal(validate(layout({ id: 'b3', type: 'element.button', props: { size: '3' } })).valid, false);
});

test('G-36: the phone\'s value is printed as the base once a wider screen differs, even when it is the default', () => {
  const columns = extendRegistry().types.get('layout.columns');
  const node = (props) => ({ id: 'c', type: 'layout.columns', props });
  assert.deepEqual(utilityClasses(node({ columns: { xs: 1, md: 2 } }), columns), ['grid-col-1', 'md:grid-col-2']);
  assert.deepEqual(utilityClasses(node({ columns: { md: 3 } }), columns), ['grid-col-1', 'md:grid-col-3'], 'unset at the phone: the default is the base');
  // The default on every screen still prints nothing.
  assert.deepEqual(utilityClasses(node({ columns: 1 }), columns), []);
  assert.deepEqual(utilityClasses(node({ columns: { xs: 1, lg: 1 } }), columns), []);
  const area = extendRegistry().types.get('layout.area');
  assert.deepEqual(utilityClasses({ id: 'a', type: 'layout.area', props: { hidden: { md: true } } }, area), ['block', 'md:hidden']);
  assert.deepEqual(utilityClasses({ id: 'a', type: 'layout.area', props: { hidden: false } }, area), []);
});
