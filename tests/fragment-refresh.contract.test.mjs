import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  CONTRACT, CONTRACT_HEADER, HEADER, MODE_HEADER, changedKeys, dataAnswerProblems, headerProblems,
  keyMap, linkSets, ownedChange, readBlock, syncedHref, withKeys,
} from '../src/core/js/fragment-refresh.js';
import {checkFragmentDescriptor, checkRefreshPage} from '../src/core/js/composition/fragments.mjs';
import {isRunnableScript} from '../src/core/js/page-assets.js';

// Block refresh (simai.interface-fragment 1.1.0, refreshable-block and
// block-refresh; Larena handoff ho-34086ca2988b, contract 1 agreed 2026-11-23):
// what the runtime decides without a page -- the declaration, the key map,
// which control is a block's, the address it writes, and whether an answer
// holds. The browser half is tests/browser/fragment-refresh.browser.mjs.

const root = new URL('../', import.meta.url);
const json = (relative) => JSON.parse(readFileSync(new URL(relative, root), 'utf8'));

const element = (attributes) => ({
  getAttribute: (name) => (name in attributes ? attributes[name] : null),
  hasAttribute: (name) => name in attributes,
});
const CHART = {
  'data-sf-fragment': 'env.load-history',
  'data-sf-fragment-keys': 'period scale',
  'data-sf-fragment-mode': 'data',
  'data-sf-fragment-contract': '1',
};

test('the wire names are the agreed ones', () => {
  assert.equal(CONTRACT, 1);
  assert.equal(HEADER, 'X-SIMAI-Fragment');
  assert.equal(MODE_HEADER, 'X-SIMAI-Fragment-Mode');
  assert.equal(CONTRACT_HEADER, 'X-SIMAI-Fragment-Contract');
});

test('a block is read from its attributes, and each broken part is named', () => {
  const block = readBlock(element(CHART));
  assert.deepEqual(block, {id: 'env.load-history', keys: ['period', 'scale'], reads: [], mode: 'data', contract: 1, port: null, problems: []});
  assert.deepEqual(readBlock(element({...CHART, 'data-sf-fragment-port': 'larena.env-history@1'})).port, {standard: 'larena.env-history', major: 1});
  const broken = (patch) => readBlock(element({...CHART, ...patch})).problems.join();
  assert.match(broken({'data-sf-fragment': 'Env'}), /id/u);
  assert.match(broken({'data-sf-fragment-keys': 'period period'}), /keys/u);
  assert.match(broken({'data-sf-fragment-reads': 'period'}), /reads/u, 'a block never reads its own key');
  assert.match(broken({'data-sf-fragment-mode': 'json'}), /mode/u);
  assert.match(broken({'data-sf-fragment-contract': '2'}), /contract/u);
  assert.match(broken({'data-sf-fragment-port': 'larena.env-history'}), /port/u);
  assert.equal(readBlock(element({...CHART, 'data-sf-fragment-contract': undefined})).contract, CONTRACT);
});

test('one owner per key: a key or an id declared twice makes every declaring block plain', () => {
  const a = {element: 'a', ...readBlock(element(CHART))};
  const b = {element: 'b', ...readBlock(element({...CHART, 'data-sf-fragment': 'env.events', 'data-sf-fragment-keys': 'events_page'}))};
  const clean = keyMap([a, b]);
  assert.deepEqual([...clean.owners.keys()], ['period', 'scale', 'events_page']);
  assert.equal(clean.plain.size, 0);
  const c = {element: 'c', ...readBlock(element({...CHART, 'data-sf-fragment': 'env.other', 'data-sf-fragment-keys': 'scale'}))};
  const clash = keyMap([a, b, c]);
  assert.ok(clash.plain.has(a) && clash.plain.has(c) && !clash.plain.has(b));
  assert.deepEqual(clash.conflicts, [{kind: 'key', name: 'scale', ids: ['env.load-history', 'env.other']}]);
  assert.ok(!clash.owners.has('period'), 'a plain block owns nothing');
  assert.equal(clash.owners.get('events_page'), b);
  const twin = {element: 'd', ...readBlock(element({...CHART, 'data-sf-fragment-keys': 'q'}))};
  const twice = keyMap([a, twin]);
  assert.ok(twice.plain.has(a) && twice.plain.has(twin));
  assert.equal(twice.conflicts[0].kind, 'id');
});

