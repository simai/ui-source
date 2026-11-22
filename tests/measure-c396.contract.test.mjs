// The width ladder in characters (owner decision C396, 2026-11-19, refining
// C395; ui-control control/research/2026-11-19-text-measure section 8,
// prototypes/width-system-study.html). C178: every general rule has an
// automatic check in the pair build; this is C396's source half, the browser
// half is tests/browser/measure-c396.browser.mjs (the characters per line at
// text 16, 14 and 20).
//
// 1. The ladder: --sf-measure--char is half the body text size and each step
//    --sf-measure-N is N of them, declared on :root, in the desktop block and
//    in both density regions (a custom property resolves where it is
//    declared). At the desktop's text 16 each step is a point of the base
//    ladder: 160, 224, 288, 352, 416, 512, 640, 768.
// 2. The roles: the C32/C159 popup and window widths read the nearest step (a
//    tie to the wider), the field widths read 20 / 28 / 44, and the reading
//    measures --sf-text--measure* stay as dated aliases of 80 / 96 / 52.
// 3. The grep gate: a text container's width is a step of this ladder, never a
//    point of the base ladder (var(--sf-g*) or var(--sf-h*)): every width
//    declaration in the sheets and scripts below.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const STEPS = [20, 28, 36, 44, 52, 64, 80, 96];
const LADDER_PX = [160, 224, 288, 352, 416, 512, 640, 768];

test('the ladder is N x half the body text size, a base ladder point at text 16 (C396)', () => {
  const contract = json('src/core/contracts/adaptive-sizing.v1.json');
  assert.deepEqual(contract.measure.steps, STEPS);
  assert.deepEqual(contract.measure.char, {textSize: '1', divisor: 2});
  assert.equal(contract.projections.scss.measure, 'src/core/figma_variables/figma_measure.scss');
  const scss = read('src/core/figma_variables/figma_measure.scss');
  const [phone, desktop] = scss.split('@media (min-width: 60rem)');
  for (const block of [phone, desktop]) {
    assert.match(block, /--sf-measure--char: calc\(var\(--sf-text--size-1\) \/ 2\);/u);
    for (const n of STEPS) assert.match(block, new RegExp(`--sf-measure-${n}: calc\\(${n} \\* var\\(--sf-measure--char\\)\\);`, 'u'));
  }
  // The desktop body text is b6 (16px); a step is a point of the base ladder.
  assert.equal(contract.typography.sizes['1'].desktop, 'b6');
  const points = {f0: 160, f4: 224, f8: 288, g1: 352, g3: 416, g6: 512, h0: 640, h2: 768};
  assert.deepEqual(STEPS.map((n) => n * 16 / 2), LADDER_PX);
  assert.deepEqual(Object.values(points), LADDER_PX);
  // Declared again in both density regions.
  const density = read('src/core/scss/_sf_css__density.scss');
  for (const region of ['[data-sf-density="compact"] {', '[data-sf-density="normal"] {']) {
    const body = density.slice(density.indexOf(region), density.indexOf('}', density.indexOf(region)));
    assert.match(body, /--sf-measure--char: calc\(var\(--sf-text--size-1\) \/ 2\);/u, region);
    for (const n of STEPS) assert.ok(body.includes(`--sf-measure-${n}: calc(${n} * var(--sf-measure--char));`), `${region} ${n}`);
  }
  // In the core sheet.
  assert.match(read('src/core/scss/_sf_css__size.scss'), /@use '\.\.\/figma_variables\/figma_measure\.scss';/u);
});

