import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-list-description and sf-list-timeline (2026-11-08), the general
// components the Larena admin screens asked for (Federation bus
// msg-993e1e39 items 5 and 7): what their sources promise, held without a
// browser. The behaviour is probed on the built bytes by each probe.json
// (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const code = (path) => read(path).split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');

test('the two names are registered to the Framework, family list, and loaded by the rule bundle', () => {
  for (const name of ['list-description', 'list-timeline']) {
    assert.ok(framework.names.some(({element}) => element === `sf-${name}`), name);
    assert.match(read('src/core/js/rule.src.js'), new RegExp(`import '\\.\\./\\.\\./smart/${name}/rule\\.js';`, 'u'));
    const manifest = json(`src/smart/${name}/component.json`);
    assert.equal(manifest.family, 'list');
    assert.deepEqual(manifest.settings.size.values, ['1/2', '1', '2']);
    const en = json(`src/smart/${name}/lang/en.json`);
    const ru = json(`src/smart/${name}/lang/ru.json`);
    assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort(), name);
    const source = code(`src/smart/${name}/index.js`);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage/u, `${name} loads and stores nothing`);
    // Text, never markup.
    assert.doesNotMatch(code(`src/smart/${name}/js/templates/default.js`), /unsafeHTML|innerHTML/u, name);
    // No pixel literal: every length is a ladder token or a share of one.
    assert.doesNotMatch(read(`src/smart/${name}/scss/_smart__${name}.scss`), /\d+px\b/u, name);
  }
});

