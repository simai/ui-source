// Owner decision C212 (5), 2026-11-16 (`#q-us-colour`, research
// control/research/2026-11-15-utilities-sprawl.md section 5 in simai/ui-control):
// one list of roles for every colour property, palette tones only as
// variables. The old spellings of a role (surface-0, -transparent-overlay ...)
// are exact aliases; the legacy palette classes (bg-, color-, border-<hue>[-N])
// are deprecated with the nearest role of the hue's family as the hint. Old
// names keep drawing what they drew until 2027-01-01, and the Loader notes them.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const {default: table} = await import('../src/core/js/retired-classes.table.js');
const aliases = await import('../src/core/js/utility-class-aliases.js');
const {listDeprecations, clearDeprecations} = await import('../src/core/js/deprecations.js');
const {convertTailwindClasses} = await import('../src/core/js/tailwind-map.js');

const SF = {RuleLoader: {}};
const ruleOf = (folder, variant = 'default') => {
  new Function('SF', read(`src/utility/${folder}/${variant}/rule.js`))(SF);
  return SF.RuleLoader[`${folder}/${variant}`];
};
const record = (id) => table.records.find(({journal, decision}) => journal === id && decision === 'C212 (5)');
const journal = JSON.parse(read('contracts/changes/journal.json'));
const entry = (id) => journal.records.find((item) => item.id === id);
const to = (name) => aliases.retiredClassName(name)?.to;