test('the popup, window, field and reading roles read their steps (C32, C159, C396 8.3)', () => {
  const size = read('src/core/scss/_sf_css__size.scss');
  const roles = {
    '--sf-popup-menu-min-width': 20,
    '--sf-popup-menu-max-width': 36,
    '--sf-popup-list-max-width': 44,
    '--sf-popup-panel-width': 44,
    '--sf-popup-form-width': 44,
    '--sf-popup-form-wide-width': 52,
    '--sf-popup-question-width': 52,
    '--sf-popup--window-form-width': 80,
    '--sf-popup--window-wide-width': 96,
  };
  for (const [name, n] of Object.entries(roles)) assert.ok(size.includes(`${name}: var(--sf-measure-${n});`), name);
  const measure = read('src/core/figma_variables/figma_measure.scss');
  for (const [name, n] of [['short', 20], ['medium', 28], ['long', 44]]) assert.ok(measure.includes(`--sf-field--width-${name}: var(--sf-measure-${n});`), name);
  // The reading measures: dated aliases (token-aliases measures, journal token-c396-text-measure).
  const text = read('src/utility/text-max-width/default/scss/_sf_var__text_measure.scss');
  assert.match(text, /'': var\(--sf-measure-80\)/u);
  assert.match(text, /-wide: var\(--sf-measure-96\)/u);
  assert.match(text, /-narrow: var\(--sf-measure-52\)/u);
  const aliases = json('src/core/contracts/token-aliases.v1.json').measures;
  assert.equal(aliases.remove_after, '2027-01-01');
  assert.deepEqual(aliases.tokens.map(({from, to}) => [from, to]), [
    ['--sf-text--measure', '--sf-measure-80'],
    ['--sf-text--measure-wide', '--sf-measure-96'],
    ['--sf-text--measure-narrow', '--sf-measure-52'],
  ]);
  // The aliases are declared with the ladder (contract roles), so density regions redeclare them.
  const ladder = read('src/core/figma_variables/figma_measure.scss');
  const density = read('src/core/scss/_sf_css__density.scss');
  for (const [from, to] of [['text--measure', 80], ['text--measure-wide', 96], ['text--measure-narrow', 52]]) {
    assert.equal(json('src/core/contracts/adaptive-sizing.v1.json').measure.roles[from], to, from);
    assert.ok(ladder.includes(`--sf-${from}: var(--sf-measure-${to});`), `${from} in the ladder file`);
    assert.ok(density.split(`--sf-${from}: var(--sf-measure-${to});`).length >= 3, `${from} in both density regions`);
  }
  assert.doesNotMatch(read('src/core/scss/_sf_css__typograpy.scss'), /--sf-text--measure#\{/u);
  const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'token-c396-text-measure');
  assert.equal(record?.remove_after, aliases.remove_after);
  // The utilities: w-, max-w- and min-w-measure-N for the eight steps.
  for (const [folder, variable] of [['width', 'with-array'], ['max-width', 'with-max-array'], ['min-width', 'with-min-array']]) {
    const file = read(`src/utility/${folder}/default/scss/_sf_var__${folder === 'width' ? 'width' : folder === 'max-width' ? 'width_max' : 'width_min'}.scss`);
    assert.match(file, new RegExp(`\\$${variable}`, 'u'));
    for (const n of STEPS) assert.ok(file.includes(`"measure-${n}"\t: var(--sf-measure-${n}),`), `${folder} ${n}`);
  }
});

