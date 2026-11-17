import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import './support/russian-language-file.mjs';

import {PLACES, PROPERTY_TYPES, STRING_VARIANT_TYPES, TEMPLATE_ALIASES, TYPE_ALIASES} from '../src/smart/field-renderers/registry.js';
import {resolveField, templateParam} from '../src/smart/field-renderers/templates.js';

// Owner decisions C302 and C303 (2026-11-17; catalogue ui-control research
// 2026-11-17-type-template-catalogue): a type stores and checks, a template
// only draws; one template per field, in four places; template and
// templateParams in the field description, the former names read until
// 2027-01-01 with one console warning each; an unknown or unfitting template
// draws the type's default with template_fallback.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const mapKeys = (name) => {
  const body = source.slice(source.indexOf(`${name} = {`), source.indexOf('};', source.indexOf(`${name} = {`)));
  return new Set([...body.matchAll(/^\s+'?([a-z.-]+)'?:/gmu)].map(([, key]) => key));
};
const MAPS = {view: mapKeys('VIEW_RENDERERS'), edit: mapKeys('EDIT_RENDERERS'), cell: mapKeys('CELL_RENDERERS'), filter: mapKeys('FILTER_RENDERERS')};

// The console the warnings go to, captured; the shared "said once" set and
// the deprecation notes are cleared before each case.
function capture(run) {
  const said = [];
  const warn = console.warn;
  console.warn = (...parts) => said.push(parts.join(' '));
  try {
    run();
  } finally {
    console.warn = warn;
  }
  return said;
}
const fresh = () => {
  globalThis.SF?.__fieldTemplateNotes?.clear?.();
  globalThis.SF?.deprecations?.clear?.();
};

test('the four places, and every type lists its templates with exactly one default, first', () => {
  assert.deepEqual([...PLACES], ['view', 'compact', 'edit', 'filter']);
  for (const entry of PROPERTY_TYPES) {
    assert.ok(entry.templates.length >= 1, entry.type);
    assert.equal(entry.templates[0].default, true, `${entry.type}: the default first`);
    assert.equal(entry.templates.filter((one) => one.default).length, 1, `${entry.type}: one default`);
    assert.deepEqual([...entry.templates[0].places], [...PLACES], `${entry.type}: the default draws in every place`);
    const ids = entry.templates.map((one) => one.id);
    assert.equal(new Set(ids).size, ids.length, `${entry.type}: ids unique`);
    for (const one of entry.templates) {
      assert.match(one.id, /^[a-z][a-z0-9_]*$/u, `${entry.type}.${one.id}: the standard id pattern (underscore)`);
      assert.ok(one.places.length >= 1 && one.places.every((place) => PLACES.includes(place)), `${entry.type}.${one.id}: places`);
      assert.ok(one.label.ru && one.label.en, `${entry.type}.${one.id}: named in both languages`);
      assert.notEqual(one.label.ru, one.label.en, `${entry.type}.${one.id}: the Russian name is the language file's`);
    }
  }
});

test('the catalogue names and types (C302, C303)', () => {
  const types = PROPERTY_TYPES.map((entry) => entry.type);
  for (const type of ['phone', 'password', 'number', 'money', 'percent', 'boolean', 'choice', 'choices', 'complex']) assert.ok(types.includes(type), type);
  for (const type of ['integer', 'compound']) assert.ok(!types.includes(type), `${type} is a former name`);
  const templates = (type) => PROPERTY_TYPES.find((entry) => entry.type === type).templates.map((one) => one.id);
  assert.deepEqual(templates('phone'), ['phone_input']);
  assert.deepEqual(templates('password'), ['input']);
  assert.deepEqual(templates('number'), ['input', 'stepper', 'scale', 'meter']);
  assert.deepEqual(templates('money'), ['money_input']);
  assert.deepEqual(templates('percent'), ['input']);
  assert.deepEqual(templates('boolean'), ['switch', 'checkbox', 'buttons']);
  assert.deepEqual(templates('choice'), ['dropdown', 'buttons']);
  assert.deepEqual(templates('choices'), ['dropdown', 'checklist', 'badges']);
  assert.deepEqual(templates('file'), ['upload', 'image', 'image_card', 'image_list']);
  assert.deepEqual(templates('include'), ['script']);
  assert.deepEqual(templates('user'), ['reference_picker']);
  assert.deepEqual(TYPE_ALIASES.integer, {type: 'number', settings: {decimals: 0}});
  assert.equal(TYPE_ALIASES.compound.type, 'complex');
  assert.deepEqual({...STRING_VARIANT_TYPES}, {phone: 'phone', password: 'password'});
  assert.deepEqual(TEMPLATE_ALIASES, {choices: {select: 'dropdown'}, file: {'image-card': 'image_card', 'image-list': 'image_list'}});
});

