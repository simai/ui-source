import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {createHash} from 'node:crypto';
import {FRAME_RUNNER, FRAME_RUNNER_SHA256, aboutEnabled, aboutEntries, aboutLink, allowedModes, checkEffectManifest, effectSchemes, effectSettings, foreignMode, pairIsForeign, resolveTheme} from '../src/core/js/effects.js';

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
  assert.equal(schema['x-simai-version'], '1.4.0');
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

// simai.effect 1.3 (2026-11-01): a setting shown and read only while another
// holds one of the values its when lists. The kit reads the manifest through
// checkEffectManifest, so what is refused here is refused by the kit too.
const label = {en: 'x'};
const conditional = with_({settings: [
  ...sample.settings,
  {key: 'trail', type: 'boolean', label, default: false},
  {key: 'trailLength', type: 'integer', label, default: 8, min: 1, max: 40, when: {key: 'trail', is: [true]}},
  {key: 'corner', type: 'integer', label, default: 2, min: 0, max: 8, when: {key: 'shape', is: ['square']}},
  {key: 'cornerTint', type: 'color', label, default: '#ff0000', when: {key: 'corner', is: [4, 8]}},
]});

test('a conditional setting is taken, and the live schema states when', () => {
  assert.deepEqual(checkEffectManifest(conditional), []);
  const when = schema.$defs.setting.properties.when;
  assert.deepEqual(when.required, ['key', 'is']);
  assert.equal(when.additionalProperties, false);
  assert.equal(when.properties.key.pattern, schema.$defs.setting.properties.key.pattern);
  assert.equal(when.properties.is.minItems, 1);
  assert.ok(!schema.$defs.setting.required.includes('when'), 'when is optional');
});

test('a setting whose condition is false is not read: no value, no default, not named as dropped', () => {
  const read = (stored) => effectSettings(conditional, stored);
  // At the defaults: no trail, round dots -- none of the three conditional settings is read.
  assert.deepEqual(Object.keys(read({}).settings), ['count', 'speed', 'color', 'shape', 'trail']);
  // A stored value for a setting that is not read is ignored, valid or not.
  assert.deepEqual(read({trailLength: 12, corner: 99}), {settings: read({}).settings, invalid: []});
  // The condition holds: the stored value, or the default where it is missing or invalid.
  assert.equal(read({trail: true, trailLength: 12}).settings.trailLength, 12);
  assert.equal(read({trail: '1'}).settings.trailLength, 8);
  assert.deepEqual(read({trail: true, trailLength: 99}).invalid, ['trailLength']);
  // A chain: cornerTint needs corner at 4 or 8, and corner needs square dots.
  assert.equal(read({shape: 'square'}).settings.corner, 2);
  assert.ok(!('cornerTint' in read({shape: 'square'}).settings));
  assert.equal(read({shape: 'square', corner: 4}).settings.cornerTint, '#ff0000');
  assert.ok(!('cornerTint' in read({shape: 'round', corner: 4}).settings), 'a setting that is not read cannot open another');
});

