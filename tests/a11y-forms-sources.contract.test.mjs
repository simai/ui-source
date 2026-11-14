import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {isKeyEffect} from './support/key-effects.mjs';

// The source half of simai/ui-source#30, #34 and #44. The browser half reads
// the accessibility tree and the drawn renderers on the built bytes:
// tests/browser/field-names-and-panels.browser.mjs and
// tests/browser/field-renderers-gallery.browser.mjs.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('accordion, popover and the colour field carry their docs in the source (#30 item 3)', () => {
  for (const name of ['accordion', 'popover', 'input-color']) {
    const component = json(`src/smart/${name}/component.json`);
    assert.equal(component.docs, 'docs.md', `${name}: component.json names its docs`);
    const docs = existsSync(new URL(`../src/smart/${name}/docs.md`, import.meta.url))
      ? read(`src/smart/${name}/docs.md`)
      : read(`src/smart/${name}/docs/docs.md`);
    assert.match(docs, new RegExp(`<${component.tag}[\\s>]`, 'u'), `${name}: the docs show the element`);
  }
  // The class accordion has its own page too.
  assert.ok(existsSync(new URL('../src/component/accordion/docs/docs.md', import.meta.url)));
  // sf-popover's docs say what the element does: every setting and event.
  const popover = json('src/smart/popover/component.json');
  const docs = read('src/smart/popover/docs.md');
  for (const setting of Object.keys(popover.settings)) assert.match(docs, new RegExp(`\`${setting}\``, 'u'), `popover docs: ${setting}`);
  for (const event of Object.keys(popover.events)) assert.match(docs, new RegExp(`sf-popover-${event}\\b`, 'u'), `popover docs: sf-popover-${event}`);
});

test('sf-switch names its input by the label row and describes it by the description (#44 item 1)', () => {
  // Since C63 W9 the switch reads the binding sf-checkbox and sf-radio read.
  const own = read('src/component/switch/js/_switch.js');
  assert.match(own, /function linkSwitchText\(root\) \{\s*linkCheckableText\(root, SWITCH_TEXT_PARTS\);/u);
  const source = read('src/component/checkable-text-helper.js');
  assert.match(source, /export const SWITCH_TEXT_PARTS = Object\.freeze\(\{[^}]*text: '\.sf-switch-container'/u);
  assert.match(source, /setAttribute\('aria-labelledby', label\.id\)/u);
  assert.match(source, /setAttribute\('aria-describedby'/u);
  // Ids from the instance path, never a counter (#41).
  assert.match(source, /partId\(path, 'label'\)/u);
  assert.doesNotMatch(source.slice(source.indexOf('export function linkCheckableText')), /\+\+/u);
  // The manifest says the same: the name from the label or aria-label.
  const component = json('src/smart/switch/component.json');
  assert.deepEqual(component.accessibility.name.from.slice(0, 2), ['label', 'aria-label']);
});

test('sf-input-textarea forwards the host aria-label and aria-labelledby (#30 item 1)', () => {
  const template = read('src/smart/input-textarea/js/templates/default.js');
  assert.match(template, /aria-label=\$\{accessibleName\}/u);
  assert.match(template, /aria-labelledby=\$\{accessibleLabelledBy\}/u);
  const component = json('src/smart/input-textarea/component.json');
  assert.ok(component.accessibility.name.from.includes('aria-label'));
  assert.ok(component.accessibility.name.from.includes('aria-labelledby'));
});

test('the class accordion hides a closed panel with the attribute from the first paint (#30 item 2)', () => {
  const source = read('src/component/accordion/js/_accordion.js');
  const init = source.slice(source.indexOf('  init() {'), source.indexOf('  isSingle() {'));
  assert.match(init, /this\.hideContent\(\);/u);
  // A panel the page wrote hidden="until-found" keeps that value (accordion
  // study AC-8); every other closed panel gets the attribute.
  const hide = source.slice(source.indexOf('  hideContent() {'), source.indexOf('  handleKeydown(event) {'));
  assert.match(hide, /this\.content\.setAttribute\('hidden', UNTIL_FOUND\);/u);
  assert.match(hide, /this\.content\.hidden = true;/u);
});

test('the field renderers read a date in the page\'s language and a phone by its dial code (#34)', () => {
  const set = read('src/smart/field-renderers/index.js');
  assert.match(set, /function defaultDateText\(field, value, host\)/u);
  assert.match(set, /date: renderDateCell,\n\s+datetime: renderDateCell,/u);
  // The medium form, the View set's table form (C19, 2026-11-09), through core format-date.
  assert.match(set, /const DATE_VIEW = \{dateStyle: 'medium', timeZone: 'UTC'\};/u);
  assert.match(set, /const DATETIME_VIEW = \{dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'\};/u);
  assert.match(set, /import \{formatDate\} from "\.\.\/\.\.\/core\/js\/format-date\.js";/u);
  // C40: a date in view is a time element with the record's own day and clock.
  assert.match(set, /html`<time class="sf-field-view" datetime=\$\{datetime\}>\$\{text\}<\/time>`/u);
  const country = read('src/component/country-code/js/_country_code.js');
  assert.match(country, /function countryFromNumber\(root, value\)/u);
  assert.match(country, /countryFromNumber\(root, value\) \|\|\n\s+root\.__sfCountryOptions\?\.\[0\]/u);
});

test('the manifests carry accessibility in the current shape: keys with effects, name.from (#44 item 3)', () => {
  const folders = readdirSync(new URL('../src/smart/', import.meta.url), {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`../src/smart/${entry.name}/component.json`, import.meta.url)))
    .map((entry) => entry.name);
  assert.ok(folders.length > 60);
  for (const name of folders) {
    const {accessibility} = json(`src/smart/${name}/component.json`);
    assert.ok(accessibility, `${name}: accessibility`);
    assert.ok(!('keyboard' in accessibility) && !('accessible_name' in accessibility), `${name}: no old-shape fields`);
    if ('name' in accessibility) {
      assert.ok(accessibility.name === 'none' || Array.isArray(accessibility.name?.from), `${name}: name is none or {from}`);
    }
    if ('keys' in accessibility) {
      assert.ok(accessibility.keys && !Array.isArray(accessibility.keys), `${name}: keys map to effects, not a list`);
      for (const [key, value] of Object.entries(accessibility.keys)) {
        // The closed list of standard 1.3.15 §4.8, with nothing pending.
        assert.ok(isKeyEffect(value), `${name}: ${key} -> ${JSON.stringify(value)}`);
      }
    }
  }
  // sf-menu's Escape says where it acts (#44 item 2).
  const menu = json('src/smart/menu/component.json');
  assert.ok(Array.isArray(menu.accessibility.keys.Escape.when) && menu.accessibility.keys.Escape.when.length > 0);
});
