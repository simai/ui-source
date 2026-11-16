// Owner decision C187 (2026-11-14, research control/research/2026-11-14-
// utilities-cleanup.md in simai/ui-control): utilities leave through a dated
// alias. One table of retired class names (src/core/js/retired-classes.table.js)
// is what the Loader notes in SF.deprecations, what the change journal lists
// and what keeps drawing until remove_after -- the sheets stay.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
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
const loadRule = (path) => new Function('SF', read(path))(SF);
const ruleOf = (folder, variant = 'default') => {
  loadRule(`src/utility/${folder}/${variant}/rule.js`);
  return SF.RuleLoader[`${folder}/${variant}`];
};
const sheets = table.records.flatMap((record) => Object.keys(record.sheets || {}));
const names = table.records.flatMap((record) => Object.keys(record.names || {}));

const EFFECTS = [
  'mix-blend-mode',
  'filter-brightness', 'filter-contrast', 'filter-grayscale', 'filter-hue-rotate', 'filter-invert', 'filter-opacity', 'filter-saturate', 'filter-sepia',
  'backdrop-filer-hue-rotate', 'backdrop-filter-brightness', 'backdrop-filter-contrast', 'backdrop-filter-grayscale', 'backdrop-filter-invert',
  'backdrop-filter-opacity', 'backdrop-filter-saturate', 'backdrop-filter-sepia',
  'mask-clip', 'mask-composite', 'mask-mode', 'mask-origin', 'mask-position', 'mask-repeat', 'mask-size', 'mask-type',
];

test('C187 (1): one table, every record dated to 2027-01-01 and recorded in the change journal', () => {
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  for (const record of table.records) {
    assert.equal(record.remove_after, '2027-01-01', record.journal);
    // C187's records are of 2026-11-14; later decisions (C208, 2026-11-15) add theirs.
    assert.ok(record.since >= '2026-11-14', record.journal);
    const entry = journal.records.find(({id}) => id === record.journal);
    assert.ok(entry, `${record.journal} is in the journal`);
    assert.ok(entry.deprecated_on <= record.since, record.journal); // group build 9: C212 (5) notes the 2026-11-08 C16 names from 2026-11-16
    assert.equal(entry.remove_after, record.remove_after);
    const listed = new Set(entry.items.map(({from}) => from));
    for (const from of [...Object.keys(record.names || {}), ...Object.keys(record.sheets || {}), ...(record.patterns || []).map((item) => item.from)]) {
      assert.ok(listed.has(from), `${record.journal} lists ${from}`);
    }
  }
  assert.equal(new Set(names).size, names.length, 'a name is retired once');
  assert.equal(new Set(sheets).size, sheets.length, 'a sheet is retired once');
});

test('C187 (1): a retired sheet still ships and loads until its date (utility.full.css, the Loader rules)', () => {
  const full = read('src/core/utility-full.js');
  const rules = read('src/core/js/rule.src.js');
  for (const sheet of sheets) {
    assert.ok(existsSync(resolve(root, `src/utility/${sheet}/default/index.scss`)), `${sheet}: the sheet stays`);
    assert.ok(full.includes(`../utility/${sheet}/default/index.scss`), `${sheet}: utility.full.css keeps it`);
    assert.ok(rules.includes(`../../utility/${sheet}/default/rule.js`), `${sheet}: the Loader still loads it`);
  }
});

test('C187 (2): the spacing, translate and background-size ladders leave; the size ladders and element-position-ext stay extended', () => {
  for (const sheet of ['margin-ext', 'padding-ext', 'scroll-margin-ext', 'scroll-padding-ext', 'background-size-ext', 'transform-translate-ext']) {
    assert.ok(sheets.includes(sheet), `${sheet} retires`);
  }
  assert.deepEqual(table.extended.sheets, ['width-ext', 'height-ext', 'max-width-ext', 'max-height-ext', 'flex-basis-ext', 'element-position-ext']);
  for (const sheet of table.extended.sheets) assert.ok(!sheets.includes(sheet), `${sheet} stays`);
  // Docara (h-d0) and the Framework (fab block-end-b6, search top-b6) write them.
  assert.ok(ruleOf('height-ext').test('h-d0'));
  assert.ok(ruleOf('element-position-ext').test('block-end-b6'));
});

