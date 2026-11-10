import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-tile-metric, sf-list-attention and sf-progress-run (2026-11-07), the
// general components the Larena admin screens asked for (Federation bus
// msg-993e1e39 items 1, 2, 6), and sf-progress-bar 1.2.0's thresholds (item
// 9): what their sources promise, held without a browser. The behaviour is
// probed on the built bytes by each probe.json (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const code = (path) => read(path).split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');

test('the three names are registered to the Framework, family tile with them, and loaded by the rule bundle', () => {
  assert.ok(framework.families.includes('tile'));
  for (const name of ['tile-metric', 'list-attention', 'progress-run']) {
    assert.ok(framework.names.some(({element}) => element === `sf-${name}`), name);
    assert.match(read('src/core/js/rule.src.js'), new RegExp(`import '\\.\\./\\.\\./smart/${name}/rule\\.js';`, 'u'));
    const en = json(`src/smart/${name}/lang/en.json`);
    const ru = json(`src/smart/${name}/lang/ru.json`);
    assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort(), name);
  }
});

test('sf-progress-bar 1.2.0: warning-at and error-at, the more serious of status and the threshold', () => {
  const manifest = json('src/smart/progress-bar/component.json');
  assert.equal(manifest.version, '1.2.1');
  for (const name of ['warning-at', 'error-at']) {
    assert.equal(manifest.settings[name].type, 'number');
    assert.equal(manifest.settings[name].optional, true);
  }
  assert.deepEqual(manifest['host-states'], {'data-status': 'string'});
  const source = code('src/smart/progress-bar/index.js');
  assert.match(source, /if \(Number\.isFinite\(errorAt\) && number >= errorAt\) return 'error';/u);
  assert.match(source, /if \(Number\.isFinite\(warningAt\) && number >= warningAt\) return 'warning';/u);
  assert.match(source, /return \(RANK\[reached\] \?\? 0\) > \(RANK\[status\] \?\? 0\) \? reached : status;/u);
  // An unset threshold is no threshold (an unset number reads 0).
  assert.match(source, /if \(!this\.hasAttribute\(attribute\)\) return null;/u);
});

