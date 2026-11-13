// sf-input-image 1.4.0 (study R176, defects IF-1..IF-16, owner decision C94):
// the element's own methods run over a stub host -- attributes in a map, the
// events and the validity recorded -- so what the field takes, refuses, says
// and sends is measured rather than matched in the source. The template and
// the sheet are read for what only they decide (which buttons, which words).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import * as value from '../src/smart/input-image/value.mjs';
import {acceptFormats, acceptsFile, fileRejection} from '../src/component/file-upload/js/intake.mjs';
import {fileNameFromAddress} from '../src/core/js/composition/file-size.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('src/smart/input-image/index.js');
const template = await read('src/smart/input-image/js/templates/default.js');
const sheet = await read('src/smart/input-image/scss/_smart__image_field.scss');
const renderers = await read('src/smart/field-renderers/index.js');
const manifest = JSON.parse(await read('src/smart/input-image/component.json'));
const inputs = await read('src/component/inputs/scss/_css__inputs.scss');
const generated = JSON.parse(await read('src/smart/input-image/smart.manifest.json'));
const ru = JSON.parse(await read('src/smart/input-image/lang/ru.json')).runtime;
const en = JSON.parse(await read('src/smart/input-image/lang/en.json')).runtime;

const helpers = source.slice(source.indexOf('const WORD_KEYS'), source.indexOf('// sf-input-image from its component.json'));
const classHead = 'class SfImageField extends FormField(ImageFieldElement) {';
const classText = source.slice(source.indexOf(classHead) + classHead.length, source.indexOf('SfImageField.define('));
const body = classText.slice(0, classText.lastIndexOf('}'));

const fill = (text, vars = {}) => String(text).replace(/\{(\w+)\}/gu, (_, key) => (vars[key] ?? `{${key}}`));

// An image the stub "loads": the pixels the test gives the address.
function imageClass(sizes) {
  return class FakeImage {
    set src(href) {
      const size = sizes.get(href) ?? sizes.get('*');
      queueMicrotask(() => {
        if (size) {
          this.naturalWidth = size.width;
          this.naturalHeight = size.height;
          this.onload?.();
        } else this.onerror?.();
      });
    }
  };
}

function host(attributes = {}, {sizes = new Map(), coarse = false} = {}) {
  const context = vm.createContext({
    ...value,
    en: {runtime: en},
    console,
    URL,
    File,
    Promise,
    AbortController,
    queueMicrotask,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: () => {},
    Image: imageClass(sizes),
    globalThis: {matchMedia: () => ({matches: coarse, addEventListener() {}, removeEventListener() {}})},
    customElements: {whenDefined: () => Promise.resolve()},
    tagSelector: (tag) => tag,
    fieldSize: (size) => String(size || '1'),
    FIELD_SIZES: ['1/2', '1', '2'],
    instancePath: () => 'x',
    partId: () => 'x',
    createFieldContract: (component, options) => ({...options, messageId: 'm', controlId: 'c'}),
    words: ru,
    fill,
  });
  vm.runInContext(`
    ${helpers}
    class Base {
      static get props() { return {}; }
      constructor() {
        this.attributes = new Map();
        this.events = [];
        this.validity = null;
        this.sfCustomError = '';
        this.sfInternals = {setValidity: (flags, message) => { this.validity = {flags: {...flags}, message}; }};
      }
      addEventListener() {}
      removeEventListener() {}
      getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
      hasAttribute(name) { return this.attributes.has(name); }
      setAttribute(name, next) { this.attributes.set(name, String(next)); }
      removeAttribute(name) { this.attributes.delete(name); }
      getProp() { return ''; }
      get required() { return this.hasAttribute('required'); }
      get disabled() { return this.hasAttribute('disabled'); }
      get readonly() { return this.hasAttribute('readonly'); }
      get invalid() { return this.hasAttribute('invalid'); }
      get name() { return this.getAttribute('name') || ''; }
      get meta() { return ''; }
      get label() { return this.getAttribute('label') || ''; }
      get hint() { return this.getAttribute('hint') || ''; }
      get errorMessage() { return ''; }
      contains() { return false; }
      querySelector() { return null; }
      requestComponentUpdate() {}
      sfHostState() {}
      sfSyncFormState() { this.sfSyncValidity(); }
      sfSyncValidity() {
        const own = this.fieldValidity();
        this.validity = own.valueMissing ? {flags: {valueMissing: true}, message: own.message} : {flags: {}, message: ''};
      }
      sfEmit(verb, detail) { this.events.push([verb, detail]); return true; }
      sfWord(key, {vars} = {}) { return fill(words[key] ?? key, vars); }
      getPropsContext() { return {}; }
      createTemplateContext(context) { return context; }
      getRootClass() { return ''; }
    }
    const FormField = (B) => B;
    const ImageFieldElement = Base;
    class Host extends Base {${body}
      removeImage() { return this._removeImage(); }
      takeFile({file, source} = {}) { return this._takeFiles(file ? [file] : [], source || 'input'); }
    }
    this.Host = Host;
  `, context);
  const element = new context.Host();
  for (const [name, next] of Object.entries(attributes)) element.setAttribute(name, next);
  return element;
}

