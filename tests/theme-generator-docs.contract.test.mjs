import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {themeFromColor, themeVariables, THEME_PALETTES, THEME_TONES, DEFAULT_THEME_COLOR} from '../src/core/js/theme-palette.js';

// TG-05 (docs study 2026-11-11): the docs page named the events
// sf-theme-generator-change / -apply while the manifest had change /
// sf-theme-generator-committed, and the component description said 128
// variables where the page said 226 and the code wrote 288. The numbers and
// names the component tells are the ones the code has: this test reads them
// from the calculation and the manifest and holds every description to them.
const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const variables = themeVariables(themeFromColor(DEFAULT_THEME_COLOR));
const total = Object.keys(variables).length;
const tones = THEME_PALETTES.length * THEME_TONES.length;
const steps = total - tones;

test('the theme numbers every description tells are the calculation\'s', () => {
  assert.deepEqual([total, tones, steps], [144, 64, 80]);
  const docs = read('src/smart/theme-generator/docs.md');
  for (const number of [total, tones, steps]) assert.match(docs, new RegExp(`\\b${number}\\b`, 'u'), `docs.md: ${number}`);
  const component = JSON.parse(read('src/smart/theme-generator/component.json'));
  const payloads = Object.values(component['x-registry']['alias-events']).map((event) => event.payload.properties.variables.description);
  assert.ok(payloads.length && payloads.every((text) => text.includes(`${total} custom properties`) && text.includes(`${tones} tones`) && text.includes(`${steps} translucent steps`)), payloads.join(' | '));
  assert.match(component['x-registry'].methods.toCSS.summary, new RegExp(`${tones} primitives and ${steps} translucent steps`, 'u'));
  const api = JSON.parse(read('src/core/contracts/public-js-api.json'));
  const palette = (api.names ?? api.entries ?? api.api ?? Object.values(api).find(Array.isArray)).find((entry) => entry.name === 'SF.ThemePalette');
  assert.match(palette.summary, new RegExp(`the ${tones} --sf-<palette>-<tone> primitives and the ${steps} translucent steps .*${total} variables in all`, 'u'));
  // No description tells a count the code no longer has.
  for (const [path, text] of [['docs.md', docs], ['component.json x-registry', JSON.stringify(component['x-registry'])], ['public-js-api', palette.summary]]) {
    assert.doesNotMatch(text, /\b(?:128|226|288|232)\b/u, path);
  }
});

test('the docs name the events the element sends, and the former names as dated aliases', () => {
  const docs = read('src/smart/theme-generator/docs.md');
  const manifest = JSON.parse(read('src/smart/theme-generator/smart.manifest.json'));
  const canonical = Object.entries(manifest.events).filter(([, event]) => event.canonical).map(([name]) => name).sort();
  const aliases = Object.entries(manifest.events).filter(([, event]) => event.alias_of).map(([name]) => name).sort();
  assert.deepEqual(canonical, ['change', 'sf-theme-generator-committed']);
  assert.deepEqual(aliases, ['sf-theme-apply', 'sf-theme-change', 'sf-theme-generator-apply', 'sf-theme-generator-change']);
  const events = docs.slice(docs.indexOf('События:'), docs.indexOf('В `detail` обоих'));
  for (const name of canonical) assert.ok(events.includes(`\`${name}\``), `docs.md events: ${name}`);
  for (const name of aliases) assert.ok(!events.includes(`\`${name}\``), `docs.md events list names the alias ${name} as an event`);
  const former = docs.slice(docs.indexOf('Прежние имена событий'));
  for (const name of aliases) assert.ok(former.includes(`\`${name}\``), `docs.md former names: ${name}`);
});
