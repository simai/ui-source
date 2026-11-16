import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-progress-run 1.4.0 and sf-tile-metric 1.3.0 (2026-11-13): the defects
// the recipe prototypes found (ui-control prototypes/recipe-long-job.html,
// recipe-quota-usage.html at 1cb805c5) and owner decision C134 for the row
// look, held without a browser. The behaviour is probed on the built bytes by
// each probe.json (p15-p19 of progress-run, p6 of tile-metric).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const code = (path) => read(path).split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');

test('sf-progress-run: a run of unknown size draws the indeterminate bar with steps too', () => {
  const source = code('src/smart/progress-run/index.js');
  assert.match(source, /const showBar = total !== null \|\| !list\.length \|\| indeterminate;/u);
  assert.match(source, /const indeterminate = total === null && \(state === 'running' \|\| state === 'paused'\);/u);
});

test('sf-progress-run: its own polite live region says the count, throttled, never in a row', () => {
  const source = code('src/smart/progress-run/index.js');
  assert.match(source, /export const ANNOUNCE_MS = 10000;/u);
  assert.match(source, /next !== this\._spoken && now - this\._spokenAt >= ANNOUNCE_MS/u);
  // The wait counts from the render that drew the text, not from the context.
  assert.match(source, /if \(this\._spokenDrawn\) \{\n\s*this\._spokenDrawn = false;\n\s*this\._spokenAt = Date\.now\(\);/u);
  assert.match(source, /if \(state !== 'running' \|\| view === 'row'\) \{/u);
  const template = code('src/smart/progress-run/js/templates/default.js');
  assert.match(template, /class="sf-progress-run-live sr-only" aria-live="polite" aria-atomic="true">\$\{context\.spoken\}/u);
  for (const locale of ['ru', 'en']) {
    const words = json(`src/smart/progress-run/lang/${locale}.json`).runtime;
    assert.match(words['announce-progress'], /\{value\}.*\{total\}\{unit\}.*\{percent\}/u, locale);
    assert.equal(words['announce-count'], '{value}{unit}', locale);
    assert.ok(!('empty-output' in words), `${locale}: the empty output words are gone with the empty toggle`);
  }
});

test('sf-progress-run: no output, no «Вывод» toggle', () => {
  const template = code('src/smart/progress-run/js/templates/default.js');
  assert.match(template, /function output\(context\) \{\n\s*const \{[^}]+\} = context;\n\s*if \(!context\.outputShown\) return nothing;/u);
});

test('sf-progress-run: a run with no steps is done once value reached total, partial with errors', () => {
  const source = code('src/smart/progress-run/index.js');
  assert.match(source, /worked = \(this\.done \?\? 0\) >= this\.whole \? 'done' : 'running';/u);
  assert.match(source, /if \(worked === 'done' && this\.errorsCount > 0\) return 'partial';/u);
});

test('sf-progress-run: look row, compact a dated value alias of it (C134)', () => {
  const manifest = json('src/smart/progress-run/component.json');
  assert.deepEqual(manifest.settings.look.values, ['full', 'row', 'notice']);
  assert.deepEqual(manifest.aliases.rows.map(({from, to, kind, setting}) => ({from, to, kind, setting})), [{from: 'compact', to: 'row', kind: 'value', setting: 'look'}]);
  assert.equal(manifest.aliases['remove-after'], '2027-01-01');
  const aliases = json('src/smart/progress-run/aliases.json');
  assert.equal(aliases.aliases[0].from, 'compact');
  assert.equal(aliases.aliases[0].to, 'row');
  assert.match(code('src/smart/progress-run/index.js'), /\n\s+aliases,\n/u);
  const template = code('src/smart/progress-run/js/templates/default.js');
  assert.match(template, /view === 'row' \? 'sf-progress-run--view-compact' : ''/u);
  const sheet = read('src/smart/progress-run/scss/_smart__progress-run.scss');
  assert.match(sheet, /\.sf-progress-run:is\(\.sf-progress-run--view-row, \.sf-progress-run--view-compact\)/u);
  const record = json('contracts/changes/journal.json').records.find(({id}) => id === 'value-progress-run-look-compact-to-row');
  assert.ok(record);
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items, [{component: 'sf-progress-run', attribute: 'look', from: 'compact', to: 'row'}]);
  const examples = json('src/smart/progress-run/examples.json').examples.map(({name}) => name);
  assert.ok(!examples.some((name) => name.startsWith('compact-')));
  assert.ok(examples.includes('row-running'));
});

test('sf-tile-metric: a status without hint shows its word beside the icon', () => {
  const template = code('src/smart/tile-metric/js/templates/default.js');
  assert.match(template, /\$\{hint \|\| context\.statusWord \? html`<span class="sf-tile-metric-hint">\$\{hint \|\| context\.statusWord\}<\/span>` : nothing\}/u);
  assert.match(template, /context\.statusWord && hint \? html`<span class="sr-only">\$\{context\.statusWord\}: <\/span>`/u);
  for (const locale of ['ru', 'en']) {
    const words = json(`src/smart/tile-metric/lang/${locale}.json`).runtime;
    for (const status of ['warning', 'error']) assert.ok(words[`status-${status}`], `${locale} ${status}`);
  }
});
