import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Badge presentation uses semantic roles and high-level geometry tokens', async () => {
  const css = await read('src/component/badges/scss/_css__badges.scss');

  assert.match(css, /--sf-radius-circle/);
  assert.match(css, /--sf-px/);
  assert.ok(css.includes('--sf-ui-1\\/3--space-y-tightness-low'));
  // The side rooms are space steps (BG-9): the default, tight and a figure's.
  assert.ok(css.includes('--sf-badge--side-tight: var(--sf-space-1\\/3)'));
  assert.doesNotMatch(css, /text-space-x\)/);
  assert.match(css, /--sf-badge--border-style: solid/);
  assert.match(css, /text-overflow: ellipsis/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /\b(?:1|2|4|6|8|12|16|20|24|28|32)(?:px|rem)\b/);
});

test('Ordinary and Smart Badge preserve static inline semantics', async () => {
  const [ordinary, smartTemplate] = await Promise.all([
    read('src/component/badges/js/_badges.js'),
    read('src/smart/badge/js/templates/default.js'),
  ]);

  assert.match(ordinary, /createElement\('span'\)/);
  assert.match(ordinary, /classList\.add\('sr-only'\)/);
  assert.match(ordinary, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(smartTemplate, /<span[\s\S]*class=\$\{classes\.join\(' '\)\}/);
  assert.match(smartTemplate, /class="sr-only"/);
  assert.match(smartTemplate, /aria-hidden="true"/);
  assert.doesNotMatch(smartTemplate, /<button|tabindex/);
});

test('Smart Badge declares exact variants and no keyboard ownership', async () => {
  const manifest = JSON.parse(await read('src/smart/badge/smart.manifest.json'));

  assert.deepEqual(manifest.composition.uses, ['component.badges', 'component.spinner']);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1']);
  assert.deepEqual(manifest.inputs.properties.type.enum, ['main', 'tonal', 'outline']);
  assert.deepEqual(manifest.inputs.properties['icon-position'].enum, ['start', 'end']);
  assert.deepEqual(manifest.accessibility.keyboard, []);
  assert.match(manifest.accessibility.focus, /does not enter the tab order/);
});

test('Smart Badge declares the run state: its settings, marks, roles and words', async () => {
  const [component, en, ru, source, template, css, examples, manifest] = await Promise.all([
    read('src/smart/badge/component.json').then(JSON.parse),
    read('src/smart/badge/lang/en.json').then(JSON.parse),
    read('src/smart/badge/lang/ru.json').then(JSON.parse),
    read('src/smart/badge/index.js'),
    read('src/smart/badge/js/templates/default.js'),
    read('src/component/badges/scss/_css__badges.scss'),
    read('src/smart/badge/examples.json').then(JSON.parse),
    read('src/smart/badge/smart.manifest.json').then(JSON.parse),
  ]);
  const states = {
    running: {role: 'neutral', word: 'Running'},
    waiting: {role: 'warning', icon: 'pending_actions', word: 'Needs your input'},
    done: {role: 'success', icon: 'check_circle', word: 'Ready'},
    stopped: {role: 'neutral', icon: 'stop_circle', word: 'Stopped'},
    failed: {role: 'error', icon: 'error', word: 'Failed'},
    paused: {role: 'warning', icon: 'pause_circle', word: 'Paused'},
    queued: {role: 'neutral', icon: 'schedule', word: 'Queued'},
  };

  // 1.6.0 renames compact to icon-only (C134); the run state is unchanged.
  assert.equal(component.version, '1.6.0');
  assert.equal(manifest.version, '1.6.0');
  assert.deepEqual(component.settings.activity.values, ['', ...Object.keys(states)]);
  assert.equal(component.settings.activity.default, '');
  assert.equal(component.settings['icon-only'].type, 'boolean');
  assert.equal(component.settings['icon-only'].default, false);
  assert.ok(!('compact' in component.settings), 'compact is a dated alias, not a setting (C134)');
  assert.deepEqual(component.settings.appearance.values, ['main', 'tonal', 'outline'], 'icon-only is no appearance');

  for (const [state, {role, icon, word}] of Object.entries(states)) {
    const key = `activity-${state}`;
    assert.equal(en.runtime[key], word);
    assert.ok(ru.runtime[key], `${key} has a Russian word`);
    assert.notEqual(ru.runtime[key], word, `${key} is translated`);
    const row = source.match(new RegExp(`^  ${state}: \\{(.*)\\},$`, 'm'))?.[1] ?? '';
    assert.match(row, new RegExp(`role: '${role}'`), `${state} paints ${role}`);
    assert.match(row, new RegExp(`word: '${key}'`), `${state} says ${key}`);
    if (icon) assert.match(row, new RegExp(`icon: '${icon}'`), `${state} draws ${icon}`);
    else assert.match(row, /spinner: true/, `${state} draws the spinner`);
    assert.ok(examples.examples.some(({settings}) => settings.activity === state), `${state} has an example`);
  }
  assert.ok(examples.examples.some(({settings}) => settings['icon-only'] === true), 'icon-only has an example');

  // The template reads the resolved values, never the raw setting.
  assert.match(source, /paintedScheme: this\.paintedScheme,/);
  assert.match(source, /drawnText: this\.drawnText,/);
  assert.match(source, /drawnIcon: this\.drawnIcon,/);
  assert.match(source, /activitySpinner: this\.activitySpinner,/);
  assert.doesNotMatch(template, /context\.status|context\.scheme|context\.text\b|context\.icon\b/);

  // The one spinner of the Framework in a slot of the badge's own sheet, and no
  // announcement: the host owns any live region.
  assert.match(template, /createInlineSpinner\(\{className: 'sf-badge-spinner'\}\)/);
  assert.match(css, /\.sf-badge \.sf-badge-spinner \{/);
  assert.match(css, /\.sf-badge:is\(\.sf-badge--icon-only, \.sf-badge--compact\) \{/);
  assert.doesNotMatch(template, /aria-live|role=|aria-busy/);
  assert.deepEqual(component.relations.find(({name}) => name === 'spinner')?.lazy, true);
});

test('Badge documentation covers every public axis with runnable examples', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, basic, types, schemes, sizes, icons] = await Promise.all([
    readUiDoc('content/ru/components/feedback/badges.md'),
    readUiDoc('examples/components/badges/basic/index.html'),
    readUiDoc('examples/components/badges/types/index.html'),
    readUiDoc('examples/components/badges/overview/index.html'),
    readUiDoc('examples/components/badges/sizes/index.html'),
    readUiDoc('examples/components/badges/icons/index.html'),
  ]);
  const examples = [basic, types, schemes, sizes, icons].join('\n');

  for (const id of ['basic', 'types', 'overview', 'sizes', 'icons']) {
    assert.ok(page.includes(`components/badges/${id}`));
  }
  for (const type of ['main', 'tonal', 'outline']) {
    assert.match(schemes, new RegExp(`sf-badge--${type}`));
  }
  for (const scheme of ['neutral', 'primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error', 'on-surface']) {
    assert.match(schemes, new RegExp(`sf-badge--${scheme}`));
  }
  // `danger` is a compatibility alias: the page lists it as deprecated with its
  // replacement, and examples show only the canonical `error`.
  assert.match(page, /\| Устаревшие \|[^\n]*`sf-badge--danger` → `sf-badge--error`/);
  assert.doesNotMatch(examples, /sf-badge--danger/);
  for (const size of ['1/3', '1/2', '1']) {
    assert.match(sizes, new RegExp(`sf-badge--size-${size.replace('/', '\\/')}`));
  }
  assert.match(icons, /class="sr-only"/);
  assert.match(icons, /aria-hidden="true"/);
  assert.doesNotMatch(examples, /<style\b|style=/);
});

// Docs review R019, R020 (2026-11-07): one height per size whatever the look,
// --sf-space-1/2 of side room by default (owner decision), tight for the room before, a single
// figure round. The geometry itself is measured by
// tests/browser/badge-geometry.browser.mjs.
test('Badge draws its border inside its size and offers tight side room', async () => {
  const [css, component, manifest, template, passport, variables] = await Promise.all([
    read('src/component/badges/scss/_css__badges.scss'),
    read('src/smart/badge/component.json').then(JSON.parse),
    read('src/smart/badge/smart.manifest.json').then(JSON.parse),
    read('src/smart/badge/js/templates/default.js'),
    read('src/component/badges/passport.json').then(JSON.parse),
    read('src/core/contracts/public-variables.v1.json').then(JSON.parse),
  ]);

  // 1.5.0: a tonal badge on a translucent fill lays its tone over the place (C43).
  // 1.6.0: sf-badge--line-text, the line of the text beside it (C95 point 6).
  // 1.7.0: the anchored dot and count take core's small steps (C132);
  // 1.7.1: the small steps' internal names are --sf-micro--*;
  // 1.8.0: sf-badge--icon-only (former sf-badge--compact, C134), tight on --sf-space-1/3 (BG-9).
  assert.equal(passport.version, '1.8.0');
  for (const side of ['block-start', 'block-end', 'inline-start', 'inline-end']) {
    assert.match(css, new RegExp(`padding-${side}: max\\(var\\(--sf-a0\\), calc\\(`), `padding-${side} gives up the border`);
  }
  assert.match(css, /--sf-badge--side-room: var\(--sf-space-1\\\/2\);/);
  assert.match(css, /\.sf-badge\.sf-badge--tight \{\s*--sf-badge--side-room: var\(--sf-badge--side-tight\);/);
  assert.match(css, /\.sf-badge:is\(\.sf-badge--figure, \[data-count\]\) \{/);
  assert.equal(component.settings.tight.type, 'boolean');
  assert.equal(component.settings.tight.default, false);
  assert.equal(manifest.inputs.properties.tight.type, 'boolean');
  assert.match(template, /context\.tight \? 'sf-badge--tight'/);
  assert.match(template, /isFigure \? 'sf-badge--figure'/);
  const padding = variables.components.find((entry) => entry.component === 'badge').variables.find((entry) => entry.name === '--sf-badge-padding-inline');
  assert.equal(padding.default, 'var(--sf-space-1/2)');
  assert.ok(padding.varies_with.includes('tight'));
});

test('a tonal badge on a translucent fill lays its tone over the solid place (C43)', async () => {
  const [css, theme, mix, popover] = await Promise.all([
    read('src/component/badges/scss/_css__badges.scss'),
    read('src/core/scss/_sf_css__theme.scss'),
    read('src/core/scss/mix/_mix__places.scss'),
    read('src/smart/popover/js/templates/default.css'),
  ]);
  // The badge: its tone over the role, as a background image only; the
  // background-color stays its tone, so off a fill nothing changes.
  assert.match(css, /\.sf-badge\.sf-badge--tonal \{\s*background-image: linear-gradient\(var\(--sf-badge--background-color\), var\(--sf-badge--background-color\)\), linear-gradient\(var\(--sf-surface-underlay\), var\(--sf-surface-underlay\)\);\s*\}/u);
  assert.match(css, /\.sf-badge \{[^}]*background-color: var\(--sf-badge--background-color\);/u);
  // The role is guaranteed invalid on the page and on every place.
  assert.match(theme, /\s--sf-surface-underlay: initial;/u);
  assert.match(mix, /'surface-underlay': 'initial'/u);
  for (const name of ['sf-place-soft', 'sf-place-strong']) {
    const body = mix.slice(mix.indexOf(`@mixin ${name}`), mix.indexOf('\n}\n', mix.indexOf(`@mixin ${name}`)));
    assert.match(body, /--sf-surface-underlay: initial;/u, name);
  }
  assert.match(popover, /--sf-surface-underlay: initial;/u);
  // Every place takes the row's fill back too (C43 later, 2026-11-12): the
  // theme map an opaque place re-declares, the soft and strong places, glass
  // and the popover, so the ring reads it on its own.
  assert.match(theme, /\s--sf-surface-place-fill: initial;/u);
  assert.match(mix, /'surface-place-fill': 'initial'/u);
  for (const name of ['sf-place-soft', 'sf-place-strong']) {
    const body = mix.slice(mix.indexOf(`@mixin ${name}`), mix.indexOf('\n}\n', mix.indexOf(`@mixin ${name}`)));
    assert.match(body, /--sf-surface-place-fill: initial;/u, name);
  }
  assert.match(popover, /--sf-surface-place-fill: initial;/u);
  assert.match(await read('src/core/scss/_sf_css__surface_places.scss'), /\.sf-surface-media \{[^}]*--sf-surface-place-fill: initial;/u);
  // A translucent fill declares the place it stands on.
  assert.match(mix, /@mixin sf-place-fill\(\$fill\) \{\s*--sf-surface-underlay: var\(--sf-surface-place-solid\);[^}]*--sf-surface-place-fill: #\{\$fill\};\s*\}/u);
  // The solid colour: the page's, an opaque or strong place's; initial on a
  // translucent (soft) place, so a row there leaves the role off (DEV D1).
  assert.match(theme, /\s--sf-surface-place-solid: var\(--sf-surface-page\);/u);
  assert.match(mix.slice(mix.indexOf('@mixin sf-place-soft'), mix.indexOf('\n}\n', mix.indexOf('@mixin sf-place-soft'))), /--sf-surface-place-solid: initial;/u);
  assert.match(mix.slice(mix.indexOf('@mixin sf-place('), mix.indexOf('\n}\n', mix.indexOf('@mixin sf-place('))), /--sf-surface-place-solid: #\{\$surface\};/u);
  // The Framework's selected, current and open rows include it.
  const rows = [
    ['src/component/dropdown/scss/_css__list-item.scss', /\.sf-list-item\.selected \{[^}]*@include places\.sf-place-fill\(/u],
    ['src/component/dropdown/scss/_css__list.scss', /\.sf-list--menu \.sf-list-item\.selected \{[^}]*@include places\.sf-place-fill\(/u],
    ['src/component/context-menu/scss/_css__context_menu.scss', /\.sf-context-menu-item--current \{[^}]*@include places\.sf-place-fill\(/u],
    ['src/component/context-menu/scss/_css__context_menu.scss', /\.sf-context-menu-item--chosen \{[^}]*@include places\.sf-place-fill\(/u],
    ['src/component/admin-menu/scss/_css__admin_menu.scss', /\.sf-admin-menu-search-row\.selected \{[^}]*@include places\.sf-place-fill\(/u],
    ['src/component/tree/scss/_css__tree.scss', /\[aria-selected='true'\] > \.sf-tree-item-container \{[^}]*@include places\.sf-place-fill\(/u],
    ['src/component/menu/scss/_css__menu.scss', /@mixin current-plate \{[^}]*@include places\.sf-place-fill\(/u],
    ['src/smart/list/js/templates/default.css', /\.sf-list__row--current \{[^}]*--sf-surface-underlay: var\(--sf-surface-place-solid\); --sf-surface-place-fill: var\(--sf-list--current\);/u],
    ['src/smart/input-choice/scss/_smart__choice.scss', /\.sf-choice \.sf-choice-card--checked:hover \{[^}]*@include places\.sf-place-fill\(/u],
  ];
  for (const [path, pattern] of rows) assert.match(await read(path), pattern, path);
});

// C43 D3 and D4 (2026-11-11): the anchored badge's ring on a translucent row is
// the row's colour, and the hovered and open rows are translucent fills too.
test('an anchored badge rings with the row it stands on, and hover rows keep a tonal badge (C43 D3, D4)', async () => {
  const [geometry, cm, tree, list, item, menu, choice, smartList] = await Promise.all([
    read('src/component/badges/scss/_anchored-geometry.scss'),
    read('src/component/context-menu/scss/_css__context_menu.scss'),
    read('src/component/tree/scss/_css__tree.scss'),
    read('src/component/dropdown/scss/_css__list.scss'),
    read('src/component/dropdown/scss/_css__list-item.scss'),
    read('src/component/menu/scss/_css__menu.scss'),
    read('src/smart/input-choice/scss/_smart__choice.scss'),
    read('src/smart/list/js/templates/default.css'),
  ]);
  // The fill is read on its own (every place takes it back, C43 later), laid
  // over the ring, and both over the nearest opaque place.
  assert.match(geometry, /--sf-badge--ring-fill: var\(--sf-surface-place-fill, transparent\);/u);
  assert.match(geometry, /box-shadow: 0 0 0 var\(--sf-badge--ring-width\) var\(--sf-badge--ring-fill\), 0 0 0 var\(--sf-badge--ring-width\) var\(--sf-badge--ring\), 0 0 0 var\(--sf-badge--ring-width\) var\(--sf-surface-place-ground, transparent\);/u);
  assert.doesNotMatch(geometry, /--sf-badge--ring-fill: [^;]*underlay/u);
  // Every include names its fill.
  for (const [name, css] of Object.entries({cm, tree, list, item, menu, choice})) {
    assert.doesNotMatch(css, /sf-place-fill;/u, name);
  }
  // The hover and open rows.
  assert.match(cm, /\.sf-context-menu-item\[aria-expanded="true"\] \{[^}]*@include places\.sf-place-fill\(var\(--sf-surface-state-select\)\);/u);
  assert.match(cm, /\.sf-context-menu-item--chosen:not\(:disabled\):hover \{[^}]*@include places\.sf-place-fill\(var\(--sf-primary-container-hover\)\);/u);
  assert.match(tree, /:hover > \.sf-tree-item-container \{[^}]*@include places\.sf-place-fill\(var\(--sf-surface-container-hover\)\);/u);
  assert.match(list, /\.sf-list--menu \[role="option"\]\.sf-list-item:not\(:disabled\):not\(\.disabled\):hover \{[^}]*@include places\.sf-place-fill\(/u);
  assert.match(item, /\.sf-list \[role="option"\]\.sf-list-item:not\(:disabled\):not\(\.disabled\):hover \{[^}]*@include places\.sf-place-fill\(/u);
  assert.match(menu, /\.sf-menu-element\.open:not\(:disabled\)[^{]*\{[^}]*@include places\.sf-place-fill\(var\(--sf-menu-element--background-color\)\);/u);
  assert.match(choice, /:not\(\.sf-choice-card--disabled, \.sf-choice-card--checked\):hover \{[^}]*@include places\.sf-place-fill\(var\(--sf-surface-state-hover\)\);/u);
  assert.match(smartList, /\.sf-list__row:not\(\.sf-list__row--current\):not\(\.sf-list__row--editing\):hover \{[^}]*--sf-surface-underlay: var\(--sf-surface-place-solid\); --sf-surface-place-fill: var\(--sf-list--hover\);/u);
});

// C43 D3 and D4, the table rows (2026-11-12): a striped, hovered or active
// cell is a translucent fill too, read from the cell's accent; a cell at rest
// declares nothing.
test('striped, hovered and active table cells are fills of their accent (C43 D3, D4)', async () => {
  const [table, active, hover, stripe] = await Promise.all([
    read('src/utility/table/default/scss/_sf_css__table.scss'),
    read('src/utility/table-active/default/scss/_sf_css__table_active.scss'),
    read('src/utility/table-hover/default/scss/_sf_css__table_stripe.scss'),
    read('src/utility/table-stripe/default/scss/_sf_css__table_stripe.scss'),
  ]);
  const fill = /@include places\.sf-place-fill\(var\(#\{\$prefix\}accent-bg\)\);/gu;
  assert.equal(active.match(fill)?.length, 1, 'table-active');
  assert.equal(hover.match(fill)?.length, 2, 'table-hover and hovered stripe');
  assert.equal(stripe.match(fill)?.length, 2, 'table-stripe and table-stripe-col');
  assert.doesNotMatch(table, /sf-place-fill/u, 'a cell at rest');
});

// C43 D3 and D4, the rows the first round left out (badge-rows-5, 2026-11-13):
// a context menu's panel row (hovered, checked, checked and hovered), a lookup
// option (hovered, chosen) and the compact contents list's entry under the
// pointer are translucent fills too, each named to the mix with its own fill.
test('panel rows, lookup options and contents entries are fills of their own colour (C43 D3, D4)', async () => {
  const [cm, lookup, contents] = await Promise.all([
    read('src/component/context-menu/scss/_css__context_menu.scss'),
    read('src/smart/input-lookup/scss/_smart__lookup.scss'),
    read('src/smart/contents/scss/_smart__contents.scss'),
  ]);
  const rule = (css, selector, fill) => {
    const at = css.indexOf(`${selector} {`);
    assert.ok(at >= 0, selector);
    const body = css.slice(at, css.indexOf('}', at));
    assert.match(body, /background-color: var\(--sf-[a-z-]+\);/u, `${selector}: paints a fill`);
    assert.ok(body.includes(`background-color: var(${fill});`), `${selector}: paints ${fill}`);
    assert.ok(body.includes(`@include places.sf-place-fill(var(${fill}));`), `${selector}: names ${fill} to the mix`);
  };
  const checked = '.sf-context-menu-row:has(> :is(sf-checkbox, sf-radio, input) :checked, > input:checked)';
  rule(cm, '.sf-context-menu-row:hover', '--sf-surface-state-select');
  rule(cm, checked, '--sf-primary-container');
  rule(cm, `${checked}:hover`, '--sf-primary-container-hover');
  rule(lookup, '.sf-lookup .sf-lookup-option:hover', '--sf-surface-state-hover');
  rule(lookup, '.sf-lookup .sf-lookup-option.sf-lookup-option--chosen', '--sf-primary-container');
  rule(contents, '  .sf-contents-link:hover', '--sf-surface-container-hover');
});