test('C187 (3): lines 0 / 1 / 2; ring-3, ring-4 and ring-opacity retire; the rest of the widths are extended', () => {
  assert.equal(aliases.retiredClassName('ring-3').to, 'ring-2');
  assert.equal(aliases.retiredClassName('focus-visible:ring-4').to, 'focus-visible:ring-2');
  for (const kept of ['ring-0', 'ring-1', 'ring-2', 'border-1', 'border-2', 'outline-1', 'outline-2']) assert.equal(aliases.retiredClassName(kept), null, kept);
  assert.ok(sheets.includes('ring-opacity'));
  const extended = table.extended.patterns.map(({pattern}) => new RegExp(pattern));
  for (const name of ['border-3', 'border-10', 'border-top-4', 'outline-3', 'outline-offset-4', 'ring-offset-3', 'divide-y-3']) {
    assert.ok(extended.some((re) => re.test(name)), `${name} is extended`);
  }
  for (const name of ['border-0', 'border-1', 'border-2', 'outline-2', 'ring-offset-2', 'divide-y-1']) {
    assert.ok(!extended.some((re) => re.test(name)), `${name} is the main ladder`);
  }
});

test('C187 (3), UT-4: the selection ring does not erase the shadow, whichever sheet comes last', () => {
  const ring = read('src/utility/ring-width/default/scss/_sf_var__ring_width.scss');
  assert.match(ring, /--sf-ring-shadow:/u);
  assert.match(ring, /box-shadow: var\(--sf-ring-shadow\), var\(--sf-place-shadow, 0 0 transparent\);/u);
  for (const variant of ['default', 'hover', 'focus', 'focus-visible']) {
    const css = read(`src/utility/ring-width/${variant}/scss/_sf_css__ring_width.scss`);
    assert.match(css, /@include ring-box-shadow\(\$width-value\);/u, variant);
    assert.doesNotMatch(css, /box-shadow:/u, `${variant} composes through the mixin`);
  }
  for (const variant of ['default', 'hover']) {
    const shadow = read(`src/utility/box-shadow/${variant}/scss/_sf_css__shadow.scss`);
    assert.match(shadow, /--sf-place-shadow: #\{shadow\.sf-shadow\(\$place\)\};\s*box-shadow: var\(--sf-ring-shadow, 0 0 transparent\), var\(--sf-place-shadow\);/u, variant);
    assert.match(shadow, /box-shadow: var\(--sf-ring-shadow, var\(--sf-shadow-flat\)\);/u, `${variant}: flat stays none without a ring`);
  }
});

test('C187 (4): one spelling divide-*; divider-* is an alias, divide-opacity-* retires', () => {
  assert.equal(aliases.retiredClassName('divider-y-1').to, 'divide-y-1');
  assert.equal(aliases.retiredClassName('hover:divider-primary').to, 'hover:divide-primary');
  assert.equal(aliases.retiredClassName('divider-line'), null, 'an author class is not a utility');
  assert.equal(aliases.retiredClassName('divide-y-1'), null);
  for (const name of ['divider-y-1', 'divider-dashed', 'divider-outline-variant', 'divider-y-reverse']) {
    const folder = /dashed/.test(name) ? 'divider-style' : /outline/.test(name) ? 'divider-color' : 'divider-width';
    assert.ok(ruleOf(folder).test(name), `${name} still loads its sheet`);
  }
  assert.equal(table.records.find((record) => record.sheets?.['divider-opacity']).sheets['divider-opacity'], 'divide-outline-variant');
});

test('C187 (5): of the effects blur, backdrop-blur and opacity stay; the other 25 families retire', () => {
  const retiredEffects = sheets.filter((sheet) => /^(?:filter|backdrop|mask|mix-blend)/.test(sheet));
  assert.deepEqual(retiredEffects.sort(), [...EFFECTS].sort());
  assert.equal(EFFECTS.length, 25);
  for (const kept of ['filter-blur', 'backdrop-filter-blur', 'opacity']) assert.ok(!sheets.includes(kept), `${kept} stays`);
  for (const sheet of EFFECTS) assert.ok(existsSync(resolve(root, `src/utility/${sheet}`)), sheet);
});

test('C187 (6): motion by role; ease-in / out / in-out are aliases; delay, will-change and the slide-ins retire', () => {
  const vars = read('src/utility/transition-timing-function/default/scss/_sf_var__transition_timing_function.scss');
  for (const role of ['enter', 'exit', 'move']) assert.match(vars, new RegExp(`${role}: var\\(--sf-ease-${role}\\),`, 'u'));
  assert.match(vars, /linear: linear,/u);
  const rule = ruleOf('transition-timing-function');
  for (const name of ['ease-enter', 'ease-exit', 'ease-move', 'ease-linear', 'ease-in', 'ease-out', 'ease-in-out']) assert.ok(rule.test(name), name);
  assert.equal(rule.test('ease-entered'), false);
  assert.deepEqual(['ease-in', 'ease-out', 'ease-in-out'].map((name) => aliases.retiredClassName(name).to), ['ease-exit', 'ease-enter', 'ease-move']);
  // The alias draws what it drew: the curves stay until the date.
  assert.match(vars, /in: cubic-bezier\(0\.4, 0, 1, 1\),/u);
  for (const sheet of ['transition-delay', 'will-change']) assert.ok(sheets.includes(sheet), sheet);
  for (const name of ['animation-from-left', 'animation-from-right', 'animation-from-bottom']) {
    assert.equal(aliases.retiredClassName(name).to, '', name);
    assert.ok(ruleOf('animation').test(name), `${name} still loads`);
  }
  assert.equal(aliases.retiredClassName('animation-on-view'), null);
  assert.equal(aliases.retiredClassName('animation'), null);
});

test('C187 (7): print stays; the Loader understands Tailwind print:hidden and columns-N', () => {
  assert.equal(convertTailwindClasses('print:hidden'), 'print-hidden');
  assert.equal(convertTailwindClasses('print:block'), 'print:block', 'print-block also hides on screen, so it is not the same');
  assert.equal(convertTailwindClasses('columns-3 md:columns-2 columns-auto columns-13'), 'layout-col-3 md:layout-col-2 layout-col-auto columns-13');
  assert.ok(ruleOf('display-print').test('print-hidden'));
  assert.ok(ruleOf('column').test('layout-col-3'));
  for (const sheet of ['display-print', 'break-after', 'break-before', 'break-inside', 'box-decoration-break', 'column']) assert.ok(!sheets.includes(sheet), sheet);
});

test('C187 (8): the small parts leave through the same table', () => {
  const parts = table.records.find(({journal}) => journal === 'class-c187-retired-parts');
  assert.deepEqual(Object.keys(parts.names).sort(), ['sf-emoji', 'sf-hide-show', 'sf-outline', 'sf-tab']);
  assert.equal(aliases.retiredClassName('sf-tab').to, 'sf-tabs');
  assert.equal(aliases.retiredClassName('sf-tabs'), null);
  for (const [folder, key] of [['tab', 'tab'], ['emoji', 'emoji'], ['outline', 'outline'], ['hideShow', 'hideShow']]) {
    loadRule(`src/component/${folder}/rule.js`);
    const rule = SF.RuleLoader[key];
    assert.ok(rule, `${folder} keeps its rule until the date`);
  }
  for (const folder of ['tab', 'outline', 'hideShow']) assert.match(read(`src/component/${folder}/docs/docs.md`), /Retired \(owner decision C187 \(8\)/u, folder);
});

test('C187 (1): the Loader notes a retired name or sheet once in SF.deprecations, expired after the date', () => {
  clearDeprecations();
  assert.equal(aliases.noteUtilityClassAlias('md:ring-3'), 'md:ring-2');
  assert.equal(aliases.noteRetiredUtilitySheets('md:m-top-a1', ['margin-ext/md']), true);
  assert.equal(aliases.noteRetiredUtilitySheets('m-top-1', ['margin/default']), false);
  assert.equal(aliases.noteRetiredUtilitySheets('x', ['margin-ext/default', 'margin/default']), false, 'a class that also loads a living sheet is not retired');
  assert.equal(aliases.noteRetiredUtilitySheets('divide-opacity-5', ['divider-opacity/default']), true);
  const notes = listDeprecations();
  assert.ok(notes.some((note) => note.from === 'md:ring-3' && note.to === 'md:ring-2' && note.remove_after === '2027-01-01' && !note.expired));
  assert.ok(notes.some((note) => note.from === 'md:m-top-a1' && note.to === null && note.kind === 'class'));
  assert.ok(notes.some((note) => note.from === 'divide-opacity-5' && note.to === 'divide-outline-variant'));
  aliases.noteUtilityClassAlias('ease-in', Date.parse('2027-01-02T00:00:00Z'));
  assert.ok(listDeprecations().some((note) => note.from === 'ease-in' && note.expired === true));
  const loader = read('src/core/js/loader.js');
  assert.match(loader, /noteUtilityClassAlias\(token\);/u);
  assert.match(loader, /noteRetiredUtilitySheets\(token, keys\);/u);
  clearDeprecations();
});

test('C187: every retired sheet is a utility folder of the source', () => {
  const folders = new Set(readdirSync(resolve(root, 'src/utility')));
  for (const sheet of sheets) assert.ok(folders.has(sheet), sheet);
});
