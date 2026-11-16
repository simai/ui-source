/* global URL */
// A tooltip whose words the trigger's name already says is not the trigger's
// description (2026-11-16, sf-file-download's icon Retry «Повторить
// Отчёт.xlsx» with the tooltip «Повторить», heard twice). The rule is one pure
// module the tooltip controller and sf-button-icon's name tooltip share; the
// accessibility tree is read in a browser by
// tests/browser/tooltip-name-repeat.browser.mjs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const {repeatsName} = await import(new URL('../src/component/tooltip/js/_name-repeat.js', import.meta.url));

test('a tooltip equal to the name, or whole words of it, repeats the name', () => {
  assert.equal(repeatsName('Повторить', 'Повторить'), true);
  assert.equal(repeatsName('Повторить Отчёт о продажах.xlsx', 'Повторить'), true);
  assert.equal(repeatsName('Retry  report.pdf', 'retry'), true);
  assert.equal(repeatsName('Уведомления, 5 непрочитанных', 'Уведомления'), true);
  assert.equal(repeatsName('Скачать Отчёт.xlsx', 'Отчёт.xlsx'), true);
  assert.equal(repeatsName('Открыть настройки', 'открыть   настройки'), true);
});

test('a tooltip that says more, or part of a word, is still the description', () => {
  assert.equal(repeatsName('Редактировать', 'Ред'), false);
  assert.equal(repeatsName('Повторить', 'Повторить загрузку'), false);
  assert.equal(repeatsName('Тема', 'Тема: светлая, далее тёмная'), false);
  assert.equal(repeatsName('Bold', 'Makes the selection bold'), false);
  assert.equal(repeatsName('', 'Повторить'), false);
  assert.equal(repeatsName('Повторить', ''), false);
  // Characters of a regular expression are words, not syntax.
  assert.equal(repeatsName('Размер (КБ)', '(КБ)'), true);
  assert.equal(repeatsName('Размер КБ', '.*'), false);
});

test('the controller links the description only when the tooltip says more than the name', async () => {
  const source = await read('src/component/tooltip/js/_tooltip.js');
  assert.match(source, /import \{ repeatsName, triggerName, tooltipText \} from '\.\/_name-repeat\.js';/u);
  assert.match(source, /if \(repeatsName\(triggerName\(this\.trigger, this\.surface\), tooltipText\(this\.surface\)\)\) descriptions\.delete\(this\.surface\.id\);\s*else descriptions\.add\(this\.surface\.id\);/u);
  // Read when the link is made and again when the tooltip opens.
  assert.equal(source.match(/this\.syncDescription\(\);/gu)?.length, 2);
  assert.doesNotMatch(source, /squash\(this\.surface\.textContent\) === name/u);
});

test('the name reads aria-labelledby, aria-label, then the trigger\'s own words without hidden parts', async () => {
  const source = await read('src/component/tooltip/js/_name-repeat.js');
  assert.match(source, /aria-labelledby/u);
  assert.match(source, /child\.hidden \|\| child\.getAttribute\?\.\('aria-hidden'\) === 'true'/u);
  assert.match(source, /\.sf-tooltip-shortcut, \.sf-tooltip-tail/u);
});

test('sf-button-icon says no description its name already says before its tooltip is made', async () => {
  const source = await read('src/smart/button-icon/index.js');
  assert.match(source, /import \{ repeatsName \} from '\.\.\/\.\.\/component\/tooltip\/js\/_name-repeat\.js';/u);
  assert.match(source, /if \(!tip && !repeatsName\(name, said\)\) button\.setAttribute\('aria-description', said\);/u);
});
