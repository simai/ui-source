import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {acceptsFile, formatFileSize, normaliseImageValue} from '../src/smart/image-field/value.mjs';
import {FIELD_SIZES} from '../src/component/field-size.js';

// sf-image-field (simai/ui-source#27): one image in a form -- a thumbnail with
// its name and size, «Заменить…» and «Убрать», a file dropped on it replaces
// the image. ui-mail's polish audit (2026-10-22, B1) found nothing in the
// Framework for it. What a reader of the source cannot tell from one file is
// held here; the page itself is measured by tests/browser/image-field.browser.mjs.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/image-field/index.js');
const template = read('src/smart/image-field/js/templates/default.js');
const sheet = read('src/smart/image-field/scss/_smart__image_field.scss');
const manifest = JSON.parse(read('src/smart/image-field/smart.manifest.json'));

test('image field: the value is the Framework\'s file shape, from an object, JSON or an address', () => {
  const stored = {value: 42, label: 'logo.png', mime: 'image/png', size: 2048, href: '/upload/logo.png'};
  assert.deepEqual(normaliseImageValue(stored), {value: '42', label: 'logo.png', mime: 'image/png', size: 2048, href: '/upload/logo.png'});
  assert.deepEqual(normaliseImageValue(JSON.stringify(stored)), normaliseImageValue(stored));
  // A bare address names the file by its last segment, so the thumbnail still
  // has an alt and the row a name.
  assert.deepEqual(normaliseImageValue('/upload/brand%20logo.svg?v=3'), {value: '', label: 'brand logo.svg', mime: '', size: '', href: '/upload/brand%20logo.svg?v=3'});
  // The same keys the field renderers' file cell reads ({value, label, mime,
  // href}), plus the size sf-file-preview shows.
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /file\s+\{value, label, mime\?, href\?\}/u);
  for (const empty of [null, undefined, '', '   ', '{not json', [], {}]) assert.equal(normaliseImageValue(empty), null, JSON.stringify(empty));
  const file = {name: 'x.png'};
  assert.equal(normaliseImageValue({label: 'x.png', file}).file, file, 'a chosen file keeps its File');
});

