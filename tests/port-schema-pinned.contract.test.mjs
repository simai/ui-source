// Every host port declaration (port.json) is checked against the frozen copy
// of the port declaration form that the live simai.composite-host-port
// standard pins, and that copy equals the live schema (group build 18,
// GB17A-4). Before: the standard 1.0.4 pinned composite-host-port.v1 at 1.0.0
// while the live schema had reached 1.2.0, and 40 of the 51 ports carried
// parts (an intent's per-outcome answer, settings.fields,
// compatibility.deprecated) the closed schema did not declare; nothing
// checked a whole port against the schema, so neither drift was seen.

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {checkPorts, pinnedSchema} from '../scripts/check-port-schemas.mjs';
import {validatePort} from '../scripts/port-schema-kit.mjs';

const root = new URL('../', import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root));
const json = (relative) => JSON.parse(read(relative).toString('utf8'));
const LIVE = 'src/core/contracts/composite-host-port.v1.schema.json';

test('the live host port standard pins a frozen copy equal to the live port schema', () => {
  const {standard, pin, file} = pinnedSchema();
  assert.equal(standard.version, '1.0.5');
  assert.ok(pin.path.includes('/pinned/'), 'a frozen copy, never the live file');
  const live = json(LIVE);
  assert.equal(pin.version, live['x-simai-version'], 'the pin names the version the live schema declares');
  assert.ok(readFileSync(file).equals(read(LIVE)), `${pin.path} equals ${LIVE} byte for byte; refresh means a new frozen copy and a re-issued standard`);
  assert.match(live.title, /^SIMAI /u, 'SIMAI in capitals');
});

test('the earlier frozen copy keeps the bytes the editions in history pin', () => {
  const published = json('contracts/standards/history/simai.composite-host-port/1.0.4/standard.json');
  const pin = published.uses.find(({id}) => id === 'simai.framework.composite-host-port-schema');
  assert.equal(pin.version, '1.0.0');
  const digest = createHash('sha256').update(read('contracts/standards/pinned/composite-host-port.v1.schema.json')).digest('hex');
  assert.equal(digest, pin.sha256);
});

test('every port.json in ui-source passes the pinned port schema', () => {
  const results = checkPorts();
  // A guard that silently checks nothing is worse than no guard.
  assert.ok(results.length >= 51, `only ${results.length} ports were checked`);
  const failed = results.filter(({errors}) => errors.length)
    .map(({file, errors}) => `${file}: ${errors.slice(0, 3).map(({path, message}) => `${path || '/'} ${message}`).join('; ')}`);
  assert.deepEqual(failed, []);
});

test('the port check refuses what the schema does not declare', () => {
  const {schema} = pinnedSchema();
  const base = json('src/core/contracts/ports/simai.document-port/1.0.2/port.json');
  assert.deepEqual(validatePort(schema, base), []);
  const broken = (change) => {
    const value = structuredClone(base);
    change(value);
    return validatePort(schema, value);
  };
  const [name] = Object.keys(base.intents);
  assert.notDeepEqual(broken((value) => { value.extra = true; }), [], 'an undeclared top-level key');
  assert.notDeepEqual(broken((value) => { delete value.intents[name].summary; }), [], 'an intent without its summary');
  assert.notDeepEqual(broken((value) => { value.intents[name].answers = ['done']; }), [], 'an answer outside the four');
  assert.notDeepEqual(broken((value) => { value.intents[name].answer = {applied: {shape: {}}}; }), [], 'an outcome answer without its schema');
  assert.notDeepEqual(broken((value) => { value.settings.fields = {writable_in: '1.0.0'}; }), [], 'settings.fields without its summary');
  assert.notDeepEqual(broken((value) => { value.compatibility.deprecated = {old: {read_until: 'soon', instead: 'new'}}; }), [], 'a deprecation without a date');
  assert.notDeepEqual(broken((value) => { value.schema = 'simai.composite.host-port'; delete value.schema_version; }), [], 'the bare name needs its major');
  assert.deepEqual(broken((value) => { delete value.intents[name].event; }), [], 'an intent raised only through the port names no event (1.2.0)');
  assert.throws(() => validatePort({type: 'object', oneOf: []}, {}), /port_schema_keyword_unsupported:oneOf/u);
});
