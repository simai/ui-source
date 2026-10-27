import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
  CODE_INPUT_TEXT,
  CODE_LENGTH_DEFAULT,
  CODE_LENGTH_MAX,
  CODE_MODES,
  MASK_GLYPH,
  applyEdit,
  applyPaste,
  codeInputMode,
  codeLength,
  codeMode,
  codePattern,
  currentCell,
  normaliseCode,
  positionWords,
} from '../src/smart/code-input/code.mjs';

// sf-code-input (owner, 2026-10-25): a one-time code as a form field with its
// own value, paste and errors, drawn as the class verification
// (src/component/verification) so its styles apply and are not forked. What a
// reader of the source cannot tell from one file is held here; the page itself
// is measured by tests/browser/code-input-smart.browser.mjs.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/code-input/index.js');
const template = read('src/smart/code-input/js/templates/default.js');
const sheet = read('src/smart/code-input/scss/_smart__code_input.scss');
const classSheet = read('src/component/verification/scss/_css__verification.scss');
const classRuntime = read('src/component/verification/js/_verification.js');
const manifest = JSON.parse(read('src/smart/code-input/smart.manifest.json'));

test('code input: a mode keeps its characters, a code its length', () => {
  assert.equal(CODE_LENGTH_DEFAULT, 6);
  assert.equal(CODE_LENGTH_MAX, 12);
  assert.deepEqual([...CODE_MODES], ['numeric', 'alphanumeric']);
  assert.equal(normaliseCode('12-34 56 78', 'numeric', 6), '123456');
  assert.equal(normaliseCode('ab-12 Ц9!', 'alphanumeric', 6), 'ab129');
  assert.equal(normaliseCode('١٢٣ 123', 'numeric', 6), '123', 'only ASCII digits');
  for (const [given, length] of [[undefined, 6], ['', 6], ['0', 6], ['-3', 6], ['4', 4], ['40', 12], ['x', 6]]) {
    assert.equal(codeLength(given), length, String(given));
  }
  assert.equal(codeMode('ALPHANUMERIC'), 'alphanumeric');
  assert.equal(codeMode('text'), 'numeric', 'the class text mode is not a one-time code');
  assert.equal(codePattern('numeric', 6), '[0-9]{6}');
  assert.equal(codePattern('alphanumeric', 4), '[A-Za-z0-9]{4}');
  assert.equal(codeInputMode('numeric'), 'numeric');
  assert.equal(codeInputMode('alphanumeric'), 'text');
  assert.equal(currentCell(0, 6), 0);
  assert.equal(currentCell(6, 6), 5, 'a whole code keeps the caret in the last cell');
  assert.equal(currentCell(Number.NaN, 6), 0);
  assert.equal(MASK_GLYPH, '•');
});

test('code input: typing fills a cell, over a filled one, never past the end', () => {
  const edit = (previous, raw, caret, data, selection = null) =>
    applyEdit({previous, raw, caret, data, inputType: 'insertText', selection, mode: 'numeric', length: 6});
  // At the end: the next cell.
  assert.deepEqual(edit('12', '123', 3, '3'), {value: '123', caret: 3});
  // Into a filled cell: it takes the cell's place, the code is not pushed along.
  assert.deepEqual(edit('1234', '19234', 2, '9', {start: 1, end: 1}), {value: '1934', caret: 2});
  assert.deepEqual(edit('123456', '9123456', 1, '9', {start: 0, end: 0}), {value: '923456', caret: 1});
  // After a whole code: the last cell.
  assert.deepEqual(edit('123456', '1234567', 7, '7', {start: 6, end: 6}), {value: '123457', caret: 6});
  // Over a selection: the selection goes, as in any field.
  assert.deepEqual(edit('123456', '9', 1, '9', {start: 0, end: 6}), {value: '9', caret: 1});
  // A character the mode does not keep changes nothing.
  assert.deepEqual(edit('12', '1a2', 2, 'a', {start: 1, end: 1}), {value: '12', caret: 1});
  // A whole code inserted at once -- autofill, WebOTP -- replaces the value.
  assert.deepEqual(applyEdit({previous: '12', raw: '12654321', caret: 8, data: '654321', inputType: 'insertReplacementText', mode: 'numeric', length: 6}),
    {value: '654321', caret: 6});
  // Deleting is the browser's edit: Backspace before the caret, no gaps.
  assert.deepEqual(applyEdit({previous: '1234', raw: '134', caret: 1, data: null, inputType: 'deleteContentBackward', mode: 'numeric', length: 6}),
    {value: '134', caret: 1});
});