test('a when that names no setting, the setting itself, a value it cannot hold or a loop is refused', () => {
  const setting = (when, extra = []) => with_({settings: [...sample.settings, ...extra,
    {key: 'trail', type: 'boolean', label, default: false}, {key: 'size', type: 'integer', label, default: 2, min: 1, max: 9, when}]});
  for (const [manifest, problem] of [
    [setting({key: 'missing', is: ['x']}), /key names no setting/u],
    [setting({key: 'size', is: [2]}), /names the setting itself/u],
    [setting({key: 'shape', is: ['triangle']}), /"triangle" is not an option of shape/u],
    [setting({key: 'shape', is: ['round', 'hexagon']}), /"hexagon" is not an option of shape/u],
    [setting({key: 'trail', is: ['yes']}), /"yes" is not a valid value of trail/u],
    [setting({key: 'count', is: [1000]}), /1000 is not a valid value of count/u],
    [setting({key: 'shape', is: []}), /is lists one value or more/u],
    [setting({key: 'shape'}), /is lists one value or more/u],
    [setting({key: 'shape', is: ['round'], not: true}), /\{key, is\} and nothing else/u],
    [setting('shape'), /\{key, is\} and nothing else/u],
    [setting({key: 'depth', is: [1]}, [{key: 'depth', type: 'integer', label, default: 1, min: 1, max: 3, when: {key: 'size', is: [2]}}]),
      /loop/u],
  ]) assert.match(checkEffectManifest(manifest).join(), problem, JSON.stringify(manifest.settings.at(-1).when));
  // Choices compare their options as stored values compare: an integer option
  // matches its number.
  const numbered = with_({settings: [
    {key: 'level', type: 'choice', label, default: 1, options: [{value: 1, label}, {value: 2, label}]},
    {key: 'glow', type: 'boolean', label, default: true, when: {key: 'level', is: [2]}},
  ]});
  assert.deepEqual(checkEffectManifest(numbered), []);
  assert.ok(!('glow' in effectSettings(numbered, {}).settings));
  assert.equal(effectSettings(numbered, {level: '2'}).settings.glow, true);
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
  // simai.effect 1.2: a light-only effect stays light on a dark page.
  assert.deepEqual(r(light, 'dark', 'auto'), {effect: 'self', scheme: 'light'});
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

// simai.effect 1.4 (2026-11-02): the optional homepage, and the about menu a
// placement opens on a right-click over the effect's background.
test('homepage is an optional http or https address', () => {
  assert.ok(!schema.required.includes('homepage'));
  const pattern = new RegExp(schema.properties.homepage.pattern, 'u');
  for (const value of ['https://example.com/effects/bands/', 'http://example.com']) {
    assert.deepEqual(checkEffectManifest(with_({homepage: value})), [], value);
    assert.ok(pattern.test(value), value);
  }
  for (const value of ['javascript:alert(1)', 'data:text/html,x', '/effects/bands/', 'ftp://example.com/', 'https://user:pass@example.com/', 'https://exa mple.com/', 42, '']) {
    assert.match(checkEffectManifest(with_({homepage: value})).join(), /homepage/u, String(value));
  }
});

test('the about menu names the effect, its author, its page and its motion', () => {
  const manifest = with_({id: 'star-flight', version: '1.1.0', label: {ru: 'Звёздный полёт', en: 'Star flight'}, author: 'SIMAI'});
  assert.deepEqual(aboutEntries(manifest, {listed: true}), [
    {type: 'heading', text: 'Star flight 1.1.0'},
    {type: 'note', text: 'By SIMAI'},
    {type: 'separator'},
    {id: 'sf-effect-link', text: 'Open in SIMAI Effects', icon: 'open_in_new', href: 'https://effects.simai.io/effect/star-flight/'},
    {id: 'sf-effect-motion', text: 'Pause motion', icon: 'pause'},
  ]);
  assert.deepEqual(aboutEntries(manifest, {listed: true, paused: true}).at(-1), {id: 'sf-effect-motion', text: 'Resume motion', icon: 'play_arrow'});
  // Not in SIMAI's catalogue: no link, unless the manifest names a homepage.
  assert.equal(aboutLink(manifest), null);
  assert.equal(aboutEntries(manifest).some((entry) => entry.id === 'sf-effect-link'), false);
  assert.deepEqual(aboutLink({...manifest, homepage: 'https://example.com/fx'}), {kind: 'homepage', href: 'https://example.com/fx'});
  assert.equal(aboutEntries({...manifest, homepage: 'https://example.com/fx'}).find((entry) => entry.id === 'sf-effect-link').text, 'Open homepage');
  assert.equal(aboutLink({...manifest, homepage: 'javascript:alert(1)'}), null);
  // No English label: the first one; no author: no line for it.
  const bare = aboutEntries({...manifest, label: {ru: 'Полёт'}, author: undefined});
  assert.equal(bare[0].text, 'Полёт 1.1.0');
  assert.equal(bare.some((entry) => entry.type === 'note'), false);
});

test('the about menu is on unless the page turns it off', () => {
  assert.equal(aboutEnabled(undefined), true);
  assert.equal(aboutEnabled(true), true);
  assert.equal(aboutEnabled(false), false);
  assert.equal(aboutEnabled('false'), false);
});
