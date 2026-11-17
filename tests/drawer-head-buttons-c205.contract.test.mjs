import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';

// sf-drawer 1.16.1, owner decision C205 (prototype ui-control
// prototypes/drawer-headings-study.html, both points as recommended):
// (1) the content headings stand one rung below the panel title (built in
//     1.16.0, C157 (7)); (2) the base does not resize the buttons a page or a
//     set puts into the head -- slot="header-action", and slot="edge", whose
//     controls join the head's row when there is no room beside the panel --
//     so they are written size="1/3", the close's step, and a gate holds it.
// This is the static half of the gate; tests/browser/drawer-head-buttons.browser.mjs
// measures every head button against the close on the built bytes.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const folder = 'src/smart/drawer';
const docs = read(`${folder}/docs.md`);
// The docs' prose with its line breaks as spaces, for the rule's sentences.
const prose = docs.replace(/\s+/gu, ' ');
const sheet = read(`${folder}/scss/_smart__drawer.scss`);
const manifest = JSON.parse(read(`${folder}/component.json`));

const HEAD_SLOTS = /\bslot\s*=\s*"(edge|header-action)"/u;
// SIMAI buttons and their old names: the ladder's size attribute applies.
const SIMAI_BUTTON = /^sf-(button(-icon|-close|-copy)?|icon-button|close|copy-button)$/u;

// Every button a piece of markup puts into the drawer's head slots, with the
// size it wrote: a SIMAI button carrying the slot itself, every SIMAI button
// inside an element carrying it, and a native button or link there (which has
// no step at all).
export function headSlotButtons(markup) {
  const found = [];
  const tags = [...markup.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b([^>]*?)(\/?)>/giu)];
  for (let index = 0; index < tags.length; index += 1) {
    const [, closing, rawName, attributes] = tags[index];
    if (closing) continue;
    const slot = attributes.match(HEAD_SLOTS)?.[1];
    if (!slot) continue;
    const name = rawName.toLowerCase();
    const take = (tagName, tagAttributes) => {
      if (SIMAI_BUTTON.test(tagName)) found.push({slot, tag: tagName, size: tagAttributes.match(/\bsize\s*=\s*"([^"]*)"/u)?.[1] ?? null});
      else if (tagName === 'button' || (tagName === 'a' && /\bhref\s*=/u.test(tagAttributes))) found.push({slot, tag: tagName, size: null, native: true});
    };
    take(name, attributes);
    if (SIMAI_BUTTON.test(name) || name === 'button') continue;
    // A container: every button up to its own closing tag.
    let depth = 1;
    for (let inner = index + 1; inner < tags.length && depth > 0; inner += 1) {
      const [, innerClosing, innerRaw, innerAttributes, selfClosing] = tags[inner];
      const innerName = innerRaw.toLowerCase();
      if (innerName === name) depth += innerClosing ? -1 : (selfClosing ? 0 : 1);
      if (depth > 0 && !innerClosing) take(innerName, innerAttributes);
    }
  }
  return found;
}

// The markup the drawer ships: its docs' code, its examples (the probe page
// and the studio fixture are made from them) and its static templates.
const shipped = () => {
  const sources = [];
  for (const [, block] of docs.matchAll(/```html\n([\s\S]*?)```/gu)) sources.push({where: 'docs.md', markup: block, docs: true});
  const strings = (value, where) => {
    if (typeof value === 'string') sources.push({where, markup: value});
    else if (Array.isArray(value)) value.forEach((item) => strings(item, where));
    else if (value && typeof value === 'object') Object.values(value).forEach((item) => strings(item, where));
  };
  for (const file of ['examples.json', 'studio.fixture.json', 'studio.scenario.json']) strings(JSON.parse(read(`${folder}/${file}`)), file);
  for (const file of readdirSync(new URL(`../${folder}/static/default/`, import.meta.url))) {
    if (file.endsWith('.html')) sources.push({where: `static/default/${file}`, markup: read(`${folder}/static/default/${file}`)});
  }
  return sources;
};