const png = (name = 'a.png', size = 2048) => new File([new Uint8Array(size)], name, {type: 'image/png', lastModified: 1});
const pdf = (name = 'scan.pdf') => new File(['%PDF'], name, {type: 'application/pdf', lastModified: 1});
const plain = (thing) => JSON.parse(JSON.stringify(thing));

test('IF-1: no drag words where the pointer is a finger', () => {
  assert.equal(ru['empty-hint'], 'Перетащите или вставьте изображение');
  assert.equal(ru['empty-hint-coarse'], 'Сфотографируйте или выберите');
  assert.doesNotMatch(ru['empty-hint-coarse'], /Перетащ/u);
  assert.match(template, /return context\.coarse \? context\.words\.emptyHintCoarse : context\.words\.emptyHint;/u);
  assert.equal(host({}, {coarse: true}).templateContext().coarse, true);
  assert.equal(host({}, {coarse: false}).templateContext().coarse, false);
});

test('IF-2: a wrong type is said under the field, with the formats, and the field shows the error', () => {
  const field = host({accept: 'image/png,image/jpeg'});
  assert.equal(field.takeFile({file: pdf(), source: 'drop'}), 'rejected');
  const context = field.templateContext();
  assert.equal(context.message, '«scan.pdf» не подходит: можно PNG, JPG');
  assert.equal(context.messageKind, 'error');
  assert.equal(context.field.invalid, true);
  const [verb, detail] = field.events.at(-1);
  assert.equal(verb, 'rejected');
  assert.deepEqual(plain(detail.rejected.map(({name, reason}) => ({name, reason}))), [{name: 'scan.pdf', reason: 'type'}]);
  assert.equal(field.value, null, 'nothing taken');
  // The next good file clears it.
  assert.equal(field.takeFile({file: png()}), 'applied');
  assert.equal(field.templateContext().messageKind, 'hint');
});

test('IF-3: of several files dropped the first image is taken, and the field says what happened to the rest', () => {
  const field = host({});
  assert.equal(field._takeFiles([pdf(), png('shoe.png'), png('bag.png'), png('cap.png')], 'drop'), 'applied');
  assert.equal(field.value.label, 'shoe.png');
  const rejected = field.events.find(([verb]) => verb === 'rejected')[1].rejected;
  assert.deepEqual(plain(rejected.map(({name, reason}) => [name, reason])), [['scan.pdf', 'type'], ['bag.png', 'count'], ['cap.png', 'count']]);
  // A wrong type is the error said; with only extra images it is information.
  assert.equal(field.templateContext().messageKind, 'error');
  const three = host({});
  three._takeFiles([png('shoe.png'), png('bag.png'), png('cap.png')], 'drop');
  assert.deepEqual([three.templateContext().message, three.templateContext().messageKind], ['Взято первое изображение из 3: в этом поле одно', 'info']);
});

