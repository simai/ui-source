// Owner decision C212 (1), 2026-11-16 (`#q-us-gradient`, research
// control/research/2026-11-15-utilities-sprawl.md section 1 in simai/ui-control):
// one gradient set. The six C65 kinds are the default; a free gradient is only
// bg-gradient-to-<side> with from-, via- and to-<role>. gr-*, gr1/2/3-* and the
// stops at a palette tone are deprecated with a hint; old names keep drawing
// what they drew until 2027-01-01.
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

const SF = {RuleLoader: {}};
const ruleOf = (folder, variant = 'default') => {
  new Function('SF', read(`src/utility/${folder}/${variant}/rule.js`))(SF);
  const rule = SF.RuleLoader[`${folder}/${variant}`];
  return rule instanceof RegExp ? rule : rule.regex;
};
const record = (id) => table.records.find(({journal}) => journal === id);
const journal = JSON.parse(read('contracts/changes/journal.json'));
const to = (name) => aliases.retiredClassName(name)?.to;

// The former stop list ($gradient-color-array): name -> the colour variable it sets.
const former = Object.fromEntries([...read('src/utility/gradient-color/default/scss/_sf_var__gradient.scss')
  .matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)'/gu)].map(([, name, value]) => [name, value]));
const STOP = {1: 'from', 2: 'via', 3: 'to'};
const ROLES = ['primary', 'secondary', 'tertiary', 'error', 'warning', 'success', 'info'];
const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'brown', 'gray'];
const TONES = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 85, 90, 95, 98];

test('C212 (1): two dated records, recorded in the change journal', () => {
  for (const [id, rewrite] of [['class-c212-gradient', 'rename-class'], ['class-c212-gradient-nearest', 'manual']]) {
    const entry = record(id);
    assert.ok(entry, `${id} is in the retired-classes table`);
    assert.equal(entry.decision, 'C212 (1)');
    assert.equal(entry.since, '2026-11-16');
    assert.equal(entry.remove_after, '2027-01-01');
    const recorded = journal.records.find((item) => item.id === id);
    assert.ok(recorded, `${id} is in the journal`);
    assert.equal(recorded.rewrite, rewrite);
    assert.equal(recorded.deprecated_on, '2026-11-16');
  }
});

