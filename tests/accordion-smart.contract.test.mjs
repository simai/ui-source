import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
  ACCORDION_APPEARANCES,
  ACCORDION_SIZES,
  BADGE_SIZE,
  REGION_LIMIT,
  markerGlyph,
  normaliseSections,
  openSections,
} from '../src/smart/accordion/sections.mjs';

// sf-accordion (owner, 2026-10-25): sections built from data, drawn as the
// class accordion (src/component/accordion) so its styles apply and are not
// forked. What a reader of the source cannot tell from one file is held here;
// the page itself is measured by tests/browser/accordion-smart.browser.mjs.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/accordion/index.js');
const template = read('src/smart/accordion/js/templates/default.js');
const sheet = read('src/smart/accordion/scss/_smart__accordion.scss');
const classSheet = read('src/component/accordion/scss/_css__accordion.scss');
const manifest = JSON.parse(read('src/smart/accordion/smart.manifest.json'));

test('smart accordion: sections from an array or JSON, with ids and nothing parsed as markup', () => {
  const items = [
    {id: 'main', title: 'Основное', content: 'Текст', open: true},
    {title: 'Без имени', content: '<b>не разметка</b>', badge: 3, icon: 'tune'},
    {id: 'main', title: 'Повтор'},
    null,
    'Строка',
  ];
  const sections = normaliseSections(items);
  assert.deepEqual(sections.map((section) => section.id), ['main', 'section-2', 'section-5']);
  assert.equal(sections[1].content, '<b>не разметка</b>', 'content stays text');
  assert.equal(sections[1].badge, '3');
  assert.equal(sections[2].title, 'Строка');
  assert.deepEqual(normaliseSections(JSON.stringify(items)), sections);
  for (const empty of [null, undefined, '', '{not json', '{}', 42]) assert.deepEqual(normaliseSections(empty), [], String(empty));
  // The content is bound as text: no unsafeHTML, no innerHTML anywhere.
  assert.doesNotMatch(source + template, /unsafeHTML|innerHTML/u);
  assert.match(template, /return section\.content \|\| nothing;/u);
});