// The key -> variable arrays of a sheet: {array name: {key: variable}}.
const arrays = (path) => Object.fromEntries([...read(path).matchAll(/^\$([a-z-]+):\s*\(([\s\S]*?)^\)/gmu)]
  .map(([, name, body]) => [name, Object.fromEntries([...body.matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)'/gu)].map(([, k, v]) => [k, v]))]));
const SHEETS = {
  'bg-': 'src/utility/background-color/default/scss/_sf_var__background_color.scss',
  'border-': 'src/utility/border-color/default/scss/_sf_var__border_color.scss',
  'ring-': 'src/utility/border-color/default/scss/_sf_var__border_color.scss',
  'ring-offset-': 'src/utility/border-color/default/scss/_sf_var__border_color.scss',
  'fill-': 'src/utility/fill/default/scss/_sf_var__fill.scss',
  'drop-shadow-': 'src/utility/drop-shadow-color/default/scss/_sf_var__filter_drop_shadow_color.scss',
  'stripe-': 'src/utility/stripe-color/default/scss/_sf_var__stripe_color.scss',
  'color-': 'src/utility/text-color/default/scss/_sf_var__color_base.scss',
  'placeholder-': 'src/utility/text-color/default/scss/_sf_var__color_base.scss',
};
const prefixOf = (name) => Object.keys(SHEETS).sort((a, b) => b.length - a.length).find((prefix) => name.startsWith(prefix));

const ACCENTS = ['primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error'];
const FAMILY = {white: 'neutral', black: 'neutral', gray: 'neutral', red: 'error', orange: 'warning', yellow: 'warning', green: 'success', blue: 'primary', purple: 'tertiary', pink: 'tertiary'};

test('C212 (5): four dated records, each recorded in the change journal', () => {
  for (const [id, rewrite] of [['utility-c16-background-names', 'rename-utility'], ['class-c212-colour', 'rename-class'],
    ['utility-c17-legacy-palette-classes', 'manual'], ['class-c212-colour-nearest', 'manual']]) {
    const found = record(id);
    assert.ok(found, `${id} is in the retired-classes table`);
    assert.equal(found.since, '2026-11-16');
    assert.equal(found.remove_after, '2027-01-01');
    const recorded = entry(id);
    assert.ok(recorded, `${id} is in the journal`);
    assert.equal(recorded.rewrite, rewrite);
    const listed = new Map(recorded.items.map((item) => [item.from, item.to]));
    for (const [from, hint] of Object.entries(found.names)) {
      assert.ok(listed.has(from), `${id} lists ${from}`);
      assert.equal(listed.get(from), hint, `${id}: ${from} names the hint the Loader gives`);
    }
  }
  for (const id of ['class-c212-colour', 'class-c212-colour-nearest']) assert.equal(entry(id).deprecated_on, '2026-11-16');
});

test('C212 (5): an old spelling reads the variable its role reads, in the same array', () => {
  let checked = 0;
  for (const id of ['utility-c16-background-names', 'class-c212-colour']) {
    for (const [from, role] of Object.entries(record(id).names)) {
      const prefix = prefixOf(from);
      assert.ok(prefix && role.startsWith(prefix), `${from} -> ${role} keeps its property`);
      const [oldKey, newKey] = [from.slice(prefix.length), role.slice(prefix.length)];
      const both = Object.values(arrays(SHEETS[prefix])).filter((map) => oldKey in map && newKey in map);
      assert.ok(both.length, `${from}: ${oldKey} and ${newKey} share an array`);
      for (const map of both) assert.equal(map[oldKey], map[newKey], `${from} draws ${role}`);
      checked++;
    }
  }
  assert.equal(checked, 101);
  assert.equal(to('bg-surface-0'), 'bg-surface-page');
  assert.equal(to('hover:bg-primary-transparent'), 'hover:bg-primary-state');
  assert.equal(to('focus-visible:ring-surface-overlay'), 'focus-visible:ring-surface-veil');
  assert.equal(to('hover:fill-surface-transparent'), 'hover:fill-surface-state');
  assert.equal(to('border-error-transparent-overlay'), 'border-error-container-strong');
  assert.equal(to('color-on-disable'), 'color-on-surface-disabled');
  for (const name of ['bg-surface-1', 'ring-surface-0', 'drop-shadow-surface', 'stripe-surface-transparent-overlay']) {
    const prefix = prefixOf(name).replace(/-$/u, '');
    const folder = {bg: 'background-color', ring: 'ring-color', 'drop-shadow': 'drop-shadow-color', stripe: 'stripe-color'}[prefix];
    assert.ok(ruleOf(folder).test(name), `${name} still loads`);
  }
});

test('C212 (5): every palette class is retired with a role of its hue\'s family, the same in the journal', () => {
  const core = read('src/core/scss/vars/_sf_var__color.scss');
  const block = core.slice(core.indexOf('$color-array: ('));
  const hues = [...block.slice(0, block.indexOf(') !default;')).matchAll(/^\s*'([a-z]+)': \(([^)]*)\)/gmu)]
    .map(([, hue, shades]) => [hue, [...shades.matchAll(/(default|\d+):/gu)].map(([, key]) => (key === 'default' ? '' : `-${key}`))]);
  assert.deepEqual(hues.map(([hue]) => hue), Object.keys(FAMILY));
  const palette = record('utility-c17-legacy-palette-classes').names;
  let count = 0;
  for (const prefix of ['color', 'bg', 'border']) {
    for (const [hue, shades] of hues) {
      for (const shade of shades) {
        const name = `${prefix}-${hue}${shade}`;
        const hint = palette[name];
        assert.ok(hint, `${name} is retired`);
        const family = FAMILY[hue];
        const word = hint.slice(prefix.length + 1);
        if (family === 'neutral') assert.match(word, /^(?:surface-[a-z-]+|on-surface(?:-[a-z]+)?|outline(?:-variant)?)$/u, name);
        else assert.match(word, new RegExp(`^(?:on-)?${family}(?:-container(?:-strong)?)?$`, 'u'), name);
        count++;
      }
    }
  }
  assert.equal(count, 270);
  assert.equal(Object.keys(palette).length, 270);
  assert.equal(to('color-red-5'), 'color-error');
  assert.equal(to('bg-blue-5'), 'bg-primary');
  assert.equal(to('bg-white'), 'bg-surface-page');
  assert.equal(to('border-gray-2'), 'border-outline-variant');
  assert.ok(ruleOf('background-color').test('bg-blue-5'), 'bg-blue-5 still loads');
  assert.match(entry('utility-c17-legacy-palette-classes').manual, /sf-hue-<hue> color-hue/u, 'the hue role stays the way to keep a hue');
});

test('C212 (5): the Tailwind palette conversion is not retargeted (no role draws a static tone); its target is noted', () => {
  assert.equal(convertTailwindClasses('bg-blue-500 text-red-600 border-gray-200'), 'bg-blue-4 color-red-6 border-gray-2');
  assert.equal(to('bg-blue-4'), 'bg-primary');
  assert.equal(to('color-red-6'), 'color-error');
});

test('C212 (5): the colour arrays hold role words only, or a dated old spelling', () => {
  const ROLES = new Set(['transparent', 'current', 'inherit', 'scrim', 'hue', 'hue-container', 'hue-outline',
    'surface-page', 'surface-area', 'surface-card', 'surface-popup', 'surface-popup-nested', 'surface-inverse', 'surface-inverse-fixed',
    'surface-container', 'surface-container-strong', 'surface-veil', 'surface-disabled', 'surface-state', 'surface-state-select',
    'surface-2', 'surface-3', 'surface-4', 'on-surface', 'on-surface-variant', 'on-surface-disabled', 'on-surface-inverse',
    'on-surface-fixed', 'on-surface-inverse-fixed', 'outline', 'outline-variant', 'on-hue', 'on-hue-container', 'on-hue-container-graphic', 'hue-container-graphic']);
  for (const accent of ACCENTS) {
    for (const word of ['', '-container', '-container-strong', '-state', '-state-select']) ROLES.add(`${accent}${word}`);
    for (const word of ['', '-container', '-container-graphic']) ROLES.add(`on-${accent}${word}`);
  }
  const outside = [];
  for (const [prefix, path] of Object.entries(SHEETS)) {
    for (const map of Object.values(arrays(path))) {
      for (const key of Object.keys(map)) {
        if (ROLES.has(key)) continue;
        // bg-*-transparent is built as hover: and active: only; its table entry is the bare name.
        if (aliases.retiredClassName(`${prefix}${key}`)) continue;
        outside.push(`${prefix}${key}`);
      }
    }
  }
  assert.deepEqual([...new Set(outside)], [], 'a colour key is a role or a dated old spelling');
});

test('C212 (5): no-twin names name the disabled ink; the roles and the hue roles stay', () => {
  assert.equal(to('color-disable'), 'color-on-surface-disabled');
  assert.equal(to('focus:placeholder-disable'), 'focus:placeholder-on-surface-disabled');
  for (const kept of ['bg-surface-page', 'bg-surface-area', 'bg-surface-2', 'bg-scrim', 'bg-primary-container-strong', 'hover:bg-primary-state',
    'color-on-surface-disabled', 'border-outline-variant', 'ring-surface-veil', 'color-hue', 'bg-hue-container', 'sf-hue-red', 'bg-telegram',
    'scroll-surface', 'fill-surface-disabled', 'gr1-surface-page']) {
    assert.equal(aliases.retiredClassName(kept), null, kept);
  }
});

test('C212 (5): the Loader notes an old colour name once, variant kept', () => {
  clearDeprecations();
  assert.equal(aliases.noteUtilityClassAlias('hover:bg-surface-transparent'), 'hover:bg-surface-state');
  assert.equal(aliases.noteUtilityClassAlias('hover:bg-surface-transparent'), 'hover:bg-surface-state');
  assert.equal(aliases.noteUtilityClassAlias('color-blue-5'), 'color-primary');
  const notes = listDeprecations();
  assert.equal(notes.filter(({from}) => from === 'hover:bg-surface-transparent').length, 1);
  assert.ok(notes.some((note) => note.from === 'color-blue-5' && note.to === 'color-primary' && note.remove_after === '2027-01-01'));
  clearDeprecations();
});

test('C212 (5): the sheets change in comments only; the versions move', () => {
  const versions = {'background-color': '1.5.0', 'text-color': '1.5.0', 'border-color': '1.5.0', fill: '1.4.0', 'drop-shadow-color': '1.3.0',
    'ring-color': '1.3.0', 'ring-offset-color': '1.3.0', 'placeholder-color': '1.3.0', 'stripe-color': '1.2.0'};
  for (const [unit, version] of Object.entries(versions)) {
    assert.equal(JSON.parse(read(`src/utility/${unit}/passport.json`)).version, version, unit);
  }
  assert.equal(arrays(SHEETS['border-'])['border-color-array']['surface-overlay'], 'surface-veil', 'the old key stays until the date');
});