test('IF-4: max-size, min-width and min-height are checked, the picture read before it is taken', async () => {
  const big = host({'max-size': String(5 * 1024 * 1024)});
  assert.equal(big.takeFile({file: png('big.png', 6 * 1024 * 1024)}), 'rejected');
  assert.equal(big.events.at(-1)[1].rejected[0].reason, 'size');
  assert.match(big.templateContext().message, /^«big\.png» — .+, а можно до .+/u);

  const sizes = new Map([['*', {width: 120, height: 80}]]);
  const narrow = host({'min-width': '800'}, {sizes});
  const answer = narrow.takeFile({file: png('small.png')});
  assert.equal(typeof answer.then, 'function', 'a promise of the outcome while the picture is read');
  assert.equal(await answer, 'rejected');
  assert.equal(narrow.value, null, 'a picture too small never shows');
  assert.equal(narrow.templateContext().message, '«small.png» — 120×80 px, а нужно от 800 px в ширину');
  assert.equal(narrow.events.at(-1)[1].rejected[0].reason, 'min-width');

  const low = host({'min-height': '600'}, {sizes});
  assert.equal(await low.takeFile({file: png('small.png')}), 'rejected');
  assert.equal(low.events.at(-1)[1].rejected[0].reason, 'min-height');

  const wide = host({'min-width': '800'}, {sizes: new Map([['*', {width: 1600, height: 900}]])});
  assert.equal(await wide.takeFile({file: png('cover.png')}), 'applied');
  assert.deepEqual([wide.value.width, wide.value.height], [1600, 900], 'the pixels go in the value');
  // The names are sf-file-upload's.
  for (const name of ['max-size', 'min-width', 'min-height']) assert.equal(manifest.settings[name].type, 'number', name);
  assert.ok(JSON.parse(await read('src/smart/file-upload/component.json')).settings['max-size']);
});

test('IF-5: a pasted picture is taken while the field has focus; text pasted is not', () => {
  const field = host({});
  let prevented = false;
  field.onPaste({clipboardData: {files: [png('pasted.png')]}, preventDefault: () => { prevented = true; }});
  assert.equal(field.value.label, 'pasted.png');
  assert.equal(prevented, true);
  assert.equal(field.events.find(([verb]) => verb === 'attach')[1].source, 'paste');
  const text = host({});
  text.onPaste({clipboardData: {files: []}, preventDefault: () => assert.fail('text paste kept')});
  assert.equal(text.value, null);
  assert.match(template, /@paste=\$\{group\.handlers\.paste\}/u);
});