test('smart accordion: single mode keeps one open, the first; a change overrides the data', () => {
  const sections = normaliseSections([{id: 'a', open: true}, {id: 'b', open: true}, {id: 'c'}]);
  assert.deepEqual([...openSections(sections)], ['a', 'b']);
  assert.deepEqual([...openSections(sections, new Map(), true)], ['a']);
  assert.deepEqual([...openSections(sections, new Map([['a', false], ['c', true]]), true)], ['b']);
  assert.deepEqual([...openSections(sections, new Map([['a', false], ['b', false], ['c', true]]), true)], ['c']);
  // Opening one in single mode closes what was open, and every section that
  // changed is reported, the one asked for first.
  assert.match(source, /if \(open && this\.single\) \{\n      for \(const other of before\) this\._openState\.set\(other, false\);/u);
  // sf-accordion-toggle; sf-accordion:toggle is its dated alias (aliases.json).
  assert.match(source, /this\.sfEmit\('toggle', \{id: one\.id, open: after\.has\(one\.id\), source, section: one\}\);/u);
});

test('smart accordion: the class markup, the class runtime kept off it', () => {
  // The class accordion's own classes and structure, so its sheet draws it.
  for (const part of ['sf-accordion-heading', 'sf-accordion-trigger', 'sf-accordion-title', 'sf-accordion-content', 'sf-accordion-group']) {
    assert.ok(template.includes(part), part);
  }
  assert.match(template, /context\.size \? `sf-accordion--size-\$\{context\.size\}` : ''/u);
  assert.match(template, /context\.marker === 'plus-minus' \? 'sf-accordion--plus-minus' : ''/u);
  assert.match(template, /context\.isStatic \? 'sf-accordion--static' : ''/u);
  // Each section carries the class runtime's mark of a section already set
  // up, so that runtime never binds a second toggle to it.
  assert.match(template, /data-sf-accordion-init="1"/u);
  assert.match(read('src/component/accordion/js/_accordion.js'), /if \(!this\.el \|\| this\.el\.dataset\.sfAccordionInit === '1'\) return;/u);
  // Every size and appearance is one the class sheet draws.
  for (const size of ACCORDION_SIZES.filter(Boolean)) {
    assert.ok(classSheet.includes(`.sf-accordion.sf-accordion--size-${size.replace('/', '\\/')} {`), size);
  }
  for (const appearance of ACCORDION_APPEARANCES.filter((one) => one !== 'default')) {
    assert.ok(classSheet.includes(`.sf-accordion.sf-accordion--${appearance} {`), appearance);
  }
  assert.deepEqual(manifest.inputs.properties.size.enum, [...ACCORDION_SIZES]);
  assert.deepEqual(manifest.inputs.properties.appearance.enum, [...ACCORDION_APPEARANCES]);
  // The marker's words are the class runtime's.
  assert.equal(markerGlyph('chevron', true), 'chevron_right');
  assert.equal(markerGlyph('plus-minus', true), 'remove');
  assert.equal(markerGlyph('plus-minus', false), 'add');
  // The badge exists at the size it is given.
  const badgeSizes = read('src/component/badges/js/contract.js');
  for (const size of Object.values(BADGE_SIZE)) assert.ok(badgeSizes.includes(`'${size}'`), size);
});

test('smart accordion: its own sheet draws only what the class has no part for, from tokens', () => {
  const rules = sheet.replace(/\/\/.*$/gmu, '');
  // Nothing the class draws is redrawn: no padding, size, radius, fill or
  // border of a section or a header here.
  assert.doesNotMatch(rules, /padding|min-block-size|border-radius|border:|font-size|line-height/u);
  assert.doesNotMatch(rules, /\b\d+(?:\.\d+)?(?:px|rem|em|ms)\b/u);
  assert.doesNotMatch(rules, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
  // The icon before the title does not turn with the marker, in either
  // direction: its selector outranks the class's rotation and RTL rules.
  assert.match(sheet, /\.sf-accordion \.sf-accordion-heading \.sf-accordion-trigger \.sf-icon\.sf-accordion-lead \{\n  transform: none;/u);
  assert.match(sheet, /\.sf-accordion\.sf-accordion--disabled \.sf-accordion-trigger:disabled \{[^}]*color: var\(--sf-on-disable\);/u);
});

test('smart accordion: buttons in headings, linked to their panels; regions only while few', () => {
  assert.match(template, /<div class="sf-accordion-heading" role="heading" aria-level=\$\{context\.headingLevel\}>/u);
  assert.match(template, /<button class="sf-accordion-trigger" type="button" id=\$\{triggerId\}\s+data-sf-accordion-section=\$\{section\.id\}\s+aria-expanded=\$\{open \? 'true' : 'false'\} aria-controls=\$\{panelId\}\s+\?disabled=\$\{section\.disabled\}>/u);
  assert.match(template, /role=\$\{region \? 'region' : nothing\} aria-labelledby=\$\{region \? triggerId : nothing\}/u);
  assert.match(template, /const region = context\.sections\.length <= REGION_LIMIT;/u);
  assert.equal(REGION_LIMIT, 6);
  assert.match(template, /\?hidden=\$\{!open\}/u);
  // The single section is a plain element in the button's place.
  assert.match(template, /<span class="sf-accordion-trigger" id=\$\{triggerId\} data-sf-accordion-static>/u);
  // The arrows walk the headers, Home and End go to the ends; Enter and
  // Space stay the button's own.
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) assert.ok(source.includes(`'${key}'`), key);
  assert.doesNotMatch(source, /'Enter'|'Space'/u);
  // A nested accordion's headers are its own.
  assert.match(source, /trigger\.closest\('sf-accordion'\) === this/u);
  assert.deepEqual(manifest.accessibility.keyboard, ['Tab', 'Enter', 'Space', 'ArrowDown', 'ArrowUp', 'Home', 'End']);
});

test('smart accordion: the manifest says the methods and the event the source has', () => {
  for (const method of Object.keys(manifest.methods)) assert.match(source, new RegExp(`\\n  ${method}\\(id\\) \\{`, 'u'), method);
  // The events are component.json's verbs, sent through sfEmit (standard 1.3.8
  // §8); the old colon name is aliases.json's.
  const sent = new Set([...source.matchAll(/this\.sfEmit\('([^']+)'/gu)].map((match) => match[1]));
  const declared = JSON.parse(readFileSync(new URL('../src/smart/accordion/component.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(declared.events).sort(), [...sent].sort());
  assert.doesNotMatch(source, /new CustomEvent\(/u);
  assert.deepEqual(Object.keys(manifest.item_contract.properties), ['id', 'title', 'content', 'slot', 'open', 'disabled', 'icon', 'badge']);
  assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage/u);
});

test('smart accordion: the loader knows it and asks for what it draws with', () => {
  const rule = read('src/smart/accordion/rule.js');
  assert.match(rule, /SF\.RuleLoader\['cl-accordion'\] = \{\n  tags: \['sf-accordion'\],/u);
  assert.match(rule, /\{ name: 'accordion' \},\n    \{ name: 'icons' \},\n    \{ name: 'cl-badge', lazy: true \},/u);
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/accordion\/rule\.js';/u);
  assert.deepEqual(manifest.composition.uses, ['component.accordion', 'smart.badge']);
});

// The public variables (2026-10-25): eight, read by the class sheet that
// sf-accordion draws with, each with the value it drew before as its fallback.
test('smart accordion: the class accordion\'s public variables wrap the values it drew before', () => {
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const entry = contract.components.find((one) => one.component === 'accordion');
  assert.equal(entry.selector, '.sf-accordion');
  assert.equal(entry.variables.length, 8);
  for (const variable of entry.variables) assert.equal(variable.since, '2026-10-25', variable.name);
  for (const line of [
    '--sf-accordion--radius: var(--sf-accordion-radius, var(--sf-radius--surface));',
    '--sf-accordion--border-width: var(--sf-accordion-border-width, var(--sf-px));',
    '--sf-accordion--border-color: var(--sf-accordion-border-color, var(--sf-outline-variant));',
    '--sf-accordion--background-color: var(--sf-accordion-background-color, var(--sf-surface-container));',
    'color: var(--sf-accordion-title--color, var(--sf-accordion-title-color, var(--sf-on-surface)));',
    'color: var(--sf-icon--color, var(--sf-accordion-icon-color, var(--sf-on-surface-variant)));',
    'color: var(--sf-accordion-content--color, var(--sf-accordion-content-color, var(--sf-on-surface-variant)));',
    'var(--sf-accordion-divider-color, var(--sf-outline-variant))',
  ]) assert.ok(classSheet.includes(line), line);
  // Hover and pressed write their own.
  for (const state of ['.sf-accordion-trigger:hover {', '.sf-accordion-trigger:active {']) {
    assert.doesNotMatch(classSheet.slice(classSheet.indexOf(state)).split('}')[0], /--sf-accordion-[a-z]+-[a-z]/u, state);
  }
  const docs = read('src/smart/accordion/docs.md');
  for (const variable of entry.variables) assert.ok(docs.includes(`| \`${variable.name}\` |`), variable.name);
});