test('code input: a pasted code fills every cell, a part goes in at the caret', () => {
  const paste = (previous, text, start, end = start) => applyPaste({previous, text, start, end, mode: 'numeric', length: 6});
  assert.deepEqual(paste('', '123 456', 0), {value: '123456', caret: 6});
  assert.deepEqual(paste('98', 'Ваш код: 123-456. Никому не сообщайте.', 2), {value: '123456', caret: 6}, 'whole, wherever the caret was');
  assert.deepEqual(paste('12', '34', 2), {value: '1234', caret: 4});
  assert.deepEqual(paste('1299', '34', 2, 4), {value: '1234', caret: 4});
  assert.equal(paste('12', 'нет цифр', 2), null);
  assert.deepEqual(applyPaste({previous: '', text: 'ab-12-cd-99', start: 0, mode: 'alphanumeric', length: 6}), {value: 'ab12cd', caret: 6});
});

test('code input: each cell is spoken by its place, in Russian and English', () => {
  assert.equal(positionWords(CODE_INPUT_TEXT.ru.digit, 2, 6), 'цифра 3 из 6');
  assert.equal(positionWords(CODE_INPUT_TEXT.en.digit, 0, 4), 'digit 1 of 4');
  assert.equal(positionWords(CODE_INPUT_TEXT.ru.character, 5, 6), 'символ 6 из 6');
  assert.equal(positionWords(CODE_INPUT_TEXT.en.character, 1, 8), 'character 2 of 8');
  assert.deepEqual(Object.keys(CODE_INPUT_TEXT.ru), Object.keys(CODE_INPUT_TEXT.en));
  // The words the element says are its language files' (standard 1.3.8 §11),
  // the same as code.mjs keeps for these unit checks.
  assert.match(source, /text\(key\) \{\n    return this\.sfWord\(key\);/u);
  for (const lang of ['ru', 'en']) assert.deepEqual(JSON.parse(read(`src/smart/code-input/lang/${lang}.json`)).runtime, CODE_INPUT_TEXT[lang], lang);
  assert.match(source, /this\.text\(this\.mode === 'numeric' \? 'digit' : 'character'\)/u);
});

test('code input: the class markup, one native input, the class runtime kept off it', () => {
  for (const part of ['sf-verification-form', 'sf-verification-form-label', 'sf-verification-input', 'sf-verification-cells', 'sf-verification-cell', 'sf-verification-form-hint']) {
    assert.ok(template.includes(part), part);
  }
  assert.match(template, /`sf-verification-form--size-\$\{size\}`/u);
  assert.match(template, /`sf-verification--size-\$\{size\}`/u);
  assert.match(template, /filled \? 'sf-verification--filled' : ''/u);
  assert.equal((template.match(/<input\b/gu) || []).length, 1, 'one native input');
  assert.match(template, /autocomplete="one-time-code"/u);
  assert.match(template, /inputmode=\$\{inputMode\}/u);
  assert.match(template, /pattern=\$\{pattern\}/u);
  assert.match(template, /dir="ltr"/u);
  assert.match(template, /type=\$\{mask \? 'password' : 'text'\}/u);
  assert.match(template, /<span class="sf-verification-cells" aria-hidden="true">/u);
  // The cells are drawn empty; the element writes the code into them.
  assert.match(template, /html`<span class="sf-verification-cell"><\/span>`/u);
  // Every size is one the class sheet draws, and the field sizes are sf-input's.
  for (const size of manifest.inputs.properties.size.enum) {
    assert.ok(classSheet.includes(`.sf-verification--size-${size.replace('/', '\\/')}`), size);
  }
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/2', '1', '2']);
  assert.match(source, /fieldSize\(this\.getAttribute\('size'\) \|\| '1', 'sf-code-input'\)/u);
  // The class runtime binds nothing to a field another owner draws.
  assert.match(template, /data-sf-verification-owner="smart"/u);
  assert.match(classRuntime, /function ownedElsewhere\(root\) \{\n  return Boolean\(root\?\.dataset\?\.sfVerificationOwner\);/u);
  assert.match(classRuntime, /if \(!root \|\| ownedElsewhere\(root\)\) return null;/u);
});

test('code input: a group named by the label, the field described by the caret\'s cell and the message', () => {
  assert.match(template, /role="group"\n\s+aria-labelledby=\$\{hasLabel \? labelId : nothing\}\n\s+aria-label=\$\{hasLabel \? nothing : groupLabel\}/u);
  assert.match(template, /<label class="sf-verification-form-label" id=\$\{labelId\} for=\$\{field\.controlId\}>/u);
  assert.match(template, /const describedBy = \[positionId, messageContent \? field\.messageId : ''\]/u);
  assert.match(template, /<span class="sr-only sf-code-input-position" id=\$\{positionId\} aria-live="polite"><\/span>/u);
  assert.match(template, /aria-invalid=\$\{field\.invalid \? 'true' : nothing\}/u);
  assert.match(template, /aria-errormessage=\$\{messageIsError \? field\.messageId : nothing\}/u);
  assert.match(source, /createFieldContract\(this, \{\n\s+prefix: 'sf-code-input',/u);
  assert.equal(manifest.accessibility.role, 'group');
  assert.deepEqual(manifest.accessibility.keyboard, ['Tab', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
});

test('code input: input and change are the native input\'s, complete once per code', () => {
  // The edit is set right before the host's listeners hear it: a capture
  // listener on the host.
  assert.match(source, /this\.addEventListener\('input', this\.onInput, true\);/u);
  assert.match(source, /input\.dispatchEvent\(new InputEvent\('input', \{bubbles: true, inputType: 'insertFromPaste'\}\)\);/u);
  assert.match(source, /if \(changed && !this\._changeSent\) input\.dispatchEvent\(new Event\('change', \{bubbles: true\}\)\);/u);
  // The fact `completed` (sf-code-input-completed); the old
  // sf-code-input:complete follows it with the same detail (aliases.json).
  assert.match(source, /setTimeout\(\(\) => this\.sfEmit\('completed', \{value\}\), 0\);/u);
  assert.ok(JSON.parse(read('src/smart/code-input/aliases.json')).aliases.some((row) => row.from === 'sf-code-input:complete' && row.to === 'sf-code-input-completed' && row.mode === 'same-detail'));
  assert.match(source, /if \(this\._completed !== value\) \{/u);
  const sent = new Set([...source.matchAll(/new (?:Custom|Input)?Event\('([^']+)'/gu)].map((match) => match[1]));
  // A declared event sent by its verb (sfEmit) has the DOM name <tag>-<verb>,
  // and its dated old names follow it (standard 1.3.8 §8, §16.20).
  for (const [, verb] of source.matchAll(/this\.sfEmit\('([a-z-]+)'/gu)) sent.add(`sf-code-input-${verb}`);
  for (const row of JSON.parse(read('src/smart/code-input/aliases.json')).aliases) if (row.kind === 'event' && sent.has(row.to)) sent.add(row.from);
  assert.deepEqual(Object.keys(manifest.events).sort(), [...sent].sort());
  // The element never submits a form or checks a code, and goes nowhere.
  assert.doesNotMatch(source, /\.submit\(|requestSubmit|\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|innerHTML|unsafeHTML/u);
  for (const method of Object.keys(manifest.methods).filter((name) => name !== 'focus')) {
    assert.match(source, new RegExp(`\\n  ${method}\\(\\) \\{`, 'u'), method);
  }
  assert.match(source, /focusDelegate\(\) \{\n    return this\.getInputElement\(\);/u);
});

test('code input: its own sheet draws only the required star, from tokens', () => {
  const rules = sheet.replace(/\/\/.*$/gmu, '');
  assert.doesNotMatch(rules, /sf-verification-cell|block-size|inline-size|border|background|padding|font-size/u);
  assert.doesNotMatch(rules, /\b\d+(?:\.\d+)?(?:px|rem|em|ms)\b/u);
  assert.doesNotMatch(rules, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
  assert.match(sheet, /\.sf-verification-form \.sf-code-input-required \{[^}]*color: var\(--sf-error\);/u);
});

test('code input: the loader knows it and asks for what it draws with', () => {
  const rule = read('src/smart/code-input/rule.js');
  assert.match(rule, /SF\.RuleLoader\['cl-code-input'\] = \{\n  tags: \['sf-code-input'\],/u);
  assert.match(rule, /\{ name: 'verification' \},\n    \{ name: 'sr-only\/default' \},/u);
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/code-input\/rule\.js';/u);
  assert.deepEqual(manifest.composition.uses, ['component.verification']);
  assert.deepEqual(manifest.inputs.properties.mode.enum, [...CODE_MODES]);
  assert.equal(manifest.inputs.properties.length.default, String(CODE_LENGTH_DEFAULT));
});

// The public variables (2026-10-25): seven, read by the class sheet that
// sf-code-input draws with, each with the value it drew before as its fallback.
test('code input: the class verification\'s public variables wrap the values it drew before', () => {
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const entry = contract.components.find((one) => one.component === 'verification');
  assert.equal(entry.selector, '.sf-verification');
  // Seven from 2026-10-25, and the invalid state's own (standard 1.3.8 §6).
  assert.equal(entry.variables.length, 8);
  for (const variable of entry.variables) assert.equal(variable.since, variable.state ? '2026-10-27' : '2026-10-25', variable.name);
  for (const line of [
    '--sf-verification--cell-size: var(--sf-verification-cell-size, var(--sf-title-height-6));',
    '--sf-verification--gap: var(--sf-verification-gap, var(--sf-space-1\\/3));',
    '--sf-verification--radius: var(--sf-verification-radius, var(--sf-radius--ui));',
    '--sf-verification--border-width: var(--sf-verification-border-width, var(--sf-px));',
    'solid var(--sf-verification-border-color, var(--sf-outline));',
    'background: var(--sf-verification-background-color, var(--sf-surface-0));',
    'background: var(--sf-verification-background-color, var(--sf-surface-container));',
    'color: var(--sf-verification-color, var(--sf-on-surface));',
    '--sf-verification--cell-size: var(--sf-verification-cell-size, var(--sf-title-height-4));',
    '--sf-verification--cell-size: var(--sf-verification-cell-size, var(--sf-title-height-7));',
  ]) assert.ok(classSheet.includes(line), line);
  // Hover, the current cell, error and disabled write their own.
  for (const state of ['.sf-verification-cell.current {', '.sf-verification-form-wrap .sf-verification:hover {']) {
    assert.doesNotMatch(classSheet.slice(classSheet.indexOf(state)).split('}')[0], /--sf-verification-[a-z]+-?[a-z]*[,)]/u, state);
  }
  const docs = read('src/smart/code-input/docs.md');
  for (const variable of entry.variables) assert.ok(docs.includes(`| \`${variable.name}\` |`), variable.name);
});