// The text containers of C396 8.3 (WM-3): the sheets and scripts whose
// widths hold lines of text. A width declaration in them -- inline-size,
// width and their min/max forms, a flex basis, a custom property named for a
// width -- reads a step of the width ladder or a role on one, never a point of
// the base ladder. Heights (max-block-size) are not widths and stay.
const TEXT_CONTAINERS = [
  'src/component/tooltip/scss/_css__tooltip_custom.scss',
  'src/component/clipboard/scss/_sf_copy.scss',
  'src/component/toast/scss/_css__toast.scss',
  'src/component/tags/scss/_css__tags.scss',
  'src/component/admin-menu/scss/_css__admin_menu.scss',
  'src/component/modal/scss/_css__modal_custom.scss',
  'src/component/country-code/scss/_css_country_code.scss',
  'src/core/scss/mix/_mix__sheet.scss',
  'src/core/scss/_sf_css__placeholder.scss',
  'src/smart/help-mark/scss/_smart__help_mark.scss',
  'src/smart/empty-state/scss/_smart__empty_state.scss',
  'src/smart/header-site/scss/_smart__site_header.scss',
  'src/smart/drawer/scss/_smart__drawer.scss',
  'src/smart/contents/scss/_smart__contents.scss',
  'src/smart/input-rich/scss/_smart__rich_text.scss',
  'src/smart/profile-picker/scss/_smart__profile_picker.scss',
  'src/smart/input-color/js/templates/default.css',
  'src/smart/editor-inline/scss/_smart__inline-editor.scss',
  'src/smart/search/scss/_smart__search.scss',
  'src/smart/input-lookup/scss/_smart__lookup.scss',
];
const WIDTH = /(?:^|[\s;{])((?:min-|max-)?(?:inline-size|width)|flex(?:-basis)?|--sf-[a-z0-9-]*(?:width|inline-size)[a-z0-9-]*)\s*:\s*([^;{}]+);/gu;
const BASE_POINT = /var\(--sf-[gh]\d\)/u;

test('a text container\'s width never reads a base ladder point (C396 grep gate)', () => {
  const wrong = [];
  for (const path of TEXT_CONTAINERS) {
    const text = read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    for (const [, property, value] of text.matchAll(WIDTH)) {
      if (property === '--sf-drawer-block-start' || property.includes('border')) continue;
      if (BASE_POINT.test(value)) wrong.push(`${path}: ${property}: ${value.trim()}`);
    }
  }
  // The scripts that write a width.
  const drawer = read('src/smart/drawer/index.js');
  const ladder = /const LADDER_WIDTHS = (\[[^\n]+\]);/u.exec(drawer)?.[1] ?? '';
  // GB17 Y3 (DEV return RP-1): the drawer counts its steps in its own character, the
  // normal ladder's, so compact density does not narrow it; still 44/52/64 steps.
  assert.match(ladder, /'1\/2', 'calc\(44 \* var\(--sf-drawer--char\)\)'.*'1', 'calc\(52 \* var\(--sf-drawer--char\)\)'.*'2', 'calc\(64 \* var\(--sf-drawer--char\)\)'/u);
  if (BASE_POINT.test(ladder)) wrong.push('src/smart/drawer/index.js: LADDER_WIDTHS');
  const tags = read('src/smart/tag-group/index.js');
  assert.match(tags, /popover\.setAttribute\('width', 'var\(--sf-measure-44\)'\);/u);
  assert.deepEqual(wrong, []);
});

test('the public variables of the text containers default to their steps (C396)', () => {
  const contract = json('src/core/contracts/public-variables.v1.json');
  const of = (component, name) => contract.components.find((one) => one.component === component)?.variables.find((one) => one.name === name)?.default;
  assert.equal(of('help-mark', '--sf-help-mark-max-width'), 'var(--sf-measure-44)');
  assert.equal(of('site-header', '--sf-site-header-sheet-inline-size'), 'min(90vw, var(--sf-measure-44))');
  assert.equal(of('search', '--sf-search-inline-size'), 'var(--sf-measure-80)');
});

test('every step of the ladder is a measure-N class at every breakpoint (Docara layout kit, 2026-11-21)', () => {
  const text = read('src/utility/text-max-width/default/scss/_sf_var__text_measure.scss');
  for (const n of STEPS) assert.ok(text.includes(`-${n}: var(--sf-measure-${n})`), `measure-${n}`);
  for (const point of ['default', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    const source = read(`src/utility/text-max-width/${point}/rule.js`);
    const rule = new RegExp(JSON.parse(source.slice(source.indexOf('new RegExp(') + 11, source.lastIndexOf(')'))));
    const prefix = point === 'default' ? '' : `${point}:`;
    for (const name of ['measure', 'measure-wide', 'measure-narrow', ...STEPS.map((n) => `measure-${n}`)]) assert.ok(rule.test(prefix + name), prefix + name);
    for (const name of ['measure-24', 'measure-0', 'measure-100', 'measure-44px']) assert.equal(rule.test(prefix + name), false, prefix + name);
  }
});