test('sf-list-description: a dl of label and value, the columns a subgrid, stacked when narrow', () => {
  const manifest = json('src/smart/list-description/component.json');
  assert.deepEqual(manifest.settings.items.schema.items.required, ['label']);
  for (const field of ['label', 'value', 'hint', 'mono', 'copy', 'href', 'status', 'type', 'badge', 'help', 'numeric', 'empty', 'action']) {
    assert.ok(manifest.settings.items.schema.items.properties[field], field);
  }
  assert.deepEqual(manifest.settings.layout.values, ['auto', 'columns', 'stacked', 'grid']);
  assert.deepEqual(manifest.settings.columns.values, ['1', '2', '3', '4']);
  assert.deepEqual(manifest.settings.overflow.values, ['wrap', 'truncate']);
  assert.equal(manifest.settings.dividers.type, 'boolean');
  assert.deepEqual(Object.keys(manifest.events), ['navigate', 'apply']);
  assert.equal(manifest.events.navigate.cancelable, true);
  assert.deepEqual(manifest.events.apply.carries, {action: 'string', scope: 'string', ids: 'list', id: 'string', kind: 'string'});
  const template = code('src/smart/list-description/js/templates/default.js');
  assert.match(template, /<dl class="sf-list-description-list">/u);
  assert.match(template, /<dt class="sf-list-description-label">/u);
  assert.match(template, /<dd class="sf-list-description-value">/u);
  assert.match(template, /<sf-button-copy class="sf-list-description-copy"/u);
  // Sections (C33): one grid of heads and dls, each dl a subgrid of it.
  assert.match(template, /<div class="sf-list-description-list">\$\{sections\(context\)\}<\/div>/u);
  assert.match(template, /<dl class="sf-list-description-part"/u);
  const sheet = read('src/smart/list-description/scss/_smart__list-description.scss');
  assert.match(sheet, /grid-template-columns: fit-content\(var\(--sf-list-description-label-width, 40%\)\) minmax\(0, 1fr\);/u);
  assert.match(sheet, /grid-template-columns: subgrid;/u);
  assert.match(sheet, /\.sf-list-description-part \{\s*display: grid;\s*grid-column: 1 \/ -1;\s*grid-template-columns: subgrid;/u);
  assert.match(sheet, /font-variant-numeric: tabular-nums;/u);
  assert.match(sheet, /@container \(max-width: 24rem\)/u);
  // A one-line row is the rung's control height: the block inset is (H - L) / 2.
  assert.match(sheet, /--sf-list-description--padding-block: calc\(\(var\(--sf-list-description--control\) - var\(--sf-list-description--line\)\) \/ 2\);/u);
  const source = code('src/smart/list-description/index.js');
  // An empty value has no copy button and no link.
  assert.match(source, /copy: item\.copy === true && shown !== '',/u);
  assert.match(source, /href: shown === '' \? '' : text\(item\.href\),/u);
  // An empty value draws no status (the C33 defect: the icon before «—»), nor
  // does a value with a badge (one mark, C33 acceptance).
  assert.match(source, /status: !empty && !badge && STATUSES\.includes\(status\) \? status : '',/u);
  assert.equal(json('src/smart/list-description/lang/ru.json').runtime['empty-text'], 'Не указан');
});

test('sf-list-timeline: the host\'s order, runs of one day, the shared parts (C40), the connector, load-more after', () => {
  const manifest = json('src/smart/list-timeline/component.json');
  assert.equal(manifest.version, '1.1.0');
  assert.deepEqual(manifest.settings.items.schema.items.required, ['id', 'title']);
  assert.deepEqual(manifest.settings.group.values, ['day', 'none']);
  assert.deepEqual(manifest.settings['time-format'].values, ['auto', 'relative', 'exact']);
  assert.equal(manifest.settings['time-format'].default, 'auto');
  assert.deepEqual(manifest.settings.density.values, ['normal', 'compact']);
  assert.match(manifest.settings.density.summary, /^Deprecated until 2027-01-01/u);
  assert.equal(manifest.settings.collapse.default, 5);
  assert.deepEqual(Object.keys(manifest.events), ['navigate', 'load-more', 'expand']);
  assert.deepEqual(manifest.events['load-more'].carries, {direction: 'string', after: 'string'});
  for (const name of ['featured-icon', 'list-heading', 'cl-time', 'cl-change', 'cl-avatar']) {
    assert.ok(manifest.relations.some((relation) => relation.name === name), name);
  }
  const source = code('src/smart/list-timeline/index.js');
  assert.match(source, /from '\.\.\/\.\.\/core\/js\/format-relative\.js';/u);
  assert.match(source, /formatRelativeDay\(run\.at, \{now, capital: true/u);
  assert.doesNotMatch(source, /\.sort\(/u, 'the list never sorts');
  assert.match(source, /if \(last && \(day === null \|\| day === last\.day\)\) last\.items\.push\(item\);/u);
  // One timer, to midnight, only with the reader's clock and day headings,
  // stopped off the page; the times are sf-time's.
  assert.match(source, /if \(!this\.isConnected \|\| toDate\(text\(this\.now\)\) \|\| this\.group !== 'day' \|\| !this\.list\.some\(\(item\) => item\.at\)\) return;/u);
  assert.match(source, /onDisconnected\(\) \{\s*super\.onDisconnected\?\.\(\);\s*this\.stopTimer\(\);/u);
  assert.doesNotMatch(source, /setInterval/u);
  assert.match(source, /export const KIND_ICONS = \{comment: 'chat_bubble', sms: 'phone_iphone'\};/u);
  assert.match(source, /noteDeprecated\(\{component: 'sf-list-timeline', kind: 'attribute', from: 'density', to: 'data-sf-density'/u);
  const template = code('src/smart/list-timeline/js/templates/default.js');
  assert.match(template, /<sf-time class="sf-list-timeline-time" datetime=\$\{item\.iso\} format=\$\{context\.timeFormat\}/u);
  assert.match(template, /sf-featured-icon sf-featured-icon--circle sf-featured-icon--size-\$\{BELOW\[context\.size\]\}/u);
  assert.match(template, /<sf-avatar inert aria-hidden="true"/u);
  assert.match(template, /<sf-change class="sf-list-timeline-change"/u);
  assert.match(template, /aria-current=\$\{item\.state === 'current' \? 'step' : nothing\}/u);
  assert.match(template, /sf-list-heading sf-list-timeline-day/u);
  assert.match(template, /role="heading" aria-level=\$\{String\(context\.level\)\}/u);
  assert.match(template, /<ol class=\$\{classes\} aria-labelledby=\$\{day\.id\}>/u);
  const sheet = read('src/smart/list-timeline/scss/_smart__list-timeline.scss');
  // The connector: no line after the last event of a day; from the middle of
  // one event's first line to the middle of the next one's.
  assert.match(sheet, /\.sf-list-timeline-item:not\(:last-child\)::before \{/u);
  assert.match(sheet, /inset-block: calc\(var\(--sf-list-timeline--line\) \/ 2\) calc\(var\(--sf-list-timeline--line\) \/ -2\);/u);
  // R092: --sf-space-3 between events; the density is the page's, the list
  // never paints the place.
  assert.match(sheet, /--sf-list-timeline--row-gap: var\(--sf-list-timeline-gap, var\(--sf-space-3\)\);/u);
  assert.doesNotMatch(sheet, /density-compact|surface-1\b|--sf-surface-container/u);
});
