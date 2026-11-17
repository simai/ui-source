import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {nothing} from 'lit';
import {renderProgressRingTemplate} from '../src/smart/progress-ring/js/templates/default.js';

// Owner decision C191 (4)-(8) (2026-11-15; research
// control/research/2026-11-14-recipe-parts.md, prototype
// prototypes/recipe-parts-study.html #q-ar-*): a ring around an avatar is for
// the person's own things (profile completeness, a photo upload); the tariff's
// remainder is a meter row in the person menu. sf-progress-ring 1.4.0: at
// 100 % a ring around slot content that is neither meter nor indeterminate
// goes away. sf-menu-context 1.24.0: the {type: 'meter'} row.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// The template's result as markup: the strings with every value in place.
function markup(value) {
  if (value === nothing || value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(markup).join('');
  if (value && typeof value === 'object' && Array.isArray(value.strings)) {
    return value.strings.reduce((out, part, at) => out + part + (at < value.values.length ? markup(value.values[at]) : ''), '');
  }
  return String(value);
}

const AVATAR = 'AVATAR';
const ring = (settings) => markup(renderProgressRingTemplate({size: '3', label: 'Профиль заполнен', ...settings}));
const indicator = (html) => (html.match(/class="sf-progress-ring-indicator"/g) ?? []).length;

test('C191 (7): at 100 % the ring around an avatar goes away, the avatar stays in the same box', () => {
  const done = ring({value: 100, content: AVATAR});
  assert.equal(indicator(done), 0, 'no line at 100 around a picture');
  assert.doesNotMatch(done, /role=/, 'no progressbar role and no value said');
  assert.match(done, /sf-progress-ring--size-3/, 'the box stays the ring\'s step');
  assert.match(done, /class="sf-progress-ring-content">AVATAR/, 'the avatar stays in the middle');
  // Below 100 the ring is there and says the value.
  const partly = ring({value: 70, content: AVATAR});
  assert.equal(indicator(partly), 1);
  assert.match(partly, /role=progressbar/);
  assert.match(partly, /aria-valuenow=70\b/);
  // Clamped values above 100 are 100.
  assert.equal(indicator(ring({value: 140, content: AVATAR})), 0);
});

test('C191 (7): the ring stays at 100 for a meter, an unknown value and a ring without a picture', () => {
  assert.equal(indicator(ring({value: 100, content: AVATAR, meter: true})), 1, 'a quota at 100 is the news');
  assert.equal(indicator(ring({value: 100, content: AVATAR, indeterminate: true})), 1, 'an unknown value keeps the ring');
  assert.equal(indicator(ring({value: 100})), 1, 'the empty state\'s share and a toolbar\'s job keep the ring');
  const status = ring({value: 100, status: 'success', showText: true});
  assert.equal(indicator(status), 1);
  assert.match(status, />100\u00a0%</u); // C203 (3): number, no-break space, sign
});

test('C191 (8): a photo upload is indeterminate around the avatar while the size is unknown', () => {
  const upload = ring({indeterminate: true, content: AVATAR, label: 'Загрузка фото'});
  assert.equal(indicator(upload), 1);
  assert.match(upload, /sf-progress-ring--indeterminate/);
  assert.match(upload, /aria-label=Загрузка фото/u);
  assert.doesNotMatch(upload, /aria-valuenow=\d/);
  assert.match(upload, /class="sf-progress-ring-content">AVATAR/);
});

test('C191 (4), (6)-(8): the ring\'s examples are completeness, upload and done, no quota around an avatar', () => {
  const manifest = json('src/smart/progress-ring/component.json');
  assert.equal(manifest.version, '1.6.0'); // group build 7: 1.4.1 (the branch wrote 1.4.0); 1.5.0 the unslotted-avatar note (AR-4); 1.6.0 a lone avatar is the content (fix/avatar-ring-ar1)
  const examples = Object.fromEntries(json('src/smart/progress-ring/examples.json').examples.map((example) => [example.name, example]));
  assert.equal(examples.avatar.settings.label, 'Профиль заполнен на 70 %');
  assert.equal(examples.avatar.settings.meter, undefined);
  assert.equal(examples['avatar-upload'].settings.indeterminate, true);
  assert.equal(examples['avatar-done'].settings.value, 100);
  for (const example of Object.values(examples)) assert.doesNotMatch(example.title, /лимит/u, example.name);
  const docs = read('src/smart/progress-ring/docs.md');
  assert.match(docs, /## A ring around an avatar: the person's own things/);
  assert.match(docs, /\{type: 'meter'\}/);
  assert.doesNotMatch(docs, /class="account"/, 'the quota ring on an account button is gone from the docs');
  assert.ok(manifest['x-registry'].ai_guidance.do_not.some((line) => /quota or tariff remainder/.test(line)));
});

test('C191 (4)-(6): sf-menu-context 1.24.0 draws a meter row over sf-progress-bar', () => {
  // The template imports by extensionless paths (the bundler's); read it as text.
  const template = read('src/smart/menu-context/js/templates/default.js');
  const meter = template.slice(template.indexOf('function renderMeter(entry)'), template.indexOf('// The text of a row:'));
  assert.match(meter, /<div class="sf-context-menu-meter" role="none">/);
  assert.match(meter, /<div class="sf-context-menu-meter-head" aria-hidden="true">/);
  assert.match(meter, /<span class="sf-context-menu-meter-name">\$\{entry\.text \?\? ""\}<\/span>/);
  // The words are the page's value text (the remainder), else the percentage (5), (6).
  assert.match(meter, /<span class="sf-context-menu-meter-value">\$\{words \|\| `\$\{value\}%`\}<\/span>/);
  assert.match(meter, /const words = entry\.valueText \?\? entry\["value-text"\] \?\? "";/);
  // The bar is sf-progress-bar's meter of the share used, so thresholds fire (5).
  assert.match(meter, /<sf-progress-bar\s+class="sf-context-menu-meter-bar"\s+meter\s+value=\$\{String\(value\)\}/);
  assert.match(meter, /Math\.max\(0, Math\.min\(100, number\)\)/);
  assert.match(meter, /label=\$\{entry\.text \|\| nothing\}/);
  assert.match(meter, /value-text=\$\{words \|\| nothing\}/);
  assert.match(meter, /warning-at=\$\{warningAt \?\? nothing\}/);
  assert.match(meter, /error-at=\$\{errorAt \?\? nothing\}/);
  assert.doesNotMatch(meter, /data-sf-entry|tabindex|menuitem/, 'read, not chosen');
  assert.match(template, /if \(entry\?\.type === "meter"\) return renderMeter\(entry\);/);
  // A block, not a row: the arrows, the lead column and a search skip it.
  assert.match(template, /const BLOCKS = new Set\(\["separator", "heading", "header", "note", "meter"\]\);/);
});

test('C191 (4): the meter row is declared, styled from the systems, documented and loads the bar lazily', () => {
  const manifest = json('src/smart/menu-context/component.json');
  assert.ok(['1.25.3', '1.25.4', '1.25.5'].includes(manifest.version), manifest.version); // group build 7: the integrated number (the branch wrote 1.24.0); 1.25.4: TT-11 (fix/returns-gb67); 1.25.5: the openFor() warning (fix/core-small-d1)
  assert.ok(manifest['x-registry'].item_contract.kinds.meter.fields.valueText);
  assert.ok(manifest.relations.some((relation) => relation.name === 'cl-progress-bar' && relation.lazy === true));
  assert.equal(json('src/component/context-menu/passport.json').version, '1.18.1'); // group build 8: C208's patch // group build 9: 1.16.1 moved on by the merged branches or a GB9 patch // fix/c178-findings: gaps on role steps (C105)
  const sheet = read('src/component/context-menu/scss/_css__context_menu.scss');
  const block = sheet.slice(sheet.indexOf('.sf-context-menu-meter {'), sheet.indexOf('/* The search is the panel\'s header'));
  assert.match(block, /gap: var\(--sf-space-1\\\/4\);/);
  assert.match(block, /padding: var\(--sf-context-menu--space-y\) var\(--sf-context-menu--inset-end\) var\(--sf-context-menu--space-y\) var\(--sf-context-menu--inset-start\);/);
  assert.match(block, /color: var\(--sf-on-surface-variant\);/);
  assert.doesNotMatch(block, /\d+px/, 'no magic lengths');
  const docs = read('src/smart/menu-context/docs/docs.md');
  assert.match(docs, /Строка-шкала `\{type: 'meter'\}`/u);
  const examples = json('src/smart/menu-context/examples.json').examples.map((example) => example.name);
  assert.ok(examples.includes('profile-meter'));
});
