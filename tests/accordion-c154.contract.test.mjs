// Owner decision C154 (accordion study control/research/2026-11-14-accordion.md,
// prototype prototypes/accordion-study.html in simai/ui-control): the eight
// accepted points, held in the class accordion, sf-accordion and core.styles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ACCORDION_DEFAULT_APPEARANCE,
  EXPAND_ALL_FROM,
  normaliseSection,
  showsExpandAll,
} from '../src/smart/accordion/sections.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('src/component/accordion/scss/_css__accordion.scss');
const runtime = read('src/component/accordion/js/_accordion.js');
const motion = read('src/component/accordion/js/motion.js');
const element = read('src/smart/accordion/index.js');
const template = read('src/smart/accordion/js/templates/default.js');
const smartSheet = read('src/smart/accordion/scss/_smart__accordion.scss');
const core = read('src/core/scss/_sf_css__placeholder.scss');
const manifest = JSON.parse(read('src/smart/accordion/component.json'));
const ru = JSON.parse(read('src/smart/accordion/lang/ru.json'));
const en = JSON.parse(read('src/smart/accordion/lang/en.json'));

test('C154 (1): the marker at the end points down closed, up open; the lead icon never turns', () => {
  assert.match(sheet, /\.sf-accordion \.sf-accordion-trigger \.sf-icon:not\(\.sf-accordion-lead\),\s*\.sf-accordion\.sf-accordion--legacy > \.sf-icon \{\s*transform: rotate\(90deg\);/u);
  assert.match(sheet, /\.sf-accordion \.sf-accordion-trigger\[aria-expanded='true'\] \.sf-icon:not\(\.sf-accordion-lead\),[^{]*\{\s*transform: rotate\(-90deg\);/u);
  assert.match(sheet, /\.sf-accordion \.sf-accordion-trigger \.sf-icon\.sf-accordion-lead \{\s*transform: none;/u);
  // The runtime writes its glyph into the marker, not into a lead icon.
  assert.match(runtime, /const MARKER_SELECTOR = '\.sf-icon:not\(\.sf-accordion-lead\)';/u);
});

test('C154 (2): lines are the default look of sf-accordion and of its first paint', () => {
  assert.equal(ACCORDION_DEFAULT_APPEARANCE, 'flush');
  assert.equal(manifest.settings.appearance.default, 'flush');
  assert.deepEqual(manifest.settings.appearance.values, ['default', 'outline', 'flush']);
  assert.match(element, /appearance: \{default: ACCORDION_DEFAULT_APPEARANCE, values: ACCORDION_APPEARANCES\}/u);
  // Before its code the sections meet; filled and outlined ones stand apart.
  assert.match(core, /:where\(sf-accordion:not\(:defined\)\) \{[^}]*--sf-accordion--box-gap: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(core, /:where\(sf-accordion:is\(\[appearance="default"\], \[appearance="outline"\]\):not\(:defined\)\) \{ --sf-accordion--box-gap: var\(--sf-space-2\); \}/u);
});

test('C154 (3): summary at the end of the header, before the marker, in the hint colour', () => {
  assert.equal(normaliseSection({title: 'Бренд', summary: ' Выбрано 2 '}).summary, 'Выбрано 2');
  assert.equal(normaliseSection({title: 'Бренд'}).summary, '');
  assert.deepEqual(manifest.settings.items.of.summary, {type: 'string', optional: true});
  assert.ok(manifest['x-registry'].item_contract.properties.summary);
  const header = template.slice(template.indexOf('function renderHeaderContent'), template.indexOf('function renderSection'));
  assert.ok(header.indexOf('sf-accordion-summary') > header.indexOf('sf-accordion-badge'));
  assert.ok(header.indexOf('sf-accordion-summary') < header.indexOf('markerGlyph'));
  assert.match(sheet, /\.sf-accordion \.sf-accordion-trigger \.sf-accordion-summary \{[^}]*color: var\(--sf-on-surface-variant\);[^}]*font-weight: var\(--sf-font-weight-regular\);[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/u);
  assert.match(element, /summary: details\.dataset\.summary,/u);
});

test('C154 (4): height and marker on one 200 ms --sf-ease-move clock, none under reduced motion', () => {
  assert.match(sheet, /--sf-accordion--duration: calc\(var\(--sf-duration-fast\) \* 2\);/u);
  assert.match(sheet, /--sf-accordion--easing: var\(--sf-ease-move\);/u);
  assert.match(sheet, /transition: block-size var\(--sf-accordion--duration\) var\(--sf-accordion--easing\);/u);
  assert.match(sheet, /transition: transform var\(--sf-accordion--duration\) var\(--sf-accordion--easing\);/u);
  assert.match(sheet, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sf-accordion,\s*\.sf-accordion-trigger,\s*\.sf-accordion \.sf-icon \{\s*transition: none;/u);
  assert.match(motion, /prefers-reduced-motion: reduce/u);
  assert.match(motion, /section\.animate\(\s*\{blockSize: \[`\$\{from\}px`, `\$\{to\}px`\]\}/u);
  // A closing panel stays drawn while the section shrinks.
  assert.match(sheet, /\[data-sf-accordion-closing\][^{]*> \.sf-accordion-content\[hidden='until-found'\] \{[^}]*content-visibility: visible;/u);
  assert.match(runtime, /moveSection\(this\.el, from,/u);
  assert.match(element, /moveSection\(article, from,/u);
});

test('C154 (5): link makes the section id its address', () => {
  assert.equal(manifest.settings.link.type, 'boolean');
  assert.equal(manifest.settings.link.default, false);
  assert.match(template, /id=\$\{context\.link \? section\.id : nothing\}/u);
  assert.match(element, /addEventListener\?\.\('hashchange', this\.onHashChange\)/u);
  assert.match(element, /history\?\.replaceState\?\.\(/u);
  assert.match(element, /scrollIntoView\?\.\(\{block: 'start'\}\)/u);
});

test('C154 (6): every closed panel of sf-accordion is findable and opens on beforematch', () => {
  assert.match(template, /hidden=\$\{open \? nothing : 'until-found'\}/u);
  assert.doesNotMatch(template, /\?hidden=/u);
  assert.match(element, /addEventListener\('beforematch', this\.onBeforeMatch, true\)/u);
  assert.match(element, /this\.setOpen\(id, true, 'user', \{motion: false\}\)/u);
});

test('C154 (7): expand-all from five sections, never with single, a ghost button', () => {
  assert.equal(EXPAND_ALL_FROM, 5);
  const five = Array.from({length: 5}, (_, i) => ({id: String(i)}));
  assert.equal(showsExpandAll(five, {expandAll: true}), true);
  assert.equal(showsExpandAll(five.slice(0, 4), {expandAll: true}), false);
  assert.equal(showsExpandAll(five, {expandAll: true, single: true}), false);
  assert.equal(showsExpandAll(five, {expandAll: false}), false);
  assert.equal(manifest.settings['expand-all'].type, 'boolean');
  assert.match(template, /<sf-button class="sf-accordion-all-button" appearance="ghost" scheme="on-surface"/u);
  assert.match(template, /icon-start=\$\{all \? 'unfold_less' : 'unfold_more'\}/u);
  assert.equal(ru.runtime.expandAll, 'Развернуть все');
  assert.equal(ru.runtime.collapseAll, 'Свернуть все');
  assert.ok(en.runtime.expandAll && en.runtime.collapseAll);
  assert.ok(manifest.relations.some((one) => one.name === 'cl-button' && one.lazy));
  assert.match(smartSheet, /\.sf-accordion-all \{[^}]*justify-content: flex-end;[^}]*min-block-size: var\(--sf-ui-1--control-height\);[^}]*margin-block-end: var\(--sf-space-1\\\/2\);/u);
});

test('C154 (8): a nested accordion draws lines, one level, its text under the outer text', () => {
  assert.match(sheet, /\.sf-accordion \.sf-accordion-content \.sf-accordion \{[^}]*border: 0;[^}]*border-block-end:[^}]*background-color: transparent;/u);
  assert.match(sheet, /\.sf-accordion \.sf-accordion-content \.sf-accordion > \.sf-accordion-heading > \.sf-accordion-trigger,\s*\.sf-accordion \.sf-accordion-content \.sf-accordion > \.sf-accordion-content \{\s*padding-inline: 0;/u);
  assert.match(element, /closest\?\.\('\.sf-accordion-content'\)\) return 'flush';/u);
});

test('C154: values from the systems only', () => {
  const rules = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
  for (const text of [sheet, smartSheet]) {
    assert.doesNotMatch(rules(text), /\b\d+(?:px|rem|em|ms)\b/u);
  }
});