test('a control is the block\'s only when it changes the block\'s own keys on the same page', () => {
  const here = 'https://site.test/admin/env/panel?site=s1&period=24h&scale=linear#env-charts';
  const keys = ['period', 'scale'];
  assert.ok(ownedChange('?site=s1&period=7d&scale=linear#env-charts', here, keys));
  assert.ok(ownedChange('?scale=log&site=s1&period=24h', here, keys), 'order and hash aside');
  assert.ok(ownedChange(here, here, keys), 'the current address is a refresh of the same keys');
  assert.ok(!ownedChange('?site=s2&period=7d&scale=linear', here, keys), 'another key is the page\'s');
  assert.ok(!ownedChange('/admin/env/other?site=s1&period=7d&scale=linear', here, keys), 'another path');
  assert.ok(!ownedChange('https://other.test/admin/env/panel?site=s1&period=7d&scale=linear', here, keys), 'another origin');
  assert.ok(!ownedChange('?period=7d&scale=linear', here, keys), 'dropping a page key is a change of it');
  const stale = '?site=s1&period=7d&scale=linear&events_page=1';
  assert.ok(!ownedChange(stale, `${here.split('#')[0]}&events_page=2`, keys), 'another block\'s key is not this block\'s alone');
  assert.ok(ownedChange(stale, `${here.split('#')[0]}&events_page=2`, keys, ['events_page']), 'a stale value of another block\'s key is not a change of it');
  assert.equal(withKeys(`${here.split('#')[0]}&events_page=2`, stale, keys), 'https://site.test/admin/env/panel?site=s1&events_page=2&period=7d&scale=linear', 'the page keeps the other block\'s value');
  assert.deepEqual(changedKeys(here, 'https://site.test/admin/env/panel?site=s1&period=7d&scale=log'), ['period', 'scale']);
  assert.deepEqual(changedKeys('https://x.test/?a=1&a=2', 'https://x.test/?a=2&a=1'), ['a'], 'a repeated key keeps its order');
});

test('the address written takes only the block\'s keys from the answer and keeps the rest', () => {
  const here = 'https://site.test/admin/env/panel?site=s1&period=24h&scale=linear#env-charts';
  assert.equal(withKeys(here, '/admin/env/panel?period=7d&scale=linear&site=evil', ['period', 'scale']),
    'https://site.test/admin/env/panel?site=s1&period=7d&scale=linear#env-charts');
  assert.equal(withKeys(here, '/admin/env/panel?period=7d', ['period', 'scale']),
    'https://site.test/admin/env/panel?site=s1&period=7d#env-charts', 'a key the host did not apply leaves the address');
});

const response = (status, headers, redirected = false) => ({
  status, redirected,
  headers: {get: (name) => headers[name.toLowerCase()] ?? null},
});
const OK = {'x-simai-fragment': 'env.load-history', 'x-simai-fragment-contract': '1', 'content-type': 'application/json; charset=utf-8'};

test('an answer is confirmed by its status, its headers and its type', () => {
  const block = readBlock(element(CHART));
  assert.deepEqual(headerProblems(response(200, OK), block, 'data'), []);
  assert.match(headerProblems(response(200, OK, true), block, 'data').join(), /redirected/u);
  assert.match(headerProblems(response(403, OK), block, 'data').join(), /status 403/u);
  assert.match(headerProblems(response(200, {...OK, 'x-simai-fragment': 'env.other'}), block, 'data').join(), /fragment-header/u);
  assert.match(headerProblems(response(200, {...OK, 'x-simai-fragment': undefined}), block, 'data').join(), /fragment-header/u);
  assert.match(headerProblems(response(200, {...OK, 'x-simai-fragment-contract': '2'}), block, 'data').join(), /contract-header/u);
  assert.match(headerProblems(response(200, {...OK, 'content-type': 'text/html'}), block, 'data').join(), /content-type/u);
  assert.deepEqual(headerProblems(response(200, {...OK, 'content-type': 'text/html; charset=utf-8'}), block, 'html'), []);
});

