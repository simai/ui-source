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
  assert.ok(css.includes('--sf-ui-1\\/2--text-space-x'));
  assert.match(css, /--sf-ui-1--text-space-x/);
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
  };

  assert.equal(component.version, '1.2.0');
  assert.equal(manifest.version, '1.2.0');
  assert.deepEqual(component.settings.activity.values, ['', ...Object.keys(states)]);
  assert.equal(component.settings.activity.default, '');
  assert.equal(component.settings.compact.type, 'boolean');
  assert.equal(component.settings.compact.default, false);
  assert.deepEqual(component.settings.appearance.values, ['main', 'tonal', 'outline'], 'compact is no appearance');

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
  assert.ok(examples.examples.some(({settings}) => settings.compact === true), 'compact has an example');

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
  assert.match(css, /\.sf-badge\.sf-badge--compact \{/);
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
