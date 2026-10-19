import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {createHash} from 'node:crypto';
import {FRAME_RUNNER, FRAME_RUNNER_SHA256, allowedModes, checkEffectManifest, effectSchemes, foreignMode, pairIsForeign, resolveTheme} from '../src/core/js/effects.js';

// simai.effect 1.1 (2026-10-19): the manifest gains schemes, pair and
// capabilities, each optional, so every 1.0 manifest stays valid. The live
// schema and SF.Effects.checkEffectManifest must agree on what they take.
const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const schema = json('src/core/contracts/effect.v1.schema.json');
const sample = json('tests/fixtures/effect-sample/effect.json');
const dual = json('tests/fixtures/effect-schemes/effect.json');
const CATALOGUE_URL = 'https://cdn.jsdelivr.net/gh/simai/ui-effects@0123456789abcdef0123456789abcdef01234567/effects/nebula-mesh/effect.json';
const with_ = (fields) => ({...sample, ...fields});

// The schema's own reading of a pair, without a JSON Schema runtime: the same
// patterns the anyOf names.
const schemaTakesPair = (value) => schema.properties.pair.anyOf.some((branch) => typeof value === 'string'
  && new RegExp(branch.pattern, 'u').test(value) && value.length <= (branch.maxLength ?? Infinity));

test('a 1.0 manifest stays valid, and reads as drawing both schemes', () => {
  assert.deepEqual(checkEffectManifest(sample), []);
  assert.deepEqual(effectSchemes(sample), ['dark', 'light']);
  assert.equal(pairIsForeign(sample), false);
  for (const field of ['schemes', 'pair', 'capabilities']) assert.ok(!schema.required.includes(field), `${field} is optional`);
});

test('the 1.1 fields are taken', () => {
  assert.deepEqual(checkEffectManifest(dual), []);
  assert.deepEqual(effectSchemes(dual), ['dark', 'light']);
  for (const fields of [
    {schemes: ['dark']},
    {schemes: ['light', 'dark']},
    {schemes: ['dark'], pair: 'mist-gradient'},
    {schemes: ['light'], pair: CATALOGUE_URL},
    {capabilities: ['windows']},
    {capabilities: []},
  ]) assert.deepEqual(checkEffectManifest(with_(fields)), [], JSON.stringify(fields));
  assert.deepEqual(effectSchemes(with_({schemes: ['light']})), ['light']);
  assert.equal(pairIsForeign(with_({schemes: ['light'], pair: CATALOGUE_URL})), true);
  assert.equal(pairIsForeign(with_({schemes: ['dark'], pair: 'mist-gradient'})), false);
});

test('invalid schemes, pairs and capabilities are refused', () => {
  for (const [fields, problem] of [
    [{schemes: []}, /schemes/u],
    [{schemes: ['dark', 'dark']}, /schemes/u],
    [{schemes: ['grey']}, /schemes/u],
    [{schemes: ['dark', 'light', 'dark']}, /schemes/u],
    [{schemes: 'dark'}, /schemes/u],
    [{pair: 'mist-gradient'}, /single-scheme/u],
    [{schemes: ['dark', 'light'], pair: 'mist-gradient'}, /single-scheme/u],
    [{schemes: ['dark'], pair: 'Mist'}, /pair/u],
    [{schemes: ['dark'], pair: 'http://example.com/effect.json'}, /pair/u],
    [{schemes: ['dark'], pair: 'https://example.com/effects/x/'}, /pair/u],
    [{schemes: ['dark'], pair: 'https://example.com/effect.json?v=1'}, /pair/u],
    [{schemes: ['dark'], pair: {id: 'mist-gradient'}}, /pair/u],
    [{capabilities: ['portal']}, /capabilities/u],
    [{capabilities: ['windows', 'windows']}, /capabilities/u],
  ]) assert.match(checkEffectManifest(with_(fields)).join(), problem, JSON.stringify(fields));
});