test('every type the Framework draws has a renderer in each of the four places', () => {
  for (const entry of PROPERTY_TYPES) {
    if (entry.set) {
      assert.ok(MAPS.cell.has(entry.type) || entry.type !== 'items', `${entry.type}: a cell`);
      continue;
    }
    for (const place of ['view', 'edit']) assert.ok(MAPS[place].has(entry.type), `${entry.type}: ${place}`);
    // compact is the cell; a type without its own cell is its text there.
    // A filter without its own control falls back to text.
    for (const one of entry.templates.filter((item) => !item.default)) {
      for (const place of one.places) {
        const map = MAPS[place === 'compact' ? 'cell' : place];
        assert.ok(map.has(entry.type), `${entry.type}.${one.id} changes ${place}, which ${entry.type} draws`);
      }
    }
  }
  for (const type of ['phone', 'password']) {
    for (const place of ['view', 'edit', 'cell', 'filter']) assert.ok(MAPS[place].has(type), `${type}: ${place}`);
  }
  for (const type of ['integer']) {
    for (const place of ['view', 'edit', 'cell']) assert.ok(!MAPS[place].has(type), `${type} is read as number`);
  }
});

test('a field names its template; absent, the default; every template of every type resolves to itself', () => {
  fresh();
  const said = capture(() => {
    for (const entry of PROPERTY_TYPES) {
      assert.equal(resolveField({key: 'k', propertyType: entry.type}).template, entry.templates[0].id, `${entry.type}: default`);
      for (const one of entry.templates) {
        const resolved = resolveField({key: 'k', propertyType: entry.type, template: one.id});
        assert.deepEqual([resolved.type, resolved.template], [entry.type, one.id], `${entry.type}.${one.id}`);
      }
    }
  });
  assert.deepEqual(said, [], 'nothing is said for current names');
});

test('an unknown or unfitting template draws the default, said once as template_fallback', () => {
  fresh();
  const said = capture(() => {
    for (let run = 0; run < 3; run += 1) {
      assert.equal(resolveField({key: 'a', propertyType: 'choice', template: 'radio'}).template, 'dropdown');
      assert.equal(resolveField({key: 'b', propertyType: 'choice', template: 'radio'}).template, 'dropdown');
      // A scale draws 0..100: a field bounded otherwise does not fit it.
      assert.equal(resolveField({key: 'c', propertyType: 'number', template: 'scale', min: 0, max: 5}).template, 'input');
      assert.equal(resolveField({key: 'd', propertyType: 'number', template: 'scale', min: 0, max: 100}).template, 'scale');
      assert.equal(resolveField({key: 'e', propertyType: 'number', template: 'scale'}).template, 'scale');
      // A template of another type is not this type's.
      assert.equal(resolveField({key: 'f', propertyType: 'boolean', template: 'dropdown'}).template, 'switch');
    }
  });
  assert.equal(said.length, 3, said.join('\n'));
  assert.match(said[0], /template_fallback:choice\.radio/u);
  assert.match(said[1], /template_fallback:number\.scale/u);
  assert.match(said[2], /template_fallback:boolean\.dropdown/u);
});