test('a data answer holds only what the block declared', () => {
  const block = readBlock(element({...CHART, 'data-sf-fragment-port': 'larena.env-history@1'}));
  const answer = {
    fragment: 'env.load-history', contract: 1, port: {standard: 'larena.env-history', version: '1.2.0'}, state: 'populated',
    url: '/admin/env/panel?period=7d&scale=linear', keys: {period: '7d', scale: 'linear'},
    parts: {network: {items: [], 'data-state': 'empty'}}, controls: {period: '7d'},
  };
  const options = {parts: ['network', 'disk'], known: (part, field) => ['items', 'names'].includes(field) || field.startsWith('data-'), origin: 'https://site.test', path: '/admin/env/panel'};
  assert.deepEqual(dataAnswerProblems(answer, block, options), []);
  const broken = (patch) => dataAnswerProblems({...answer, ...patch}, block, options).join();
  assert.match(broken({fragment: 'env.other'}), /fragment/u);
  assert.match(broken({contract: 2}), /contract/u);
  assert.match(broken({port: {standard: 'larena.env-history', version: '2.0.0'}}), /major/u);
  assert.match(broken({port: {standard: 'larena.other', version: '1.0.0'}}), /another standard/u);
  assert.match(broken({port: undefined}), /expects one/u);
  for (const state of ['populated', 'empty', 'no-access']) assert.deepEqual(dataAnswerProblems({...answer, state}, block, options), [], state);
  assert.match(broken({state: 'error'}), /state/u, 'error and loading are the client\'s');
  assert.match(broken({url: '/admin/other?period=7d'}), /another page/u);
  assert.match(broken({url: 'https://other.test/admin/env/panel'}), /another page/u);
  assert.match(broken({keys: {site: 's2'}}), /keys/u);
  assert.match(broken({controls: {site: 's2'}}), /controls/u);
  assert.match(broken({parts: {cpu: {items: []}}}), /parts\.cpu: not in the block/u);
  assert.match(broken({parts: {network: {innerHTML: '<b>'}}}), /not an input/u);
  assert.match(broken({html: '<p>'}), /html: undeclared/u);
  assert.match(dataAnswerProblems([], block, options).join(), /not an object/u);
});

test('a data island stays in markup; only a runnable script is an asset', () => {
  const script = (type) => element(type === null ? {} : {type});
  assert.ok(isRunnableScript(script(null)));
  assert.ok(isRunnableScript(script('module')));
  assert.ok(isRunnableScript(script('text/javascript')));
  assert.ok(!isRunnableScript(script('application/json')));
});

const DESCRIPTOR = {
  schema: 'simai.interface-fragment', schema_version: 1, id: 'env.load-history', element: 'sf-chart-line', regions: ['content'],
  port: {standard: 'larena.env-history', version: '1.0.0'}, outputs: {}, inputs: {}, operation: 'env.server.read',
  url_state: ['period', 'scale'], budget: {kb: 0, first_answer_ms: 300},
};

test('a descriptor declares its refresh (descriptor 1.3.0), optional and closed', () => {
  assert.deepEqual(checkFragmentDescriptor(DESCRIPTOR), [], 'a fragment that does not refresh is valid unchanged');
  const refresh = {mode: 'data', contract: 1, reads: ['site', 'from', 'to'], parts: ['network', 'disk']};
  assert.deepEqual(checkFragmentDescriptor({...DESCRIPTOR, refresh}), []);
  const broken = (patch) => checkFragmentDescriptor({...DESCRIPTOR, refresh: {...refresh, ...patch}}).join();
  assert.match(broken({mode: 'json'}), /refresh\.mode/u);
  assert.match(broken({contract: 2}), /refresh\.contract/u);
  assert.match(broken({reads: ['period']}), /refresh\.reads/u, 'its own key is url_state, not reads');
  assert.match(broken({parts: ['Network']}), /refresh\.parts/u);
  assert.match(broken({mode: 'html'}), /a data block only/u);
  assert.match(broken({timer: 30}), /refresh:/u, 'contract 1 has no timer refresh');
  const schema = json('src/core/contracts/interface-fragment.v1.schema.json');
  // 1.3.0 brought refresh; 1.4.0 (GB20) only adds parameters-changed to the value types.
  assert.equal(schema['x-simai-version'], '1.4.0');
  assert.deepEqual(Object.keys(schema.properties.refresh.properties), ['mode', 'contract', 'reads', 'parts']);
});