test('image field: a drop takes what the dialog would have offered, images by default', () => {
  const png = {name: 'logo.PNG', type: 'image/png'};
  const pdf = {name: 'brief.pdf', type: 'application/pdf'};
  assert.ok(acceptsFile('image/*', png));
  assert.ok(!acceptsFile('image/*', pdf));
  assert.ok(acceptsFile('.png, .svg', png), 'an extension is matched without case');
  assert.ok(acceptsFile('', pdf), 'an empty list takes any file');
  assert.equal(manifest.inputs.properties.accept.default, 'image/*');
  assert.match(source, /const DEFAULT_ACCEPT = 'image\/\*';/u);
  assert.equal(JSON.parse(read('src/smart/image-field/component.json')).settings.accept.default, 'image/*');
  // A refused drop is said, not silently dropped: rejected (standard 1.3.8,
  // vocabulary §9.1), and sf-image-field:reject after it (aliases.json).
  assert.match(source, /reject\(rejected, 'drop'\)/u);
  assert.match(source, /this\.sfEmit\('rejected', /u);
});

test('image field: a size reads in the page\'s language', () => {
  assert.equal(formatFileSize(2048, ['Б', 'КБ', 'МБ', 'ГБ'], 'ru'), '2 КБ');
  assert.equal(formatFileSize(1468006, ['Б', 'КБ', 'МБ', 'ГБ'], 'ru'), '1,4 МБ');
  assert.equal(formatFileSize(512, ['B', 'KB', 'MB', 'GB'], 'en'), '512 B');
  assert.equal(formatFileSize('2 KB'), '2 KB', 'text the host formatted is kept');
  assert.equal(formatFileSize(null), '');
  assert.equal(formatFileSize(-1), '');
});

test('image field: the words are Russian and English, and the visible words begin each name', () => {
  // The words are the language files' (standard 1.3.8 §11).
  const ru = JSON.parse(read('src/smart/image-field/lang/ru.json')).runtime;
  const en = JSON.parse(read('src/smart/image-field/lang/en.json')).runtime;
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  for (const [key, word] of [['replace', 'Заменить…'], ['remove', 'Убрать'], ['choose', 'Выбрать…'], ['replace-name', 'Заменить изображение'], ['remove-name', 'Убрать изображение'], ['quoted', '«%s»']]) {
    assert.equal(ru[key], word, key);
  }
  assert.match(source, /return this\.sfWord\(kebab\(key\)\);/u);
});

test('image field: buttons are real buttons named for what they act on, the thumbnail has alt', () => {
  for (const kind of ['replace', 'remove', 'choose']) {
    assert.match(template, new RegExp(`<sf-button class="sf-image-field-${kind}"[^>]*aria-label=\\$\\{names\\.${kind}\\}`, 'u'), kind);
  }
  assert.match(source, /replace: fileName \? `\$\{words\.replaceName\} \$\{this\.quote\(fileName\)\}`/u);
  assert.match(template, /<img class="sf-image-field-image" src=\$\{href\} alt=\$\{context\.fileName\}/u);
  // A group named by the label, described by the help or the error.
  assert.match(template, /role="group"\s+aria-labelledby=\$\{context\.label \? labelId : nothing\}\s+aria-label=\$\{context\.label \? nothing : context\.names\.group\}\s+aria-describedby=\$\{context\.message \? field\.messageId : nothing\}\s+aria-invalid=/u);
  // The drop target takes no focus: Tab goes through the buttons and out.
  const well = template.slice(template.indexOf('<div class="sf-image-field-well"'), template.indexOf('<span class="sf-image-field-thumb">'));
  assert.doesNotMatch(well, /tabindex/u);
  // The platform input is out of the tab order and out of sight, not
  // display: none, so the browser can still point at a required, empty field.
  assert.match(template, /class="sf-image-field-input"[\s\S]*?tabindex="-1"[\s\S]*?aria-hidden="true"[\s\S]*?\?required=\$\{field\.required && !value\}/u);
  assert.doesNotMatch(template, /class="sf-image-field-input"[^>]*\shidden/u);
  assert.match(sheet, /\.sf-image-field-input,\n\.sf-image-field-live \{\n  position: absolute;/u);
  // State changes are said in a polite status, as sf-help-mark says its own.
  assert.match(template, /class="sf-image-field-live" role="status" aria-live="polite" aria-atomic="true"/u);
  for (const said of ["text('chosen')", "text('removed')", "text('rejected')"]) assert.ok(source.includes(said), said);
  // After «Убрать» the focus goes to «Выбрать…», not to the page.
  assert.match(source, /this\._focusAfterRender = 'choose';/u);
  assert.match(source, /focusDelegate\(\) \{\n    return this\.querySelector\(':scope \.sf-image-field-actions button:not\(\[disabled\]\)'\);/u);
});

test('image field: input and change once each per choice or removal, with the File; code is not a change', () => {
  // Under their native names through sfEmit (core/js/element-manifest.js eventName).
  assert.match(source, /for \(const type of \['input', 'change'\]\) this\.sfEmit\(type, \{value, file, source, name: this\.name\}\);/u);
  // The platform input's own change and input stop at the host.
  assert.match(source, /onInputChange\(event\) \{\n    event\.stopPropagation\(\);/u);
  assert.match(source, /onInputEvent\(event\) \{\n    event\.stopPropagation\(\);/u);
  // setValue writes and draws; it dispatches nothing.
  const setValue = source.slice(source.indexOf('  setValue(next) {'), source.indexOf('  // What the form gets'));
  assert.ok(setValue.includes('this._value = value;'), 'the slice is setValue');
  assert.doesNotMatch(setValue, /dispatchEvent|_emitValue/u);
  // It does not upload: no request leaves the component.
  assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon/u);
  // The manifest says the same events the source sends: its own, those it
  // sends by verb (sfEmit), and the old names the shim sends after them.
  const sent = new Set([...source.matchAll(/new CustomEvent\('([^']+)'/gu)].map((match) => match[1]));
  for (const [, verb] of source.matchAll(/this\.sfEmit\('([^']+)'/gu)) sent.add(`sf-image-field-${verb}`);
  for (const row of JSON.parse(read('src/smart/image-field/aliases.json')).aliases) if (row.kind === 'event') sent.add(row.from);
  sent.add('input').add('change');
  assert.deepEqual(Object.keys(manifest.events).sort(), [...sent].sort());
  assert.equal(manifest.events.change.canonical, true);
  const axes = JSON.parse(read('contracts/public-api-axes.json')).change_event.controls;
  assert.ok(axes.includes('image-field'));
});

test('image field: sizes are the form sizes and every measure is a ladder step', () => {
  assert.deepEqual(manifest.inputs.properties.size.enum, [...FIELD_SIZES]);
  assert.match(source, /fieldSize\(this\.getAttribute\('size'\) \|\| '1', 'sf-image-field'\)/u);
  // The thumbnail is the control height one rung up; the inset the field's
  // own vertical padding; the buttons one rung down.
  const rungs = {'1\\/2': ['1\\/2', '1'], '1': ['1', '2'], '2': ['2', '3']};
  for (const [size, [own, up]] of Object.entries(rungs)) {
    const block = sheet.slice(sheet.indexOf(`.sf-image-field--size-${size} {`)).split('}')[0];
    assert.ok(block.includes(`--sf-image-field--inset: calc(var(--sf-ui-${own}--space-y-tightness-default) - var(--sf-px));`), size);
    assert.ok(block.includes(`--sf-image-field--thumb: var(--sf-ui-${up}--control-height);`), size);
  }
  assert.match(template, /const BUTTON_SIZE = \{'1\/2': '1\/3', '1': '1\/2', '2': '1'\};/u);
  // No length written by hand: every width, height, gap and padding is a token.
  assert.doesNotMatch(sheet.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/@container[^{]*\{/u, ''), /:\s*[^;]*\b\d+(?:\.\d+)?(?:px|rem|em)\b/u);
  // The image is fitted, never stretched.
  assert.match(sheet, /\.sf-image-field-image \{[^}]*object-fit: contain;/u);
});

test('image field: the loader knows it and asks for what it draws with', () => {
  const rule = read('src/smart/image-field/rule.js');
  assert.match(rule, /SF\.RuleLoader\['cl-image-field'\] = \{\n  tags: \['sf-image-field'\],/u);
  assert.match(rule, /\{ name: 'cl-buttons' \},\n    \{ name: 'cl-icons' \},/u);
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/image-field\/rule\.js';/u);
  assert.deepEqual(manifest.composition.uses, ['smart.buttons', 'smart.icons']);
});

// The public variables (2026-10-24): ten, each read with the value the field
// drew before it existed as its fallback, so a page that sets none sees no
// change. The states write the internal names, so a drag-over, an error and a
// disabled field keep their own colours over a customised resting one.
test('image field: the public variables wrap the values it drew before', () => {
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const entry = contract.components.find((one) => one.component === 'image-field');
  assert.equal(entry.selector, '.sf-image-field');
  assert.equal(entry.variables.length, 10);
  for (const variable of entry.variables) assert.equal(variable.since, '2026-10-24', variable.name);
  for (const line of [
    '--sf-image-field--border-color: var(--sf-image-field-border-color, var(--sf-outline));',
    '--sf-image-field--background-color: var(--sf-image-field-background-color, var(--sf-surface-0));',
    'column-gap: var(--sf-image-field-gap, var(--sf-image-field--inset));',
    'padding-block: var(--sf-image-field-padding-block, var(--sf-image-field--inset));',
    'padding-inline: var(--sf-image-field-padding-inline, var(--sf-image-field--inset));',
    'border: var(--sf-image-field-border-width, var(--sf-px)) var(--sf-image-field--border-style) var(--sf-image-field--border-color);',
    'border-radius: var(--sf-image-field-radius, var(--sf-radius--ui));',
    'inline-size: var(--sf-image-field-thumbnail-size, var(--sf-image-field--thumb));',
    'block-size: var(--sf-image-field-thumbnail-size, var(--sf-image-field--thumb));',
    'border-radius: var(--sf-image-field-thumbnail-radius, var(--sf-radius--ui));',
    'background-color: var(--sf-image-field-thumbnail-background-color, var(--sf-surface-container));',
  ]) assert.ok(sheet.includes(line), line);
  // The states set the internal names only.
  for (const state of ['.sf-image-field.dragover {', '.sf-image-field.error {', '.sf-image-field.disabled {']) {
    const block = sheet.slice(sheet.indexOf(state)).split('}')[0];
    assert.doesNotMatch(block, /--sf-image-field-[a-z]/u, state);
  }
  // The docs list every one of them.
  const docs = read('src/smart/image-field/docs.md');
  for (const variable of entry.variables) assert.ok(docs.includes(`| \`${variable.name}\` |`), variable.name);
});
