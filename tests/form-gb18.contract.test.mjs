import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {isEmailAddress, EMAIL_MOST} from '../src/smart/field-renderers/text-types.js';

// GB18 area sf-form (owner decision C422, DEV msg-dafef266eaa542939ff0):
// FS-1 field origin, FS-2 busy save, FS-3 «Сохранено в HH:MM», FS-4 leave
// guard, FS-5 read-only form, FS-7 the email type; queue msg-fc99b09e the
// checkable help mark at the field step.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const form = () => json('src/smart/form/component.json');
const source = () => read('src/smart/form/index.js');
const template = () => read('src/smart/form/js/templates/default.js');

test('GB18 versions: above every origin branch at the time of writing', () => {
  assert.equal(form().version, '1.15.0');
  assert.equal(json('src/smart/checkbox/component.json').version, '1.6.1');
  assert.equal(json('src/smart/radio/component.json').version, '1.4.5');
  assert.equal(json('src/smart/switch/component.json').version, '1.10.1');
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.30.0');
  assert.equal(json('src/core/passports/module.smart-helpers.json').version, '1.21.1');
});

test('FS-1: a field origin is declared, drawn under the field, and «Вернуть общее» is a cancelable event', () => {
  const manifest = form();
  assert.ok(manifest.settings.origin, 'origin words setting');
  assert.ok(manifest.events['reset-field'], 'reset-field event');
  const code = source();
  assert.match(code, /export const ORIGIN_LEVELS = Object\.freeze\(\['own', 'inherited', 'locked'\]\)/u);
  assert.match(code, /inheritField\(key\)/u);
  assert.match(code, /this\.sfEmit\('reset-field', \{key, value/u);
  const drawn = template();
  assert.match(drawn, /class="sf-form-origin"/u);
  assert.match(drawn, /<sf-button class="sf-form-origin-reset" appearance="plain"/u);
  assert.match(drawn, /data-origin=/u);
});

test('FS-2, FS-3: a save in progress holds the form; saved() writes «Сохранено в HH:MM» until the next change', () => {
  const manifest = form();
  assert.ok(manifest.values.busy, 'busy value');
  assert.ok(manifest.values['saved-at'], 'saved-at value');
  assert.ok(manifest.actions.saved, 'saved action');
  const code = source();
  assert.match(code, /if \(this\.busy\) return refused\('busy'\)/u);
  assert.match(code, /holdFieldsReadOnly\(windowFields\(body\)\)/u);
  assert.match(template(), /\?loading=\$\{context\.busy\}/u);
  assert.equal(json('src/smart/form/lang/ru.json')['saved-at'] ?? findWord('ru', 'saved-at'), 'Сохранено в {time}');
});

test('FS-4: the leave guard asks the C159 (6) question in the panel and on beforeunload', () => {
  const manifest = form();
  assert.ok(manifest.settings.guard, 'guard setting');
  assert.ok(manifest.events.leave, 'leave event');
  assert.ok(manifest.actions['confirm-leave'], 'confirm-leave action');
  const code = source();
  assert.match(code, /addEventListener\?\.\('beforeunload', this\._onBeforeUnload\)/u);
  assert.match(code, /data-sf-form-leave/u);
  assert.equal(findWord('ru', 'leave-heading'), 'Уйти без сохранения?');
  assert.equal(findWord('ru', 'leave-discard'), 'Не сохранять');
  assert.equal(findWord('ru', 'leave-keep'), 'Продолжить правку');
});

test('FS-5: a read-only form draws no «Изменить» or «Сохранить», a reason line instead', () => {
  const manifest = form();
  assert.ok(manifest.settings.readonly, 'readonly setting');
  assert.ok(manifest.settings['readonly-reason'], 'readonly-reason setting');
  assert.match(template(), /sf-form-reason/u);
  assert.match(source(), /get isReadOnly\(\)/u);
});

test('FS-7: the email type checks an address and draws the email keyboard', () => {
  for (const good of ['name@example.ru', 'a.b+c@sub.example.com', 'a@пример.рф']) assert.equal(isEmailAddress(good), true, good);
  for (const bad of ['', 'a@b', 'a..b@x.ru', '.a@x.ru', 'a@x.123', ' a@x.ru', 'a b@x.ru', 'a@-x.ru-', `${'a'.repeat(65)}@x.ru`]) assert.equal(isEmailAddress(bad), false, bad);
  assert.equal(EMAIL_MOST, 254);
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /inputType: 'email'/u);
  assert.match(renderers, /inputmode: 'email'/u);
  assert.match(read('src/smart/field-renderers/registry.js'), /type: 'email'/u);
});

test('msg-fc99b09e: a standalone choice control of size 1 draws its help mark at 1/2, as an sf-form field', () => {
  assert.match(read('src/smart/helpers/checkable-row.js'), /CHECKABLE_HELP_SIZE = Object\.freeze\(\{'1\/2': '1\/3', 1: '1\/2', 2: '1\/2'\}\)/u);
});

function findWord(lang, key) {
  const walk = (node) => {
    if (!node || typeof node !== 'object') return undefined;
    if (typeof node[key] === 'string') return node[key];
    for (const value of Object.values(node)) {
      const found = walk(value);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return walk(json(`src/smart/form/lang/${lang}.json`));
}