test('a page of blocks is checked together: unique ids, one owner per key, every key read is owned', () => {
  const filter = {...DESCRIPTOR, id: 'stats.filter', url_state: ['site', 'from', 'to'], refresh: {mode: 'html', contract: 1}};
  const chart = {...DESCRIPTOR, refresh: {mode: 'data', contract: 1, reads: ['site', 'from', 'to']}};
  assert.deepEqual(checkRefreshPage([filter, chart]), []);
  assert.match(checkRefreshPage([filter, chart, {...chart, id: 'stats.other', url_state: ['scale']}]).join(), /scale: owned by env\.load-history and stats\.other/u);
  assert.match(checkRefreshPage([filter, chart, chart]).join(), /id twice/u);
  assert.match(checkRefreshPage([chart]).join(), /reads site, which no block owns/u);
});

test('the standard is 1.1.1 over the frozen 1.4.0 copy, with the agreed clauses', () => {
  const standard = json('contracts/standards/simai.interface-fragment/1.1.1/standard.json');
  const ids = standard.requirements.map((requirement) => requirement.id);
  assert.ok(ids.includes('refreshable-block') && ids.includes('block-refresh'));
  const text = (id) => standard.requirements.find((requirement) => requirement.id === id).text;
  assert.match(text('fragment-is-a-composite'), /refreshable block/u, 'the server-block clause');
  assert.match(text('region-navigation'), /product's own marker/u, 'a product\'s own history entries are left alone');
  assert.match(text('five-states'), /no-access/u);
  assert.match(text('block-refresh'), /no timer refresh/u);
  assert.equal(standard.uses[0].path, '../../pinned/interface-fragment-1.4.0.schema.json');
  // 1.1.1 is 1.1.0 with the pin moved (parameters-changed a closed value type, GB20): no requirement changed.
  assert.deepEqual(standard.requirements, json('contracts/standards/history/simai.interface-fragment/1.1.0/standard.json').requirements);
  const previous = json('contracts/standards/history/simai.interface-fragment/1.0.3/standard.json');
  for (const requirement of previous.requirements) assert.ok(ids.includes(requirement.id), `${requirement.id} is kept`);
});

test('a data block keeps its links current: each link sets its own keys, the others follow the answer', () => {
  const keys = ['period', 'scale'];
  const periods = ['?site=s1&period=24h&scale=linear', '?site=s1&period=7d&scale=linear', '?site=s1&period=30d&scale=linear'];
  const scales = ['?site=s1&period=24h&scale=linear', '?site=s1&period=24h&scale=log'];
  assert.deepEqual(linkSets(keys, periods[1], periods), ['period'], 'the period group differs in period');
  assert.deepEqual(linkSets(keys, scales[1], scales), ['scale']);
  assert.deepEqual(linkSets(keys, periods[1], [periods[1]]), ['period', 'scale'], 'a link alone sets what it names');
  assert.deepEqual(linkSets(keys, periods[1], periods, ['scale', 'site']), ['scale'], 'data-sf-fragment-sets names them, own keys only');
  const applied = new URLSearchParams('site=s1&period=7d&scale=linear');
  assert.equal(syncedHref(scales[1], keys, ['scale'], applied), '?site=s1&period=7d&scale=log', 'the scale link keeps the period just chosen');
  assert.equal(syncedHref('?period=24h&scale=log#env-charts', keys, ['period'], applied), '?period=24h&scale=linear#env-charts');
  assert.equal(syncedHref('?period=24h&scale=log', keys, ['period'], new URLSearchParams('period=7d')), '?period=24h&scale=log', 'a key the address does not name keeps the link\'s value');
  assert.equal(syncedHref('?site=s9&period=24h', keys, ['period'], applied), '?site=s9&period=24h', 'a page key is never touched');
});