test('C212 (1): gr1/2/3-<c> are from/via/to-<c>: the same stop, the same colour', () => {
  assert.equal(Object.keys(former).length, 18);
  const sheet = read('src/utility/gradient-color/default/scss/_sf_css__gradient.scss');
  assert.match(sheet, /\.#\{\$infix\}gr#\{\$i\}-#\{\$gradient-color-name\} \{\s*--sf-gradient--color-#\{\$i\}: var\(--sf-#\{\$gradient-color-value\}\);/u);
  const stops = read('src/utility/gradient-stops/default/scss/_sf_css__gradient_stops.scss');
  for (const [i, stop] of Object.entries(STOP)) {
    assert.match(stops, new RegExp(`\\.#\\{\\$infix\\}${stop}-#\\{\\$gradient-color-name\\} \\{\\s*--sf-gradient--color-${i}: var\\(--sf-#\\{\\$gradient-color-value\\}\\);`, 'u'));
  }
  assert.match(read('src/utility/gradient-stops/default/scss/_sf_var__gradient_stops.scss'), /\$stops: former\.\$gradient-color-array;/u, 'the stop list starts from the former list');
  const exact = record('class-c212-gradient').names;
  for (const [i, stop] of Object.entries(STOP)) {
    for (const [name, value] of Object.entries(former)) {
      const hint = to(`gr${i}-${name}`);
      if (name === 'surface-2') { assert.equal(hint, `${stop}-surface-area`); continue; }
      // The hint names the stop of the same colour variable, by its current name.
      assert.equal(hint, `${stop}-${value === name ? name : value}`, `gr${i}-${name}`);
      assert.equal(former[hint.slice(stop.length + 1)], value, `gr${i}-${name} and ${hint} set --sf-${value}`);
      assert.ok(Object.hasOwn(exact, `gr${i}-${name}`), `gr${i}-${name} is an exact alias`);
    }
  }
  assert.equal(to('gr1-primary'), 'from-primary');
  assert.equal(to('gr2-surface-0'), 'via-surface-page');
  assert.equal(to('gr3-surface-1'), 'to-surface-area');
  for (const name of ['gr1-primary', 'gr3-info']) assert.ok(ruleOf('gradient-color').test(name), `${name} still loads`);
});

test('C212 (1): the stop colours surface-0 and surface-1 are the places; surface-2 names the nearest', () => {
  for (const stop of ['from', 'via', 'to']) {
    assert.equal(to(`${stop}-surface-0`), `${stop}-surface-page`);
    assert.equal(to(`${stop}-surface-1`), `${stop}-surface-area`);
    assert.equal(to(`${stop}-surface-2`), `${stop}-surface-area`);
    assert.ok(Object.hasOwn(record('class-c212-gradient-nearest').names, `${stop}-surface-2`));
  }
  assert.equal(former['surface-0'], 'surface-page');
  assert.equal(former['surface-1'], 'surface-area');
});

test('C212 (1): gr-line names bg-gradient-to-<side>, gr-radial a C65 kind, gr-conic nothing', () => {
  for (const n of ['2', '3']) {
    assert.equal(to(`gr-line-${n}`), 'bg-gradient-to-r');
    assert.equal(to(`gr-radial-${n}`), 'gradient-glow');
    assert.equal(to(`gr-conic-${n}`), '');
  }
  // The default angle of a line is 90deg, the side bg-gradient-to-r draws.
  assert.match(read('src/core/scss/_sf_css__opacity.scss'), /--sf-gradient--angle: 90deg;/u);
  for (const variant of ['default', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    const sheet = read(`src/utility/gradient-type/${variant}/scss/_sf_css__gradient.scss`);
    for (const name of ['gr-line-2', 'gr-radial-3', 'gr-conic-2']) assert.ok(sheet.includes(`.#{$infix}${name} {`), `${variant} ${name} still ships`);
  }
  assert.ok(ruleOf('gradient-type').test('gr-line-2'), 'gr-line-2 still loads');
  assert.ok(ruleOf('background-gradient').test('bg-gradient-to-r'));
  assert.ok(ruleOf('gradient').test('gradient-glow'));
});

test('C212 (1): every stop at a palette tone is deprecated: a role for the theme palettes and statuses, a C65 kind colour for the hues', () => {
  const stops = ruleOf('gradient-stops');
  const kinds = ruleOf('gradient');
  let count = 0;
  for (const tone of TONES) {
    for (const role of ROLES) for (const stop of ['from', 'via', 'to']) {
      const name = `${stop}-${role}-${tone}`;
      assert.ok(stops.test(name), `${name} still loads`);
      assert.equal(to(name), `${stop}-${role}`, name);
      assert.ok(stops.test(to(name)), `${to(name)} is a stop`);
      count++;
    }
    for (const hue of [...HUES, 'neutral']) for (const stop of ['from', 'via', 'to']) {
      const name = `${stop}-${hue}-${tone}`;
      const colour = hue === 'neutral' ? 'gray' : hue;
      assert.ok(stops.test(name), `${name} still loads`);
      assert.equal(to(name), stop === 'to' ? `gradient-to-${colour}` : `gradient-color-${colour}`, name);
      assert.ok(kinds.test(to(name)), `${to(name)} is a kind setting`);
      count++;
    }
  }
  assert.equal(count, 1152);
  assert.equal(aliases.retiredClassName('from-teal-45'), null, 'not a built tone');
});

test('C212 (1): the default set and the free gradient stay public', () => {
  const kept = ['bg-gradient-to-r', 'bg-gradient-to-tl', 'bg-none', 'from-primary', 'via-secondary-container', 'to-surface-page', 'from-surface-card',
    'to-surface-inverse', 'from-error', 'to-white', 'from-black', 'via-transparent', 'from-on-surface', 'gradient-glow', 'gradient-glow-spot', 'gradient-tint',
    'gradient-duo', 'gradient-cover', 'gradient-scrim', 'gradient-scrim-plate', 'gradient-fade', 'gradient-text', 'gradient-color-teal', 'gradient-to-blue',
    'gradient-dir-br', 'gradient-strength-24', 'sf-hue-teal'];
  for (const name of kept) assert.equal(aliases.retiredClassName(name), null, name);
});

test('C212 (1): the Loader notes each old name once, with its hint', () => {
  clearDeprecations();
  for (let k = 0; k < 2; k++) {
    assert.equal(aliases.noteUtilityClassAlias('gr1-primary'), 'from-primary');
    assert.equal(aliases.noteUtilityClassAlias('to-teal-40'), 'gradient-to-teal');
    assert.equal(aliases.noteUtilityClassAlias('gr-conic-2'), '');
  }
  assert.equal(aliases.noteUtilityClassAlias('from-primary'), null);
  const notes = listDeprecations();
  assert.equal(notes.filter(({from}) => from === 'gr1-primary').length, 1);
  assert.ok(notes.some((note) => note.from === 'to-teal-40' && note.to === 'gradient-to-teal' && note.remove_after === '2027-01-01'));
  assert.ok(notes.some((note) => note.from === 'gr-conic-2' && note.to === null));
  assert.ok(!notes.some(({from}) => from === 'from-primary'));
  clearDeprecations();
});

test('C212 (1): the sheets are unchanged but for comments; the versions move', () => {
  for (const [unit, version] of [['gradient-color', '1.3.0'], ['gradient-stops', '1.4.0'], ['gradient-type', '1.2.0'], ['background-gradient', '1.2.0']]) {
    assert.equal(JSON.parse(read(`src/utility/${unit}/passport.json`)).version, version, unit);
  }
});