test('the former names are read until 2027-01-01, each said once on the page', () => {
  fresh();
  const said = capture(() => {
    for (let run = 0; run < 3; run += 1) {
      // variant is template.
      assert.equal(resolveField({key: 'a', propertyType: 'choice', variant: 'buttons'}).template, 'buttons');
      assert.equal(resolveField({key: 'b', propertyType: 'number', variant: 'stepper'}).template, 'stepper');
      // template wins over variant, and nothing is said for it.
      assert.equal(resolveField({key: 'c', propertyType: 'choice', template: 'dropdown', variant: 'buttons'}).template, 'dropdown');
    }
  });
  assert.equal(said.length, 1, said.join('\n'));
  assert.match(said[0], /"variant" is read as "template".*until 2027-01-01/u);

  fresh();
  const types = capture(() => {
    for (let run = 0; run < 2; run += 1) {
      const integer = resolveField({key: 'n', propertyType: 'integer'});
      assert.deepEqual([integer.type, integer.template, integer.decimals], ['number', 'input', 0]);
      assert.equal(resolveField({key: 'n', propertyType: 'integer', template: 'meter'}).template, 'meter');
      assert.equal(resolveField({key: 'p', propertyType: 'compound'}).type, 'complex');
      const phone = resolveField({key: 't', propertyType: 'string', variant: 'phone'});
      assert.deepEqual([phone.type, phone.template], ['phone', 'phone_input']);
      const password = resolveField({key: 'w', propertyType: 'string', variant: 'password'});
      assert.deepEqual([password.type, password.template], ['password', 'input']);
      assert.equal(resolveField({key: 'x', propertyType: 'choices', template: 'select'}).template, 'dropdown');
      assert.equal(resolveField({key: 'x', propertyType: 'choices', variant: 'select'}).former, 'select');
      assert.equal(resolveField({key: 'y', propertyType: 'file', variant: 'image-card'}).template, 'image_card');
    }
  });
  // integer, compound, string.phone, string.password, choices.select (as a
  // template), variant (once for every variant field), file.image-card: each once.
  assert.equal(types.length, 7, types.join('\n'));
  // A string with a variant phone is said once, as the type, not twice.
  assert.equal(types.filter((line) => /variant "phone"/u.test(line)).length, 1);
  const notes = globalThis.SF.deprecations.list().filter((note) => note.component === 'sf-field-renderers');
  assert.ok(notes.every((note) => note.remove_after === '2027-01-01'), 'dated');
});

test('decimals: a number fixes its digits, an integer is 0, precision is its former name', () => {
  fresh();
  capture(() => {
    assert.equal(resolveField({propertyType: 'number'}).decimals, null);
    assert.equal(resolveField({propertyType: 'number', decimals: 2}).decimals, 2);
    assert.equal(resolveField({propertyType: 'number', precision: 3}).decimals, 3);
    assert.equal(resolveField({propertyType: 'number', decimals: 0, precision: 3}).decimals, 0);
    assert.equal(resolveField({propertyType: 'integer'}).decimals, 0);
    assert.equal(resolveField({propertyType: 'percent', decimals: 1}).decimals, 1);
  });
  // The number edit: the digit keyboard for a whole number, an error for more digits.
  const edit = source.slice(source.indexOf('function renderNumberEdit('), source.indexOf('\n}\n', source.indexOf('function renderNumberEdit(')));
  assert.match(edit, /inputmode=\$\{decimals === 0 \? 'numeric' : 'decimal'\}/u);
  assert.match(edit, /decimals === 0\n\s+\? setText\(host, 'wholeNumber'\)/u);
  for (const code of ['en', 'ru']) {
    const words = JSON.parse(readFileSync(join(root, `src/smart/field-renderers/lang/${code}.json`), 'utf8')).runtime;
    assert.ok(words.wholeNumber, `${code}.wholeNumber`);
  }
});

test('template parameters: templateParams first, the former field key after', () => {
  assert.equal(templateParam({templateParams: {badge: 'outline'}, badgeAppearance: 'tonal'}, 'badge'), 'outline');
  assert.equal(templateParam({badgeAppearance: 'outline'}, 'badge'), 'outline');
  assert.equal(templateParam({templateParams: {trueText: 'Вкл'}}, 'trueText'), 'Вкл');
  assert.equal(templateParam({trueText: 'On'}, 'trueText'), 'On');
  assert.equal(templateParam({templateParams: {size: '2'}}, 'size'), '2');
  assert.equal(templateParam({}, 'rows'), undefined);
  // badge is tonal or outline; main is the attention count's (C140 (4), FW-1).
  assert.match(source, /const VALUE_BADGE_APPEARANCES = new Set\(\['tonal', 'outline'\]\);/u);
});

