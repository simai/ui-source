import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BUILTIN_EDITOR_MANIFESTS,
  BUILTIN_TYPE_MANIFESTS,
  Composition,
  EDITOR_FIELD_WORDS,
  editorFieldMessages,
  projectEditorFields,
  renderFieldFallback,
} from '../src/core/js/composition/index.mjs';
import { editorFieldKeys } from '../src/core/js/composition/editor-words.mjs';
import { language } from '../src/core/js/page-language.js';

// simai/ui-source#65: a host that draws a parameters form from a built-in
// editor manifest finds a word for every label, help and choice in ru and en.

// The words of a type's named places (one block editor, 2026-11-03) are read
// from the same dictionary: a slot's label_key and empty_key.
const slotKeys = () => BUILTIN_TYPE_MANIFESTS.flatMap((manifest) => Object.values(manifest.slots || {}).flatMap((slot) => [slot.label_key, slot.empty_key].filter(Boolean)));
const everyKey = () => [...new Set([...BUILTIN_EDITOR_MANIFESTS.flatMap((manifest) => manifest.fields.flatMap(editorFieldKeys)), ...slotKeys()])];

test('every label_key, help_key and stable choice of the built-in editor manifests has a word in en and ru', () => {
  const keys = everyKey();
  assert.ok(keys.length > 100, `${keys.length} keys`);
  for (const locale of ['en', 'ru']) {
    for (const key of keys) {
      const word = EDITOR_FIELD_WORDS[locale][key];
      assert.ok(typeof word === 'string' && word.trim() && word !== key, `${locale}: ${key}`);
    }
    // No word without a key that reads it: the dictionary follows the manifests.
    assert.deepEqual(Object.keys(EDITOR_FIELD_WORDS[locale]).filter((key) => !keys.includes(key)), [], `${locale}: words nobody reads`);
  }
  // The Russian words are Russian, not copies of the English ones.
  const cyrillic = /[А-Яа-яЁё]/u;
  const same = keys.filter((key) => !cyrillic.test(EDITOR_FIELD_WORDS.ru[key]));
  assert.deepEqual(same, ['sf.composition.content_diagram.engine.mermaid'], 'only the engine name stays as it is');
});

test('editorFieldMessages resolves a manifest in a named language and in the page language', () => {
  const figure = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'content.figure');
  const ru = editorFieldMessages(figure, { locale: 'ru' });
  assert.equal(ru['sf.composition.content_figure.src'], 'Адрес картинки');
  assert.equal(ru['sf.composition.content_figure.fit.contain'], 'Целиком');
  assert.equal(ru['sf.composition.content_figure.ratio.auto'], 'Как есть');
  assert.equal('sf.composition.content_figure.ratio.16/9' in ru, false, 'a choice that is not a stable segment is shown as it is');
  assert.equal(editorFieldMessages(figure, { locale: 'ru-RU' })['sf.composition.content_figure.alt'], 'Описание картинки', 'the region falls back to the language');
  assert.equal(editorFieldMessages(figure, { locale: 'de' })['sf.composition.content_figure.alt'], 'Picture description', 'an unknown language falls back to English');
  assert.equal(editorFieldMessages(figure)['sf.composition.content_figure.alt'], 'Picture description', 'no page: English');
  const node = { closest: () => ({ getAttribute: () => 'ru' }) };
  assert.equal(editorFieldMessages(figure, { node })['sf.composition.content_figure.alt'], 'Описание картинки', 'the language of the node');
  assert.equal(Object.keys(editorFieldMessages()).length, everyKey().length, 'no manifest: every built-in one');
  assert.equal(Composition.editorFieldMessages, editorFieldMessages);
  assert.deepEqual(editorFieldMessages({ fields: [{ label_key: 'host.own.label', help_key: 'host.own.help', choices: ['a'] }] }, { locale: 'ru' }), {}, 'a host key is left to the host');
});

test('a product registers a language or one word for sf-composition', () => {
  const figure = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'content.figure');
  try {
    language.register('sf-composition', 'de', { 'sf.composition.content_figure.src': 'Bildadresse' });
    language.register('sf-composition', 'ru', { 'sf.composition.content_figure.alt': 'Подпись для незрячих' });
    const de = editorFieldMessages(figure, { locale: 'de' });
    assert.equal(de['sf.composition.content_figure.src'], 'Bildadresse');
    assert.equal(de['sf.composition.content_figure.alt'], 'Picture description');
    const ru = editorFieldMessages(figure, { locale: 'ru' });
    assert.equal(ru['sf.composition.content_figure.alt'], 'Подпись для незрячих');
    assert.equal(ru['sf.composition.content_figure.src'], 'Адрес картинки');
  } finally {
    language.forget();
  }
});

test('renderFieldFallback draws a complete Russian form from the manifest and the shipped words alone', () => {
  const manifest = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'content.alert');
  const typeManifest = Composition.createRegistry().types.get('content.alert');
  const node = { id: 'a1', type: 'content.alert', props: { status: 'warning' } };
  const { fields } = projectEditorFields(manifest, typeManifest, node);
  const html = fields.map((field) => renderFieldFallback(field, { instance: node.id, messages: editorFieldMessages(manifest, { locale: 'ru' }) })).join('');
  assert.match(html, /<label for="[^"]+">Вид<\/label>/u);
  assert.match(html, /<option value="warning" selected>Внимание<\/option>/u);
  assert.match(html, /О чём сообщение/u);
  assert.doesNotMatch(html, /sf\.composition\./u, 'no key is shown');
});

test('the generated words contract matches the module', () => {
  const contract = JSON.parse(readFileSync(new URL('../src/core/contracts/composition-editor-words.v1.json', import.meta.url), 'utf8'));
  assert.equal(contract.schema, 'simai.composition.editor-words');
  assert.equal(contract.schema_version, 1);
  assert.equal(contract.owner, 'sf-composition');
  assert.deepEqual(contract.words, JSON.parse(JSON.stringify(EDITOR_FIELD_WORDS)));
});