test('sf-tile-metric: sf-chart-metric 0.1.0\'s setting names, one target, thresholds of max', () => {
  const manifest = json('src/smart/tile-metric/component.json');
  assert.equal(manifest.family, 'tile');
  for (const name of ['label', 'value', 'format', 'previous', 'delta', 'delta-format', 'period-text', 'better', 'max', 'limit-text', 'status', 'hint', 'href', 'openable', 'size']) {
    assert.ok(manifest.settings[name], name);
  }
  assert.deepEqual(Object.keys(manifest.events), ['open']);
  assert.ok(manifest.slots.chart);
  const template = code('src/smart/tile-metric/js/templates/default.js');
  // Nothing interactive inside a link or button tile.
  assert.doesNotMatch(template, /<sf-button|<a [^>]*href=\$\{[^}]*\}[^>]*>[^`]*<a /u);
  assert.match(template, /role="meter"/u);
  const source = code('src/smart/tile-metric/index.js');
  assert.match(source, /const tone = direction === 'flat' \|\| better === 'none' \? 'neutral' : direction === better \? 'positive' : 'negative';/u);
  assert.doesNotMatch(source, /fetch\(|setInterval|localStorage/u);
});

test('sf-list-attention: ordered by severity, nothing when empty, navigate and apply', () => {
  const manifest = json('src/smart/list-attention/component.json');
  assert.equal(manifest.family, 'list');
  assert.deepEqual(manifest.settings.items.schema.items.required, ['id', 'status', 'title']);
  assert.deepEqual(manifest.settings.empty.values, ['none', 'line']);
  // Owner decision C37 (1.2.0): the quiet line and the card by default,
  // triage requests with undo, recheck and all («Все проблемы»; «more» is
  // the «⋯» button's own name).
  assert.equal(manifest.settings.empty.default, 'line');
  assert.equal(manifest.settings.frame.default, 'card');
  assert.equal(manifest.settings.limit.default, 5);
  assert.deepEqual(Object.keys(manifest.events), ['navigate', 'apply', 'snooze', 'dismiss', 'undo', 'recheck', 'all']);
  assert.equal(manifest.events.navigate.cancelable, true);
  for (const verb of ['snooze', 'dismiss', 'all']) assert.equal(manifest.events[verb].cancelable, true, verb);
  for (const name of ['view', 'started']) assert.ok(!(name in manifest.settings), `${name} is the core's own name`);
  const source = code('src/smart/list-attention/index.js');
  assert.match(source, /const RANK = \{error: 0, warning: 1, info: 2, success: 3\};/u);
  assert.match(source, /\(RANK\[a\.status\] - RANK\[b\.status\]\) \|\| age\(a, b\) \|\| \(a\.order - b\.order\)/u);
  // «Не напоминать» only where the page gives the permission (the host's
  // dismissible); an item's flag may take it away, never grant it.
  const body = source.match(/canDismiss\(item\) \{\n\s*(return [^\n]+)\n\s*\}/u);
  assert.ok(body, 'canDismiss is one return');
  const canDismiss = (host, item) => new Function('item', body[1]).call(host, item);
  for (const [host, flag, may] of [
    [false, null, false], [false, true, false], [false, false, false],
    [true, null, true], [true, true, true], [true, false, false],
  ]) {
    assert.equal(canDismiss({dismissible: host}, {dismissible: flag}), may, `host ${host}, item ${flag}`);
  }
  // size is deprecated (C22: the density is the page's), noted with a date.
  assert.match(source, /noteDeprecated\(\{component: 'sf-list-attention', kind: 'attribute', from: 'size', to: 'data-sf-density'/u);
  assert.match(manifest.settings.size.summary, /^Deprecated until 2027-01-01/u);
  // «Подробнее о проверке» asks navigate like the other links.
  assert.match(source, /part === 'help' \? item\.help/u);
  assert.match(code('src/smart/list-attention/js/templates/default.js'), /appearance="outline" scheme="on-surface"/u);
  const sheet = read('src/smart/list-attention/scss/_smart__list-attention.scss');
  // The host is display: contents; with no items the template draws nothing.
  assert.doesNotMatch(sheet, /sf-list-attention\[data-empty\]/u);
  assert.match(code('src/smart/list-attention/js/templates/default.js'), /if \(empty !== 'line'\) return nothing;/u);
  // A narrow row puts the action under the text.
  assert.match(sheet, /@container \(max-width: 30rem\)/u);
});

test('sf-progress-run: host-driven, its run-state, chunk, step and clear, and the reading position', () => {
  const manifest = json('src/smart/progress-run/component.json');
  assert.equal(manifest.family, 'progress');
  assert.deepEqual(manifest.settings['run-state'].values, ['auto', 'running', 'done', 'failed', 'cancelled']);
  assert.ok(!('state' in manifest.settings), 'state is the element base\'s own name');
  assert.deepEqual(Object.keys(manifest.actions), ['chunk', 'clear', 'step']);
  assert.deepEqual(Object.keys(manifest.events), ['cancel', 'retry', 'close', 'download', 'toggle']);
  const source = code('src/smart/progress-run/index.js');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|EventSource|WebSocket/u, 'it polls nothing');
  assert.match(source, /readingPosition/u);
  assert.match(source, /this\._follow = !this\.outputOpen \|\| this\._reading\.atEnd\(\);/u);
  const template = code('src/smart/progress-run/js/templates/default.js');
  assert.match(template, /role="status"/u);
  assert.match(template, /role="log" aria-live="off"/u);
  // The output is text, never markup.
  assert.doesNotMatch(template, /unsafeHTML/u);
});