test('C205 (2): the scanner sees a head button of any step, sized or not, held or nested', () => {
  assert.deepEqual(headSlotButtons('<sf-button-icon slot="header-action" icon="edit" size="1/3"></sf-button-icon>'),
    [{slot: 'header-action', tag: 'sf-button-icon', size: '1/3'}]);
  assert.deepEqual(headSlotButtons('<sf-button-icon slot="edge" icon="link"></sf-button-icon>'),
    [{slot: 'edge', tag: 'sf-button-icon', size: null}]);
  // A set's column of edge controls (sf-view-properties draws one).
  assert.deepEqual(headSlotButtons('<div class="flex flex-col" slot="edge"><div><sf-button-icon size="1" icon="close"></sf-button-icon></div><sf-button size="1/3">Открыть</sf-button></div><sf-button-icon icon="x"></sf-button-icon>')
    .map((button) => `${button.tag} ${button.size}`), ['sf-button-icon 1', 'sf-button 1/3']);
  assert.equal(headSlotButtons('<button slot="edge">Край</button>')[0].native, true);
  assert.deepEqual(headSlotButtons('<sf-button-icon icon="edit" size="1"></sf-button-icon><div slot="footer"><sf-button>Ок</sf-button></div>'), []);
});

test('C205 (2): every button the drawer\'s docs, examples and templates put into the head is size="1/3"', () => {
  let seen = 0;
  for (const {where, markup, docs: isDocs} of shipped()) {
    for (const button of headSlotButtons(markup)) {
      seen += 1;
      if (button.native) {
        // A native button has no step; the docs never show one there.
        assert.ok(!isDocs, `${where}: a native <${button.tag}> in slot="${button.slot}" -- use sf-button-icon size="1/3"`);
        continue;
      }
      assert.equal(button.size, '1/3', `${where}: <${button.tag} slot="${button.slot}"> is size=${JSON.stringify(button.size)}, the head's buttons are size="1/3" (C205 (2))`);
    }
  }
  assert.ok(seen >= 3, `the docs show the head action and the edge controls (saw ${seen})`);
});

test('C205 (2): the rule is written where a page and a set read it', () => {
  assert.match(prose, /Кнопки в шапке — размера `1\/3`, как крестик \(решение C205 \(2\)\)\./u);
  assert.match(prose, /База их размер не меняет — `size="1\/3"` пишет страница или набор/u);
  assert.match(prose, /Поэтому кнопки слота `edge` пишут `size="1\/3"`/u);
  assert.match(manifest.slots['header-action'].summary, /size="1\/3" as the close \(owner decision C205 \(2\)/u);
  assert.match(manifest.slots.edge.summary, /every button put here is written size="1\/3", the close's step; the base does not resize them/u);
  // The base still leaves the page's buttons alone: no size rule on the edge
  // or the head's slotted buttons in the sheet.
  assert.doesNotMatch(sheet, /\.sf-drawer-(edge|action)[^{]*\{[^}]*--sf-button[^}]*size/u);
});

test('C205 (1): the content headings one rung below the title, all one size, confirmed in the docs', () => {
  assert.match(prose, /все заголовки содержимого одного размера \(на компьютере заголовок панели 20, заголовки содержимого 16; на планшете и телефоне 16 и 14\)/u);
  const rule = sheet.match(/\.sf-drawer-body,\n\s+\.sf-drawer-foot \{([^}]*)\}/u)?.[1] ?? '';
  assert.match(rule, /--sf-heading-1--size: var\(--sf-heading-5--size\);/u);
  for (const level of [2, 3, 4]) assert.match(rule, new RegExp(`--sf-heading-${level}--size: var\\(--sf-heading-6--size\\);`, 'u'));
});

test('C205: the version, its decision and its migration step', () => {
  assert.equal(manifest.version, '1.17.1'); // group build 9: 1.16.1 moved on by the merged branches or a GB9 patch // C282: 1.16.4 moved on by the language-file patch (Russian is a language file)
  assert.match(manifest['x-decisions'][0], /^version 1\.16\.1 \(2026-11-15, owner decision C205/u);
  const step = manifest.compatibility?.migrations?.find?.((entry) => entry.to === '1.17.0')
    ?? JSON.stringify(manifest).match(/"from":"1\.16\.0","to":"1\.16\.1"/u);
  assert.ok(step, 'a 1.16.0 -> 1.16.1 migration step');
  const gate = read('tests/browser/drawer-head-buttons.browser.mjs');
  // The browser half proves it can go red: unsized head buttons must be caught.
  assert.match(gate, /'action-unsized': \{ok: false/u);
  assert.match(gate, /'edge-full-unsized': \{ok: false/u);
  assert.match(gate, /box\(node\)\.height > closeBox\.height \+ 0\.5/u);
});
