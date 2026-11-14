// A combination in running text (owner decision C191 (9) and (10),
// 2026-11-15): <kbd data-sf-shortcut="mod+k"> is filled by the kbd
// component's script with the shared helper's caps, and the names of the keys
// are read in their place in the page's language. The browser half is
// tests/browser/kbd-shortcut-text.browser.mjs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('The names of the keys follow the caps the shared helper prints, on either platform', async () => {
  const {shortcutView} = await import('../src/component/kbd/js/shortcut.js');
  const {spokenText} = await import('../src/component/kbd/js/spoken.js');
  const en = JSON.parse(await read('src/component/kbd/lang/en.json')).runtime;
  const ru = JSON.parse(await read('src/component/kbd/lang/ru.json')).runtime;
  const said = (value, apple, words) => spokenText(shortcutView(value, apple).keys, (word) => words[word]);
  assert.equal(said('mod+k', true, ru), 'Command K');
  assert.equal(said('mod+k', false, ru), 'Ctrl K');
  assert.equal(said('shift+mod+z', true, en), 'Shift Command Z');
  assert.equal(said('shift+mod+z', false, en), 'Ctrl Shift Z');
  assert.equal(said('alt+ctrl+delete', true, en), 'Control Option Delete');
  assert.equal(said('alt+delete', false, en), 'Alt Delete');
  assert.equal(said('enter', true, ru), 'Ввод');
  assert.equal(said('enter', false, en), 'Enter');
  assert.equal(said('up', false, ru), 'Стрелка вверх');
  assert.equal(said('down', true, en), 'Down Arrow');
  assert.equal(said('escape', false, ru), 'Escape');
  assert.equal(said('tab', false, ru), 'Tab');
  assert.equal(said('space', false, ru), 'Пробел');
  assert.equal(said('backspace', true, en), 'Backspace');
  assert.equal(said('meta+k', false, en), 'Windows K');
  assert.equal(said('mod+plus', true, ru), 'Command Плюс');
  assert.equal(said('F2', true, en), 'F2');
  assert.equal(said('shift+/', false, en), 'Shift /');
  // Text a page wrote for people is read sign by sign.
  assert.equal(said('⇧⌘L', false, ru), 'Shift Command L');
  assert.equal(said('', true, ru), '');
});

test('The kbd words are in the language files, the same keys in every language', async () => {
  const en = JSON.parse(await read('src/component/kbd/lang/en.json'));
  const ru = JSON.parse(await read('src/component/kbd/lang/ru.json'));
  assert.deepEqual(Object.keys(ru.runtime).sort(), Object.keys(en.runtime).sort());
  for (const key of ['command', 'option', 'control', 'shift', 'ctrl', 'alt', 'enter', 'escape', 'tab', 'up', 'down', 'left', 'right', 'backspace', 'delete', 'space']) {
    assert.ok(en.runtime[key] && ru.runtime[key], key);
  }
  assert.equal(ru.runtime.enter, 'Ввод');
  assert.equal(ru.runtime.up, 'Стрелка вверх');
  assert.equal(en.runtime.command, 'Command');
});

test('The kbd script fills data-sf-shortcut through the shared helper, hides the caps and follows added markup and the language', async () => {
  const [index, script, rule, sheet] = await Promise.all([
    read('src/component/kbd/index.js'),
    read('src/component/kbd/js/index.js'),
    read('src/component/kbd/rule.js'),
    read('src/component/kbd/scss/_kbd.scss'),
  ]);
  assert.match(index, /import '\.\/js\/index\.js'/u);
  assert.match(rule, /js:\s*true/u);
  assert.match(script, /import \{isApplePlatform, shortcutView\} from '\.\/shortcut\.js'/u);
  assert.match(script, /kbd\[data-sf-shortcut\]/u);
  assert.match(script, /setAttribute\('aria-hidden', 'true'\)/u);
  assert.match(script, /sf-kbd-spoken/u);
  assert.match(script, /sf-kbd-join/u);
  assert.match(script, /new MutationObserver/u);
  assert.match(script, /attributeFilter: \[ATTRIBUTE, 'lang'\]/u);
  assert.match(script, /SF\?\.language\?\.onChange/u);
  assert.match(script, /'sf-kbd'/u);
  // Until filled an empty one draws no plate; the words take no room.
  assert.match(sheet, /:where\(kbd\[data-sf-shortcut\]:empty\) \{\s*display: none;/u);
  const words = sheet.slice(sheet.indexOf(':where(.sf-kbd-spoken)'));
  assert.match(words, /position: absolute;/u);
  assert.match(words, /clip-path: inset\(50%\);/u);
});