test('the live schema states the same fields as the reader', () => {
  assert.equal(schema['x-simai-version'], '1.2.0');
  assert.deepEqual(schema.properties.schemes.items.enum, ['dark', 'light']);
  assert.equal(schema.properties.schemes.minItems, 1);
  assert.equal(schema.properties.schemes.maxItems, 2);
  assert.equal(schema.properties.schemes.uniqueItems, true);
  assert.deepEqual(schema.properties.capabilities.items.enum, ['windows']);
  assert.deepEqual(schema.dependentSchemas.pair, {required: ['schemes'], properties: {schemes: {maxItems: 1}}});
  // The pair's trust is part of its definition, not only of the standard.
  assert.match(schema.properties.pair.description, /same trust/u);
  assert.match(schema.properties.pair.description, /sandbox/u);
  for (const value of ['mist-gradient', CATALOGUE_URL]) assert.ok(schemaTakesPair(value), value);
  for (const value of ['Mist', 'http://example.com/effect.json', 'https://example.com/effects/x/', 'https://example.com/effect.json?v=1']) {
    assert.ok(!schemaTakesPair(value), value);
    assert.match(checkEffectManifest(with_({schemes: ['dark'], pair: value})).join(), /pair/u, value);
  }
});

// The theme policy is pure: what an editor may offer and what a placement
// draws follow from the manifest, the page's scheme and the mode alone
// (theme-follows-the-placement). The browser probe effect-theme holds the
// same order on the built core, mounted.
test('the theme policy: allowed modes and the resolution order', () => {
  const dark = with_({schemes: ['dark']});
  const light = with_({schemes: ['light']});
  const paired = with_({schemes: ['dark'], pair: 'mist-gradient'});
  const foreign = with_({schemes: ['dark'], pair: CATALOGUE_URL});
  assert.deepEqual(allowedModes(sample), ['auto', 'dark', 'light']);
  assert.deepEqual(allowedModes(dark), ['auto', 'dark']);
  assert.deepEqual(allowedModes(light), ['auto', 'light']);
  assert.deepEqual(allowedModes(paired), ['auto', 'dark', 'light']);
  // A foreign pair is drawn in the sandbox by default; refused, it adds nothing.
  assert.deepEqual(allowedModes(foreign), ['auto', 'dark', 'light']);
  assert.deepEqual(allowedModes(foreign, {foreign: 'refuse'}), ['auto', 'dark']);
  const r = (manifest, pageScheme, themeMode) => resolveTheme(manifest, {pageScheme, themeMode});
  assert.deepEqual(r(sample, 'light', 'auto'), {effect: 'self', scheme: 'light'});
  assert.deepEqual(r(paired, 'light', 'auto'), {effect: 'pair', scheme: 'light', pair: 'mist-gradient'});
  assert.deepEqual(r(dark, 'light', 'auto'), {effect: 'self', scheme: 'dark'});
  assert.deepEqual(r(light, 'dark', 'auto'), {hidden: true, reason: 'light-only-on-dark'});
  assert.deepEqual(r(dark, 'dark', 'light'), {hidden: true, reason: 'mode-not-drawable'});
  assert.deepEqual(r(foreign, 'light', 'auto'), {effect: 'pair', scheme: 'light', pair: CATALOGUE_URL, sandboxed: true});
  assert.deepEqual(resolveTheme(foreign, {pageScheme: 'light', themeMode: 'auto', foreign: 'refuse'}), {hidden: true, reason: 'foreign-pair-needs-sandbox'});
  assert.deepEqual(r(foreign, 'dark', 'auto'), {effect: 'self', scheme: 'dark'});
  assert.deepEqual(r(sample, 'light', 'sepia'), {hidden: true, reason: 'unknown-theme-mode'});
});

// foreign-effects-sandboxed: the switch fails closed, and the frame's policy
// admits its runner by the hash of the very text the frame is given.
test('the sandbox switch and the runner the frame policy admits', () => {
  assert.equal(foreignMode(undefined), 'sandbox');
  assert.equal(foreignMode('sandbox'), 'sandbox');
  assert.equal(foreignMode('refuse'), 'refuse');
  for (const value of ['inline', 'Sandbox', true, 1, null]) assert.equal(foreignMode(value), 'refuse', String(value));
  assert.equal(createHash('sha256').update(FRAME_RUNNER, 'utf8').digest('base64'), FRAME_RUNNER_SHA256);
  assert.doesNotMatch(FRAME_RUNNER, /<\/script/iu);
});
