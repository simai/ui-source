import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import test from 'node:test';
import {normaliseItems} from '../src/smart/input-choice/js/choice-model.mjs';

// Larena points LF-1, LF-2, LF-3, LF-7, LF-8 and LF-12 (dispatcher order
// msg-848790df, 2026-11-18), held without a browser. The behaviour is probed on
// the built bytes (ui-control control/evidence/2026-11-18-lf-data).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const code = (path) => read(path).split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');

test('LF-1: sf-input-choice items say what the attribute gave, as the base reads list attributes', () => {
  const source = code('src/smart/input-choice/index.js');
  assert.match(source, /sfReadListAttributes\(\) \{\n\s*const first = !this\.__sfListAttributesRead;\n\s*super\.sfReadListAttributes\(\);/u);
  assert.match(source, /if \(this\.__sfListAttributesRead\) this\.adoptItemsAttribute\(newValue\);/u);
});

test('LF-2: one option shape {value, label}; text is a dated alias in sf-dropdown and sf-input-choice', () => {
  const dropdown = code('src/smart/dropdown/index.js');
  assert.match(dropdown, /const named = option\.label \?\? option\.text;/u);
  assert.match(dropdown, /from: 'text', to: 'label', since: '2026-11-18', remove_after: '2027-01-01'/u);
  const notes = [];
  const items = normaliseItems([{value: 'a', label: 'A'}, {value: 'b', text: 'B'}, {value: 'c', title: 'C'}, {value: 'd', label: 'D', text: 'x'}], {onAlias: (from, to) => notes.push(`${from}>${to}`)});
  assert.deepEqual(items.map((one) => one.label), ['A', 'B', 'C', 'D']);
  assert.deepEqual(notes, ['text>label']);
  const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'sf-dropdown-option-text-to-label');
  assert.equal(record?.remove_after, '2027-01-01');
  assert.deepEqual(record.items.map((one) => one.component), ['sf-dropdown', 'sf-input-choice']);
  assert.match(json('src/smart/dropdown/component.json').settings.options.summary, /\[\{value, label, type\?/u);
});

test('LF-3: sf-modal and sf-drawer watch their host for content written later', () => {
  const helper = code('src/smart/helpers/late-children.js');
  assert.match(helper, /observer\.observe\(host, \{childList: true\}\);/u);
  for (const part of ['modal', 'drawer']) {
    const source = code(`src/smart/${part}/index.js`);
    assert.match(source, /this\._lateChildren = watchLateChildren\(this, \(nodes\) => this\.takeLateChildren\(nodes\)\);/u, part);
    assert.match(source, /this\._lateChildren\?\.disconnect\(\);/u, part);
  }
  assert.match(code('src/smart/modal/index.js'), /this\._liveSlotNodes\.set\(slot, given\);/u);
  assert.match(code('src/smart/drawer/index.js'), /body\.replaceChildren\(\.\.\.content\);/u);
});

test('LF-7: focus and scrollIntoView on a host with no box reach the element inside', () => {
  const base = code('src/core/js/smart-base.js');
  assert.match(base, /function firstTabbableOf\(host\) \{/u);
  assert.match(base, /const target = this\.focusDelegate\?\.\(\) \|\| firstTabbableOf\(this\);/u);
  assert.match(base, /function boxOf\(host\) \{/u);
  assert.match(base, /scrollIntoView\(options\) \{\n\s*const box = boxOf\(this\);/u);
  assert.ok(existsSync(new URL('../docs/developer/host-box.md', import.meta.url)), 'the shared note lists the parts and the element to measure');
});

test('LF-8: a time something took reads at least 0:01; the units are named', async () => {
  const source = code('src/smart/progress-run/index.js');
  assert.match(source, /const total = took && ms > 0 \? Math\.max\(1, Math\.round\(ms \/ 1000\)\) : Math\.floor\(ms \/ 1000\);/u);
  assert.match(source, /formatTime\(stepTime\(step, now\), \{took: step\.state !== 'running'\}\)/u);
  const settings = json('src/smart/progress-run/component.json').settings;
  assert.match(settings.steps.summary, /duration in milliseconds/u);
  assert.match(settings.steps.summary, /ISO 8601/u);
  assert.match(settings.look.summary, /outside a table use notice/u);
});

test('LF-12: sf-form says sf-list-description\'s empty word, in every language', () => {
  const langs = new Set(readdirSync(new URL('../src/smart/form/lang/', import.meta.url)).filter((name) => name.endsWith('.json')));
  assert.ok(langs.has('en.json') && langs.has('ru.json'));
  for (const file of langs) {
    const form = json(`src/smart/form/lang/${file}`).runtime['empty-value'];
    const list = json(`src/smart/list-description/lang/${file}`).runtime['empty-text'];
    assert.ok(form, `${file}: sf-form empty-value`);
    assert.equal(form, list, `${file}: one word for both parts`);
  }
  // The language files a page fetches carry the same word.
  const index = json('src/core/lang/index.json');
  for (const language of index.languages) {
    const dir = new URL(`../src/core/lang/${language}/`, import.meta.url);
    const words = {};
    for (const name of readdirSync(dir)) Object.assign(words, JSON.parse(readFileSync(new URL(name, dir), 'utf8')).words);
    assert.equal(words['sf-form']['empty-value'], words['sf-list-description']['empty-text'], language);
  }
  assert.match(code('src/smart/form/index.js'), /<span class="sf-field-view sf-form-empty">\$\{this\.sfWord\('empty-value'\)\}<\/span>/u);
});