test('boolean: the switch by default, the checkbox and the buttons as templates, never chosen by required (C303 (4))', () => {
  const edit = source.slice(source.indexOf('function renderBooleanEdit('), source.indexOf('\n}\n', source.indexOf('function renderBooleanEdit(')));
  assert.match(edit, /const template = templateOf\(field\);\n\n    if \(template === 'switch'\) \{\n\s+return html`\n\s+<sf-switch/u);
  assert.match(edit, /if \(template === 'checkbox'\) \{\n\s+return html`\n\s+<sf-checkbox/u);
  assert.match(edit, /<sf-segmented\n\s+appearance="buttons"/u);
  assert.doesNotMatch(edit, /required|EDIT_APPLY/u);
});

test('choice buttons wrap and never fold (FW-2); tags and badges of one value stand 4 apart (FW-3)', () => {
  const buttons = source.slice(source.indexOf('function renderChoiceButtons('), source.indexOf('\n}\n', source.indexOf('function renderChoiceButtons(')));
  assert.match(buttons, /root-class=\$\{locked \? 'flex-wrap pointer-events-none' : 'flex-wrap'\}/u);
  const segmented = readFileSync(join(root, 'src/smart/segmented/index.js'), 'utf8');
  assert.match(segmented, /wrapsLines\(\) \{\n\s+const root = this\.querySelector\(':scope > \.sf-button-group'\);\n\s+return Boolean\(root\) && globalThis\.getComputedStyle\?\.\(root\)\?\.flexWrap === 'wrap';/u);
  assert.match(segmented, /if \(!this\.foldable \|\| this\.wrapsLines\(\)\) \{/u);
  const view = source.slice(source.indexOf('function renderChoicesView('), source.indexOf('\n}\n', source.indexOf('function renderChoicesView(')));
  assert.match(view, /flex flex-wrap items-cross-center gap-1\/4 min-w-0/u);
  assert.doesNotMatch(view, /gap-1\/3/u);
});

test('money: the sign in the field is isolated on a right-to-left page; a table edits numbers at the end', () => {
  assert.match(source, /function isolatedSign\(sign, locale\) \{\n\s+if \(!sign \|\| !isRtlLocale\(locale\) \|\| !\/\[A-Za-z\]\/u\.test\(sign\)\) return sign;\n\s+return `\\u2066\$\{sign\}\\u2069`;/u);
  assert.match(source, /EDIT_ALIGN_END = options\?\.align === 'end';/u);
  assert.equal((source.match(/EDIT_ALIGN_END \? 'text-end num-tabular'/gu) ?? []).length, 2);
  // C294 (c): the native input takes its field's alignment and figures.
  const inputs = readFileSync(join(root, 'src/component/inputs/scss/_css__inputs.scss'), 'utf8');
  const rule = inputs.slice(inputs.indexOf('.sf-input .sf-input-field input {'), inputs.indexOf('}', inputs.indexOf('.sf-input .sf-input-field input {')));
  for (const line of ['text-align: inherit;', 'font-variant-numeric: inherit;', 'font-feature-settings: inherit;']) assert.ok(rule.includes(line), line);
  // C294 (b): the currency choice is never narrower than its longest option.
  assert.match(source, /root-class="basis-1\/3"\n\s+root-style=\$\{currencyMin\}/u);
  assert.match(source, /const currencyMin = `min-inline-size: calc\(\$\{longest \+ 1\}ch \+ var\(--sf-ui-\$\{sizeName\}--control-height\) \+ var\(--sf-space-1\)\)`;/u);
});

test('the set publishes the places, the former names and what a field is drawn with', () => {
  assert.match(source, /places: PLACES,\n\s+aliases: \{types: TYPE_ALIASES, templates: TEMPLATE_ALIASES\},\n\s+fieldTemplate,/u);
  const api = JSON.parse(readFileSync(join(root, 'src/core/contracts/public-js-api.json'), 'utf8'));
  const find = (node) => (Array.isArray(node) ? node.map(find).find(Boolean)
    : node && typeof node === 'object' ? (node.name === 'SF.fieldRenderers' ? node : Object.values(node).map(find).find(Boolean)) : null);
  const members = find(api).members;
  for (const name of ['places', 'aliases', 'fieldTemplate', 'registry']) assert.ok(members.includes(name), name);
  const port = JSON.parse(readFileSync(join(root, 'src/core/contracts/ports/simai.property-view-port/1.20.0/port.json'), 'utf8'));
  const fields = port.data.record.schema.properties.sections.items.properties.groups.items.properties.fields.items.properties;
  for (const key of ['template', 'templateParams', 'decimals', 'variant']) assert.ok(fields[key], key);
  const form = JSON.parse(readFileSync(join(root, 'src/smart/form/component.json'), 'utf8')).settings.fields.schema.items.properties;
  for (const key of ['template', 'templateParams', 'decimals', 'currency', 'currencies', 'currencyDisplay']) assert.ok(form[key], `sf-form declares ${key}`);
});