test('IF-6: a required field has no remove button, and says it is empty on blur or on the form\'s check', () => {
  const field = host({required: ''});
  assert.equal(field.templateContext().removable, false);
  assert.match(template, /\$\{context\.removable\s+\? html`<sf-button-icon class="sf-image-field-remove"/u);
  assert.equal(field.templateContext().messageKind, 'hint', 'quiet before it was left');
  field._onFocusOut({relatedTarget: null});
  assert.deepEqual([field.templateContext().message, field.templateContext().messageKind], ['Выберите изображение.', 'error']);
  const checked = host({required: ''});
  checked._onInvalid();
  assert.equal(checked.templateContext().field.invalid, true);
  // A value clears it.
  checked.takeFile({file: png()});
  assert.equal(checked.templateContext().field.invalid, false);
  assert.equal(host({}).templateContext().removable, true);
});

test('IF-7: the thumbnail fills its box at the focal point; a logo is fitted; circle for a person', () => {
  assert.match(sheet, /\.sf-image-field-image \{[^}]*object-fit: cover;/u);
  assert.match(sheet, /\.sf-image-field\[data-fit="contain"\] \.sf-image-field-image \{\s*object-fit: contain;/u);
  assert.match(sheet, /\.sf-image-field\[data-shape="circle"\] \.sf-image-field-thumb \{\s*border-radius: 50%;/u);
  assert.match(template, /if \(focus && context\.fit === 'cover'\) return `object-position: \$\{pct\(focus\.x\)\} \$\{pct\(focus\.y\)\}`;/u);
  assert.deepEqual(manifest.settings.fit.values, ['cover', 'contain']);
  assert.deepEqual(manifest.settings.shape.values, ['square', 'circle']);
});

test('IF-8: a picture that may be transparent stands on the checkerboard (C86); a JPEG does not', () => {
  assert.equal(value.mayBeTransparent({mime: 'image/png'}), true);
  assert.equal(value.mayBeTransparent({mime: 'image/svg+xml'}), true);
  assert.equal(value.mayBeTransparent({mime: 'image/jpeg'}), false);
  assert.equal(value.mayBeTransparent({href: '/u/logo.svg?v=2'}), true);
  assert.equal(value.mayBeTransparent({href: 'data:image/svg+xml,%3Csvg%3E'}), true);
  assert.equal(value.mayBeTransparent({href: '/u/photo.jpg'}), false);
  assert.match(sheet, /\.sf-image-field-thumb--transparent,\n\.sf-image-field-frame--transparent \{[^}]*conic-gradient\(var\(--sf-outline-variant\) 25%, var\(--sf-transparent\) 0 50%, var\(--sf-outline-variant\) 0 75%, var\(--sf-transparent\) 0\);[^}]*background-size: var\(--sf-a8\) var\(--sf-a8\);/u);
});

test('IF-9: remove is an icon button named for the file; the size line wraps, it is not cut', () => {
  assert.match(template, /<sf-button-icon class="sf-image-field-remove" size=\$\{size\} appearance="ghost" scheme="on-surface-variant"\s+icon="delete" aria-label=\$\{names\.remove\} title=\$\{words\.remove\}/u);
  const meta = sheet.slice(sheet.indexOf('.sf-image-field-meta {')).split('}')[0];
  assert.doesNotMatch(meta, /text-overflow|nowrap/u);
  assert.match(meta, /overflow-wrap: anywhere;/u);
});

test('IF-10: read-only and disabled are drawn as sf-input draws them', () => {
  const block = (selector) => sheet.slice(sheet.indexOf(`${selector} {`)).split('}')[0];
  assert.match(block('.sf-image-field.readonly'), /--sf-image-field--border-color: var\(--sf-outline-variant\);/u);
  assert.match(block('.sf-image-field.disabled'), /--sf-image-field--background-color: var\(--sf-transparent\);\s+--sf-image-field--border-color: var\(--sf-outline-disabled\);/u);
  assert.match(inputs, /--sf-input-field--border-color: var\(--sf-outline-variant\);/u);
  assert.match(inputs, /--sf-input-field--border-color: var\(--sf-outline-disabled\);/u);
});

test('IF-11: the picture\'s alt is its description, never the file name; the value carries alt and decorative', () => {
  assert.match(template, /alt=\$\{value\.decorative \? '' : value\.alt \|\| ''\}/u);
  assert.doesNotMatch(template, /alt=\$\{context\.fileName\}/u);
  const shaped = value.normaliseImageValue({href: '/a.png', alt: 'Набережная', decorative: true, width: 1600, height: 900, focus: {x: 2, y: 0.4}, crop: {aspect: '16/9', zoom: 9, x: 0.5, y: 0.5}});
  assert.deepEqual(plain(shaped), {value: '', label: 'a.png', mime: '', size: '', href: '/a.png', width: 1600, height: 900, alt: 'Набережная', decorative: true, focus: {x: 1, y: 0.4}, crop: {aspect: '16/9', zoom: 3, x: 0.5, y: 0.5}});
  // A value without them reads as it did.
  assert.deepEqual(plain(value.normaliseImageValue({href: '/a.png'})), {value: '', label: 'a.png', mime: '', size: '', href: '/a.png'});
  // alt=required: the form waits for a description or «Декоративная».
  const field = host({alt: 'required'});
  field.setValue({value: '7', href: '/a.png'});
  assert.equal(field.fieldCustomError(), 'Опишите изображение или отметьте его декоративным.');
  field.onAltInput({stopPropagation() {}, target: {value: 'Набережная'}}, 'input');
  assert.equal(field.fieldCustomError(), '');
  assert.equal(field.value.alt, 'Набережная');
  assert.equal(field.events.at(-1)[0], 'input');
  field.setValue({value: '7', href: '/a.png'});
  field.onDecorative({stopPropagation() {}, currentTarget: {checked: true}});
  assert.equal(field.value.decorative, true);
  assert.equal(field.fieldCustomError(), '');
});

test('IF-12: with the page\'s uploader the field shows the share, then the stored id; a failure says why, Retry sends again, Cancel puts the old image back', async () => {
  const field = host({});
  field.setValue({value: 'old', label: 'old.png', href: '/old.png'});
  let progress;
  let release;
  let fail = true;
  field.uploader = async (file, {onProgress}) => {
    progress = onProgress;
    await new Promise((resolve) => { release = resolve; });
    if (fail) throw new Error('связь прервалась');
    return {value: 'srv-9', href: '/srv/9.png'};
  };
  field.takeFile({file: png('new.png')});
  assert.equal(field._upload.state, 'process');
  assert.equal(field.fieldCustomError(), 'Дождитесь, пока изображение загрузится');
  await new Promise((resolve) => setImmediate(resolve));
  progress(42, 100);
  assert.equal(field.metaText(field.value), 'Загружается · 42 %');
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(field._upload.state, 'error');
  assert.equal(field.templateContext().message, 'Не загрузилось: связь прервалась');
  fail = false;
  assert.equal(field._retryUpload(), 'applied');
  await new Promise((resolve) => setImmediate(resolve));
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(field._upload, null);
  assert.deepEqual([field.value.value, field.value.href, 'file' in field.value], ['srv-9', '/srv/9.png', false]);
  assert.deepEqual(field.events.at(-1)[0], 'change');
  assert.equal(field.events.at(-1)[1].source, 'upload');
  assert.equal(field.sfFormValue(), 'srv-9');

  // Cancel: the stored image the field held before.
  const cancel = host({});
  cancel.setValue({value: 'old', label: 'old.png', href: '/old.png'});
  cancel.uploader = () => new Promise(() => {});
  cancel.takeFile({file: png('new.png')});
  assert.equal(cancel._cancelUpload(), 'applied');
  assert.equal(cancel.value.value, 'old');
  assert.equal(cancel.events.at(-1)[1].source, 'cancel');
  assert.match(template, /<sf-progress-ring size=\$\{RING_SIZE\[context\.layout\]\} label=\$\{names\.upload\}/u);
});

test('IF-13: field-renderers draws a read-only record field read-only, not disabled', () => {
  const start = renderers.indexOf('function renderImageEdit(');
  const edit = renderers.slice(start, renderers.indexOf('\n}\n', start));
  assert.match(edit, /\?readonly=\$\{field\.readonly === true\}/u);
  assert.doesNotMatch(edit, /\?disabled=\$\{field\.readonly/u);
});

test('IF-14: a data: or blob: address gives no file name, and the field names it «Изображение»', () => {
  assert.equal(fileNameFromAddress('data:image/svg+xml,%3Csvg%3E%3C/svg%3E'), '');
  assert.equal(fileNameFromAddress('blob:https://x.test/4f1c'), '');
  assert.equal(fileNameFromAddress('/upload/brand%20logo.svg?v=3'), 'brand logo.svg');
  const field = host({});
  field.setValue('data:image/svg+xml,%3Csvg%3E%3C/svg%3E');
  assert.equal(field.templateContext().fileName, 'Изображение');
});

test('IF-15: the reference names the current events, not sf-image-field-*', () => {
  for (const [name, action] of Object.entries(manifest.actions)) {
    assert.doesNotMatch(action.summary, /sf-image-field-/u, name);
  }
  const text = JSON.stringify(generated);
  assert.doesNotMatch(text.replace(/"sf-image-field-(?:attach|detach|rejected|library)"/gu, ''), /fire[^"]*sf-image-field-/u);
  assert.match(generated.methods.takeFile.summary, /sf-input-image-attach/u);
});

test('C94 point 1, 2: two layouts in one element; the row under the picture keeps to the picture, the buttons never over it', () => {
  assert.deepEqual(manifest.settings.layout.values, ['row', 'preview']);
  assert.equal(host({layout: 'preview'}).templateContext().layout, 'preview');
  assert.equal(host({}).templateContext().layout, 'row');
  const under = sheet.slice(sheet.indexOf('.sf-image-field-under {')).split('}')[0];
  assert.match(under, /inline-size: max\(var\(--sf-image-field--frame\), calc\(var\(--sf-ui-3--control-height\) \* 5\)\);/u);
  assert.match(under, /max-inline-size: 100%;/u);
  assert.match(under, /flex-wrap: wrap;/u);
  // No overlay of buttons on the picture: the frame holds actions only while empty.
  assert.match(template, /\$\{value\s+\? renderPicture\(context\)\s+: html`<i class="sf-icon"/u);
  assert.doesNotMatch(sheet, /sf-image-field-over/u);
});

test('C94 point 3: the frame and the focal point are edited and written into the value, the original untouched', () => {
  const field = host({layout: 'preview', edit: 'crop,focus', aspect: '16/9'});
  field.setValue({value: 'm', href: '/m.png', width: 1600, height: 900});
  assert.equal(field._openEditor(), 'applied');
  field.onStageKey({key: 'ArrowRight', shiftKey: false, preventDefault() {}});
  field.onStageKey({key: 'ArrowRight', shiftKey: false, preventDefault() {}});
  field.onStageKey({key: '+', preventDefault() {}});
  assert.equal(field._editorState(), 'Кадр 16:9, масштаб 110 %, центр 54 % по ширине, 50 % по высоте');
  field._setEditorMode('focus');
  field.onStageKey({key: 'ArrowUp', shiftKey: true, preventDefault() {}});
  assert.equal(field._editorState(), 'Точка фокуса: 50 % по ширине, 40 % по высоте');
  field._closeEditor(true);
  assert.deepEqual(plain(field.value.crop), {aspect: '16/9', zoom: 1.1, x: 0.54, y: 0.5});
  assert.deepEqual(plain(field.value.focus), {x: 0.5, y: 0.4});
  assert.equal(field.value.href, '/m.png', 'the address is the original');
  assert.equal(field.events.at(-1)[1].source, 'edit');
  // Cancel keeps the value. Escape on the stage is the window's (C125), not
  // the stage's: the stage leaves it to sf-modal's close-on-esc.
  field._openEditor();
  field.onStageKey({key: 'ArrowLeft', shiftKey: true, preventDefault() {}});
  let prevented = false;
  field.onStageKey({key: 'Escape', preventDefault() { prevented = true; }});
  assert.equal(prevented, false, 'Escape reaches the window');
  assert.ok(field._editor, 'the stage does not close the window itself');
  field._closeEditor(false);
  assert.equal(field._editor, null);
  assert.deepEqual(plain(field.value.crop), {aspect: '16/9', zoom: 1.1, x: 0.54, y: 0.5});
});

test('C125: the editor is a window over the page (sf-modal), the whole screen on a phone; it closes through the window', () => {
  // The template draws the editor in an sf-modal: the parts are the editor's,
  // «Отмена» (quiet, C116) and «Готово» stand in its footer.
  const editor = template.slice(template.indexOf('function renderEditor'), template.indexOf('// The description and'));
  assert.match(editor, /<sf-modal class="sf-image-field-window" open heading=\$\{words\.editTitle\}/u);
  assert.match(editor, /width="var\(--sf-h0\)" fullscreen=\$\{context\.phone \? 'true' : 'false'\}/u);
  assert.match(editor, /<div slot="content" class="sf-image-field-editor">/u);
  assert.match(editor, /<sf-button slot="footer" class="sf-image-field-editor-cancel" size=\$\{EDITOR_ANSWER\} appearance="ghost" scheme="on-surface"/u);
  assert.match(editor, /<sf-button slot="footer" class="sf-image-field-editor-done" size=\$\{EDITOR_ANSWER\} text=/u);
  assert.match(editor, /@sf-modal-closed=\$\{\(event\) => component\.onEditorClosed\(event\)\}/u);
  assert.match(editor, /role="application" aria-roledescription=\$\{words\.stageName\} autofocus/u);
  assert.match(template, /aria-label=\$\{names\.edit\} aria-haspopup="dialog"/u);
  assert.doesNotMatch(template, /aria-expanded=\$\{context\.editor/u);
  assert.equal(ru['edit-title'], 'Изменить изображение');
  assert.equal(en['edit-title'], 'Edit the image');
  assert.ok(manifest.relations.some(({name, lazy}) => name === 'cl-modal' && lazy), 'sf-modal loads when the window opens');

  // Through a stand-in window: «Готово» writes the value and asks the window
  // to close; the copy goes when the window says it closed.
  const field = host({layout: 'preview', edit: 'crop', aspect: '1/1'});
  field.setValue({value: 'm', href: '/m.png', width: 800, height: 800});
  const calls = [];
  const modal = {openState: true, close(options) { calls.push(['close', options.reason]); return {outcome: 'applied'}; }, confirm() { calls.push(['confirm']); return {outcome: 'applied'}; }};
  field.querySelector = () => modal;
  field._openEditor();
  field._zoomBy(0.5);
  field._closeEditor(true);
  assert.deepEqual(calls, [['confirm']]);
  assert.equal(field.value.crop.zoom, 1.5, 'the value is written at «Готово»');
  assert.ok(field._editor, 'kept while the window closes');
  field._closeEditor(true);
  assert.deepEqual(calls, [['confirm']], 'one close per window');
  const event = {stopped: false, target: modal, currentTarget: modal, stopPropagation() { this.stopped = true; }};
  field.onEditorClosed(event);
  assert.equal(event.stopped, true, 'the window\'s events stop at it');
  assert.equal(field._editor, null);
  assert.equal(field._focusAfterRender, 'edit', 'focus goes back to «Изменить»');
  // Escape, the scrim, the × : the window closes by itself, the value stays.
  field._openEditor();
  field._zoomBy(0.5);
  field.onEditorClosed({target: modal, currentTarget: modal, stopPropagation() {}});
  assert.equal(field.value.crop.zoom, 1.5);
  // «Отмена» asks the window to close as cancelled.
  field._openEditor();
  field._closeEditor(false);
  assert.deepEqual(calls.at(-1), ['close', 'cancelled']);
  // A phone: the template context says so, and the window is the whole screen.
  assert.equal(field.templateContext().phone, false);
  field._phone = true;
  assert.equal(field.templateContext().phone, true);
});

test('C94 point 4: the description and «Декоративная» are inside the field, switched on by the page', () => {
  assert.deepEqual(manifest.settings.alt.values, ['none', 'field', 'required']);
  assert.match(template, /<sf-input class="sf-image-field-alt-input"/u);
  assert.match(template, /<sf-switch class="sf-image-field-decorative"/u);
  // The inner fields' own events stop at the host: the field says its own.
  assert.match(template, /@input=\$\{\(event\) => component\.onAltInput\(event, 'input'\)\}/u);
  assert.match(template, /@change=\$\{\(event\) => component\.onDecorative\(event\)\}/u);
});

test('C94 point 5: «Заменить ▾» with the sources the page enabled; one source is a plain button; the library is the page\'s', () => {
  const many = host({sources: 'device,library,url', 'library-label': 'Из письма'});
  many.setValue({value: '1', href: '/a.png'});
  const context = many.templateContext();
  assert.deepEqual(plain(context.menuEntries.map(({id, text}) => [id, text])), [['device', 'С компьютера'], ['library', 'Из письма'], ['url', 'По ссылке']]);
  assert.equal(host({sources: 'library'}).templateContext().menuEntries.length, 0, 'one source, no menu');
  assert.deepEqual(plain(host({sources: 'nonsense'}).sourceList), ['device']);
  many._useSource('library');
  assert.equal(many.events.at(-1)[0], 'library');
  many._useSource('url');
  assert.equal(many.templateContext().urlOpen, true);
  assert.match(template, /text=\$\{text\} icon-end=\$\{many \? 'expand_more' : nothing\}/u);
  assert.equal(ru['replace-menu'], 'Заменить');
});

test('the core\'s checks are one: sf-file-upload and sf-input-image read intake.mjs', async () => {
  const intake = await read('src/component/file-upload/js/intake.mjs');
  assert.doesNotMatch(intake, /document|querySelector|addEventListener/u, 'pure: binds nothing');
  assert.match(await read('src/component/file-upload/js/_file_upload.js'), /import \{ acceptFormats, fileRejection, positiveLimit \} from '\.\/intake\.mjs';/u);
  assert.equal(value.acceptsFile, acceptsFile);
  assert.equal(fileRejection(pdf(), {accept: 'image/*'}), 'type');
  assert.equal(fileRejection(png('e.png', 0), {accept: 'image/*'}), 'empty');
  assert.equal(fileRejection(png('b.png', 10), {maxSize: 5}), 'size');
  assert.equal(acceptFormats('image/jpeg,image/png,image/webp,image/svg+xml'), 'JPG, PNG, WebP, SVG');
  assert.equal(acceptFormats('image/*', (kind) => `[${kind}]`), '[image]');
});

test('the words: ru and en have the same keys, the visible words begin each button\'s name', () => {
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  for (const key of ['replace', 'remove', 'choose', 'edit', 'retry', 'cancel-upload']) {
    const name = ru[`${key}-name`];
    assert.ok(name, key);
  }
  assert.ok(ru['edit-name'].startsWith(ru.edit), 'Изменить кадр');
  assert.ok(ru['retry-name'].startsWith(ru.retry));
  assert.ok(ru['cancel-upload-name'].startsWith(ru['cancel-upload']));
});

test('the reference and the events say the same: library is declared, rejected carries the list', () => {
  assert.ok(manifest.events.library);
  assert.deepEqual(Object.keys(manifest.events.rejected.carries), ['files', 'rejected', 'accept', 'source']);
  assert.deepEqual(manifest.events.change.carries.source.values, ['input', 'drop', 'paste', 'url', 'alt', 'edit', 'remove', 'upload', 'cancel']);
});

test('sources and edit read commas, spaces or both (1.4.1): the evidence wrote spaces, the docs write commas', () => {
  const sources = ['device', 'library', 'url'];
  for (const text of ['device,library,url', 'device library url', 'url, device ,library', ' device\tlibrary\nurl ', 'device,,library  url']) {
    assert.deepEqual(value.listOf(text, sources), sources, text);
  }
  assert.deepEqual(value.listOf('library device', sources), ['device', 'library'], 'in the known order');
  assert.deepEqual(value.listOf('device-library urls', sources), [], 'a name is whole, not a part');
  assert.deepEqual(value.listOf(null, sources), []);
  assert.deepEqual(plain(host({sources: 'device library url'}).sourceList), sources);
  assert.equal(host({sources: 'device library url'}).templateContext().menuEntries.length, 3, 'a space list makes the menu');
  assert.deepEqual(plain(host({edit: 'crop focus'}).editList), ['crop', 'focus']);
  assert.deepEqual(plain(host({edit: 'focus, crop'}).editList), ['crop', 'focus']);
  assert.deepEqual(plain(host({edit: 'crop'}).editList), ['crop']);
  assert.match(source, /import \{[^}]*\blistOf,[^}]*\} from '\.\/value\.mjs';/u, 'the element reads the one list rule');
});
