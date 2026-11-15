import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-tile-metric 1.4.0 (owner decision C168, 2026-11-14; study ui-control
// control/research/2026-11-14-tile-metric.md): the four accepted points held
// without a browser. The behaviour is probed on the built bytes by probe.json
// (p7-p9) and measured in the C168 evidence.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const code = (path) => read(path).split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');

test('C168 (1): no change is the visible words on the change line, no badge and no sign', () => {
  const template = code('src/smart/tile-metric/js/templates/default.js');
  assert.match(template, /if \(delta\.direction === 'flat'\) \{\n\s*return html`<span class="sf-tile-metric-delta">\n\s*<span class="sf-tile-metric-flat">\$\{delta\.word\}<\/span>/u);
  for (const locale of ['ru', 'en']) assert.ok(json(`src/smart/tile-metric/lang/${locale}.json`).runtime['change-flat']);
  const sheet = read('src/smart/tile-metric/scss/_smart__tile-metric.scss');
  assert.match(sheet, /\.sf-tile-metric-label,\n\.sf-tile-metric-flat,\n\.sf-tile-metric-period,/u, 'the words take the hint colour');
});

test('C168 (2): money is whole by default; decimal-2 and compact are the page\'s', async () => {
  const {tileFormat} = await import('../src/smart/tile-metric/index.js').catch(() => ({}));
  const source = code('src/smart/tile-metric/index.js');
  assert.match(source, /return money && !precise \? \[\.\.\.words, 'integer'\]\.join\(' '\) : words\.join\(' '\) \|\| 'number';/u);
  assert.match(source, /formatNumber\(value, tileFormat\(this\.format\), /u);
  if (tileFormat) {
    assert.equal(tileFormat('currency-RUB'), 'currency-RUB integer');
    assert.equal(tileFormat('currency-RUB decimal-2'), 'currency-RUB decimal-2');
    assert.equal(tileFormat('currency-RUB compact'), 'currency-RUB compact');
    assert.equal(tileFormat('integer'), 'integer');
  }
});

test('C168 (3): an svg names a slot; the chart is the tile\'s width, 32 high, in the hint colour', () => {
  const base = code('src/core/js/smart-base.js');
  assert.match(base, /Array\.from\(this\.children\)\.forEach\(\(child\) => \{\n\s*if \(!\(child instanceof Element\)\) \{/u);
  const sheet = read('src/smart/tile-metric/scss/_smart__tile-metric.scss');
  assert.match(sheet, /\.sf-tile-metric-chart \{\n\s*display: block;\n\s*min-inline-size: 0;\n\s*color: var\(--sf-on-surface-variant\);/u);
  assert.match(sheet, /\.sf-tile-metric-chart > \* \{[^}]*inline-size: 100%;[^}]*block-size: var\(--sf-c6\);/u);
});

test('C168 (4): on a phone the 1/2 tiles stand two in a row, sizes 1 and 2 take the row', () => {
  const sheet = read('src/smart/tile-metric/scss/_smart__tile-metric.scss');
  assert.match(sheet, /@media not all and \(min-width: map\.get\(bp\.\$breakpoint-array, sm\)\) \{\n\s*\.sf-tile-metric-grid \{\n\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
  assert.match(sheet, /\.sf-tile-metric-grid > sf-tile-metric:not\(\[size="1\/2"\]\) > \.sf-tile-metric \{\n\s*grid-column: 1 \/ -1;/u);
  assert.match(sheet, /\.sf-tile-metric-grid \{\n\s*display: grid;[^}]*gap: var\(--sf-space-1\);/u, 'the cells keep C105 H6');
  assert.ok(['1.4.0', '1.5.0', '1.5.2'].includes(json('src/smart/tile-metric/component.json').version));
});
