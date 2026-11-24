// Group build 17, fields and forms items F1-F5 (ui-control brief gb17-fields):
// F1 sf-form labels="start" beside in a narrow panel (owner decision C401),
// F2 a required checkbox is a consent (DEV msg-f27d2e7a), F3 an option drawn
// as a badge takes the row's text (LV4-8), F4 option badges take the hue class
// (C411), F5 sf-list-timeline time-zone (Larena msg-17f0adf3). The behaviour
// is driven on a build by ui-control control/evidence/2026-11-22-gb17-fields
// probe/fields.mjs; this file holds the source and the generated contracts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {optionBadgeClass, optionBadgeLook, optionBadgeProps} from '../src/smart/helpers/option-badge.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('F1 (C401): labels="start" switches as sf-list-description layout auto, one label column per group', () => {
  const sheet = read('src/smart/form/scss/_smart__form.scss');
  const block = sheet.slice(sheet.indexOf('/* C182 (5), C401'), sheet.indexOf('/* C182 (7)'));
  // Beside from a form wider than 20rem (g0) and a viewport from md; over it below.
  assert.match(block, /@media \(min-width: map\.get\(bp\.\$breakpoint-array, md\)\) \{\s*@container not \(max-width: #\{mq\.container-step\(g0\)\}\) \{/u);
  assert.doesNotMatch(block, /container-step\(h0\)/u, 'the 40rem switch is gone');
  // One label column, as wide as the longest label up to 40 %, the rows a subgrid.
  assert.match(block, /--sf-form--label-width: 40%;/u);
  assert.match(block, /grid-template-columns: fit-content\(var\(--sf-form--label-width\)\) minmax\(0, 1fr\);/u);
  assert.match(block, /grid-template-columns: subgrid;[\s\S]*?column-gap: var\(--sf-form--label-gap\);/u);
  assert.match(block, /--sf-form--label-gap: var\(--sf-ui-1--space-x\);/u);
  assert.match(block, /\[data-size="1\/2"\] \{\s*--sf-form--label-gap: var\(--sf-ui-1\\\/2--space-x\);/u);
  // The same switch as sf-list-description's layout auto.
  const list = read('src/smart/list-description/scss/_smart__list-description.scss');
  assert.match(list, /@container \(max-width: #\{mq\.container-step\(g0\)\}\) \{\s*@include list-description-stacked-auto;/u);
  assert.match(list, /fit-content\(var\(--sf-list-description-label-width, 40%\)\)/u);
  assert.match(json('src/smart/form/component.json').settings.labels.summary, /C401/u);
});

test('F2: a required checkbox of its own template is answered only when ticked', () => {
  const form = read('src/smart/form/index.js');
  const ticks = form.slice(form.indexOf('export function ticksToAnswer(field) {'));
  assert.match(ticks, /return drawn\.type === 'boolean' && drawn\.template === 'checkbox';/u);
  const errorOf = form.slice(form.indexOf('  errorOf(field) {'), form.indexOf('  recheck(key) {'));
  assert.match(errorOf, /if \(field\.required === true && ticksToAnswer\(field\) && value !== true\) \{\s*return this\.sfWord\('value-missing'/u);
  // The switch stays answered by its value; the switch drawn as a checkbox in a
  // form saved by a button reads the given field, not buttonSaved's copy.
  assert.match(form, /export function answeredByValue\(field\) \{[\s\S]*?return drawn\.type === 'boolean' && drawn\.template !== 'buttons';/u);
  assert.match(form, /for \(const field of this\.shownFields\(\)\) \{\s*const message = this\.errorOf\(field\);/u);
  // The box says it is required.
  assert.match(form, /box\.setAttribute\('aria-required', 'true'\)/u);
  // after the box's own drawing too, and the input event leaves its error to the change.
  assert.match(form, /this\.markConsents\(\);\s*this\.linkMessages\(\);\s*\}/u);
  assert.match(form, /if \(ticksToAnswer\(this\.fieldOf\(key\)\)\) return;/u);
});

test('F3 (LV4-8): an option name badge in sf-input-choice takes the row text', () => {
  const template = read('src/smart/input-choice/js/templates/default.js');
  const name = template.slice(template.indexOf('function renderName('), template.indexOf('function renderRow('));
  assert.match(name, /<sf-badge class="sf-choice-name-badge"[^>]*tight line="text"/u);
  assert.doesNotMatch(name, /line="1"/u);
  assert.ok(json('src/smart/badge/component.json').settings.line.values.includes('text'));
});

test('F4 (C411): option badges take the hue class, the former props stay for hosts', () => {
  assert.deepEqual(optionBadgeLook({color: 'Teal'}), {scheme: 'neutral', hue: 'teal'});
  assert.deepEqual(optionBadgeLook({scheme: 'success'}), {scheme: 'success', hue: ''});
  assert.deepEqual(optionBadgeLook({color: 'danger'}), {scheme: 'error', hue: ''});
  assert.deepEqual(optionBadgeLook({color: '#16a34a'}), {scheme: 'neutral', hue: 'green'});
  assert.deepEqual(optionBadgeLook({color: 'url(x)'}), {scheme: 'neutral', hue: ''});
  assert.deepEqual(optionBadgeLook(), {scheme: 'neutral', hue: ''});
  assert.equal(optionBadgeClass({color: 'brown'}), 'sf-badge--brown');
  assert.equal(optionBadgeClass({color: 'info'}), '');
  // The former answer is unchanged (hosts: simai/ui-pro, simai/ui-view read it).
  assert.deepEqual(optionBadgeProps({color: 'red'}),
    {scheme: 'neutral', rootStyle: '--sf-badge-background-color: var(--sf-red-50--alfa-24); --sf-badge-color: var(--sf-on-surface)'});
  assert.deepEqual(optionBadgeProps({color: 'success'}), {scheme: 'success', rootStyle: ''});
  // No Framework part writes the two variables in a style any more.
  for (const path of ['src/smart/field-renderers/index.js', 'src/smart/input-choice/js/templates/default.js',
    'src/smart/dropdown/js/templates/default.js', 'src/smart/segmented/js/templates/default.js']) {
    const source = read(path);
    assert.doesNotMatch(source, /optionBadgeProps|badge\??\.rootStyle/u, `${path} reads the hue`);
    assert.match(source, /optionBadgeLook/u, path);
    assert.match(source, /hue/u, path);
  }
  const journal = json('contracts/changes/journal.json').records.find((one) => one.id === 'global-option-badge-props-style-to-hue');
  assert.equal(journal?.remove_after, '2027-01-01');
});

test('F5: sf-list-timeline takes time-zone for its times, day runs and midnight', () => {
  const setting = json('src/smart/list-timeline/component.json').settings['time-zone'];
  assert.equal(setting.type, 'string');
  assert.equal(setting.default, '');
  const manifest = read('src/smart/list-timeline/smart.manifest.json');
  assert.match(manifest, /"time-zone"/u);
  const source = read('src/smart/list-timeline/index.js');
  assert.match(source, /calendarDayOffset\(item\.at, \{now, timeZone\}\)/u);
  assert.match(source, /msUntilNextDay\(new Date\(\), \{timeZone: this\.zone\}\)/u);
  assert.match(source, /formatRelativeDay\(run\.at, \{now, capital: true, node: this, timeZone,/u);
  assert.match(source, /knownTimeZone\(text\(this\.timeZone\)\) \? text\(this\.timeZone\) : ''/u);
  const template = read('src/smart/list-timeline/js/templates/default.js');
  assert.equal((template.match(/time-zone=\$\{context\.zone \|\| nothing\}/gu) || []).length, 2, 'the event time and the heading date');
});

test('F1-F5 versions: above every origin branch at the time of writing', () => {
  const version = (path) => json(path).version;
  assert.equal(version('src/smart/form/component.json'), '1.15.2'); // GB17 F1b, then FS-6/FS-9 // group build 18: moved on by the merged branches or a GB15 assembly item
  assert.equal(version('src/smart/input-choice/component.json'), '1.12.0');
  assert.equal(version('src/smart/dropdown/component.json'), '1.25.3'); // GB17: joined with VL-43 and DSA-2
  assert.equal(version('src/smart/segmented/component.json'), '1.8.4'); // GB18 FL-1: one measure for the fold
  assert.equal(version('src/smart/list-timeline/component.json'), '1.6.0');
  assert.equal(version('src/core/passports/module.smart-helpers.json'), '1.21.1');
  assert.equal(version('src/core/passports/module.smart-field-renderers.json'), '1.30.1') // GB18 L6; // FS-9 merged
});
