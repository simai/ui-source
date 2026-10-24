// sf-image-field: a form field that holds one image (simai/ui-source#27). It
// shows the image as a thumbnail with its file name and size, offers
// «Заменить…» and «Убрать», and takes a file dropped anywhere on it -- the image
// well a page editor, a brand logo or an admin media field needs. ui-mail's
// polish audit (2026-10-22, B1) found the only part the Framework had for it was
// sf-file-upload, which is a drop zone with a list of transfers: after a choice
// it kept its whole zone, showed no image and had no way to replace one.
//
// It does what sf-file-upload does with a file and no more: it raises the File
// the person chose, in the events, and transfers no bytes. The host uploads it
// and writes back the stored value, with the address the image now has. Until
// then the thumbnail shows the chosen file from an object URL, so the person
// sees what they picked at once rather than after a round trip.
//
// The field half -- label, help text, error, required, disabled, read-only --
// is the one every Framework field has (component/field-contract.js), so the
// field reads, sizes and announces itself as sf-input and sf-textarea do.
import SfBaseElement from '../../core/js/smart-base';
import {pageText, pageLocale} from '../../core/js/page-language';
import {createFieldContract} from '../../component/field-contract';
import {FIELD_SIZES, fieldSize} from '../../component/field-size';
import {renderImageFieldTemplate} from './js/templates/default';
import {acceptsFile, formatFileSize, normaliseImageValue} from './value.mjs';
import './scss/index.scss';

// Every word this component says. A product adds any other language through
// SF.language.register('sf-image-field', code, words). `quoted` wraps a file
// name the way the language quotes: «…» in Russian, “…” in English.
const IMAGE_FIELD_TEXT = {
  en: {
    group: 'Image',
    choose: 'Choose…',
    chooseName: 'Choose an image',
    replace: 'Replace…',
    replaceName: 'Replace the image',
    remove: 'Remove',
    removeName: 'Remove the image',
    empty: 'No image chosen',
    emptyHint: 'Drop a file here or choose one',
    drop: 'Drop the file to use it',
    chosen: 'Image chosen',
    removed: 'Image removed',
    rejected: 'This file is not accepted',
    quoted: '“%s”',
    bytes: 'B',
    kilobytes: 'KB',
    megabytes: 'MB',
    gigabytes: 'GB',
  },
  ru: {
    group: 'Изображение',
    choose: 'Выбрать…',
    chooseName: 'Выбрать изображение',
    replace: 'Заменить…',
    replaceName: 'Заменить изображение',
    remove: 'Убрать',
    removeName: 'Убрать изображение',
    empty: 'Изображение не выбрано',
    emptyHint: 'Перетащите файл сюда или выберите его',
    drop: 'Отпустите файл, чтобы поставить его',
    chosen: 'Выбрано изображение',
    removed: 'Изображение убрано',
    rejected: 'Этот файл не подходит',
    quoted: '«%s»',
    bytes: 'Б',
    kilobytes: 'КБ',
    megabytes: 'МБ',
    gigabytes: 'ГБ',
  },
};

const DEFAULT_ACCEPT = 'image/*';
let sequence = 0;

class SfImageField extends SfBaseElement {
  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      value: {default: ''},
      name: {default: ''},
      label: {default: ''},
      hint: {default: ''},
      accept: {default: DEFAULT_ACCEPT},
      size: {default: '1', values: FIELD_SIZES},
      meta: {default: ''},
      emptyText: {attribute: 'empty-text', default: ''},
      required: {type: Boolean, default: false},
      disabled: {type: Boolean, default: false},
      readonly: {type: Boolean, default: false},
      error: {type: Boolean, default: false},
      invalid: {type: Boolean, default: false},
      errorMessage: {attribute: 'error-message', default: ''},
      rootClass: {default: ''},
    };
  }

  constructor() {
    super();
    this._id = `sf-image-field-${++sequence}`;
    // undefined: follow the attribute. Set by the property, a chosen file or a
    // removal; an attribute written later takes over again.
    this._value = undefined;
    this._objectUrl = '';
    this._dimensions = new Map();
    this._failed = new Set();
    this.dragging = false;
    this.announcement = '';
    this._focusAfterRender = '';
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && previous !== next && !this._writingValue) {
      this._value = undefined;
      this._releaseObjectUrl();
    }
    super.attributeChangedCallback(name, previous, next);
  }

  get size() { return fieldSize(this.getAttribute('size') || '1', 'sf-image-field'); }
  get name() { return this.getAttribute('name') || ''; }
  get label() { return this.getAttribute('label') || ''; }
  get hint() { return this.getAttribute('hint') || ''; }
  get accept() { return this.hasAttribute('accept') ? this.getAttribute('accept') || '' : DEFAULT_ACCEPT; }
  get meta() { return this.getAttribute('meta') || ''; }
  get emptyText() { return this.getAttribute('empty-text') || ''; }
  get required() { return this.getBooleanAttr('required', false); }
  get disabled() { return this.getBooleanAttr('disabled', false); }
  get readonly() { return this.getBooleanAttr('readonly', false); }
  get error() { return this.getBooleanAttr('error', false); }
  get invalid() { return this.getBooleanAttr('invalid', false); }
  get errorMessage() { return this.getAttribute('error-message') || ''; }

  // The image the field holds, in the file shape, or null when it is empty.
  get value() {
    if (this._value !== undefined) return this._value;
    return normaliseImageValue(this.getAttribute('value'));
  }

  // Set from code, the value is not a change: no event, as for a native field.
  set value(next) {
    this.setValue(next);
  }

  setValue(next) {
    const value = normaliseImageValue(next);
    if (value?.href !== this._objectUrl) this._releaseObjectUrl();
    this._value = value;
    this.requestComponentUpdate('value');
    return this;
  }

  clear() {
    return this.setValue(null);
  }

  // The audit's setError: an error message the field shows in place of its
  // hint, or none. It is the error-message and invalid attributes, which is what a
  // host writing them by hand gets too.
  setError(message = '') {
    const text = String(message ?? '');
    if (text) {
      this.setAttribute('error-message', text);
      this.setAttribute('invalid', '');
    } else {
      this.removeAttribute('error-message');
      this.removeAttribute('invalid');
    }
    return this;
  }

  get interactive() {
    return !this.disabled && !this.readonly;
  }

  text(key) {
    return pageText(IMAGE_FIELD_TEXT, key, this, 'sf-image-field');
  }

  quote(name) {
    return this.text('quoted').replace('%s', name);
  }

  // A size as people read it, in the page's language: «2 КБ», «1,4 МБ». Text
  // the host already formatted is shown as it came.
  formatSize(size) {
    const units = ['bytes', 'kilobytes', 'megabytes', 'gigabytes'].map((key) => this.text(key));
    return formatFileSize(size, units, pageLocale(this));
  }

  // «450×300 · 2 КБ»: the image's own dimensions once it has loaded, then its
  // size. The host's `meta` replaces the line when it knows better.
  metaText(value) {
    if (this.meta) return this.meta;
    if (!value) return '';
    const dimensions = value.href ? this._dimensions.get(value.href) : null;
    return [dimensions ? `${dimensions.width}×${dimensions.height}` : '', this.formatSize(value.size)]
      .filter(Boolean)
      .join(' · ');
  }

  input() {
    return this.querySelector(':scope .sf-image-field-input');
  }

  focusDelegate() {
    return this.querySelector(':scope .sf-image-field-actions button:not([disabled])');
  }

  // Opens the platform's file dialog, as «Заменить…» and «Выбрать…» do.
  choose() {
    if (!this.interactive) return false;
    const input = this.input();
    if (!input) return false;
    input.click();
    return true;
  }

  // The person chose a file: from the dialog (source input) or by dropping it
  // (source drop). The thumbnail shows it at once from an object URL; the host
  // hears of it in input, change and sf-image-field:select, each carrying the
  // File, and uploads it.
  takeFile(file, source = 'input') {
    if (!file || !this.interactive) return false;
    if (!acceptsFile(this.accept, file)) {
      this.reject([file], source);
      return false;
    }
    this._releaseObjectUrl();
    let href = '';
    try {
      href = URL.createObjectURL(file);
      this._objectUrl = href;
    } catch {
      href = '';
    }
    const value = {value: '', label: file.name, mime: file.type || '', size: file.size, href, file};
    this._value = value;
    this.announce(`${this.text('chosen')} ${this.quote(file.name)}`);
    this.requestComponentUpdate('value');
    this._emitValue({value, file, source});
    this.dispatchEvent(new CustomEvent('sf-image-field:select', {
      bubbles: true,
      composed: true,
      detail: {file, source, value, name: this.name},
    }));
    return true;
  }

  // The person removed the image. Focus goes to «Выбрать…», which is where the
  // removed button stood, so the keyboard does not fall back to the page. Not
  // called remove(): that is the element's own removal from the document.
  removeImage() {
    const previous = this.value;
    if (!previous || !this.interactive) return false;
    this._releaseObjectUrl();
    this._value = null;
    const input = this.input();
    if (input) input.value = '';
    this._focusAfterRender = 'choose';
    this.announce(this.text('removed'));
    this.requestComponentUpdate('value');
    this._emitValue({value: null, file: null, source: 'remove'});
    this.dispatchEvent(new CustomEvent('sf-image-field:remove', {
      bubbles: true,
      composed: true,
      detail: {value: previous, name: this.name},
    }));
    return true;
  }

  reject(files, source) {
    const names = files.map((file) => this.quote(file.name)).join(', ');
    this.announce(`${this.text('rejected')}: ${names}`);
    this.dispatchEvent(new CustomEvent('sf-image-field:reject', {
      bubbles: true,
      composed: true,
      detail: {files, accept: this.accept, source},
    }));
  }

  // Said in the polite status, as sf-help-mark and sf-copy-button say theirs.
  // Cleared first, so the same words twice are heard twice.
  announce(message) {
    this.announcement = '';
    this.requestComponentUpdate('announce-clear');
    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => {
      this.announcement = message;
      this.requestComponentUpdate('announce');
    }, 50);
  }

  // `input` and `change` once each per choice or removal, as a native file
  // input sends them, on the host with the value, the File and the form name.
  _emitValue({value, file, source}) {
    for (const type of ['input', 'change']) {
      this.dispatchEvent(new CustomEvent(type, {
        bubbles: true,
        composed: true,
        detail: {value, file, source, name: this.name},
      }));
    }
  }

  _releaseObjectUrl() {
    if (!this._objectUrl) return;
    try {
      URL.revokeObjectURL(this._objectUrl);
    } catch {
      // Nothing to release.
    }
    this._dimensions.delete(this._objectUrl);
    this._objectUrl = '';
  }

  // The dialog's own change. It also bubbles out of the host as a plain Event
  // with no detail -- a second change for the one this dispatches -- so it
  // stops here, as sf-color's does.
  onInputChange(event) {
    event.stopPropagation();
    const file = event.target?.files?.[0];
    if (file) this.takeFile(file, 'input');
  }

  onInputEvent(event) {
    event.stopPropagation();
  }

  // A file held over the field: the whole field is the target, and says so --
  // the border and fill of a selection and the words «Отпустите файл…». Only a
  // drag that carries files is taken, so text dragged across a form is not.
  onDragOver(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    if (!this.interactive) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    if (!this.dragging) {
      this.dragging = true;
      this.requestComponentUpdate('drag');
    }
  }

  onDragLeave(event) {
    const well = event.currentTarget;
    if (event.relatedTarget && well.contains(event.relatedTarget)) return;
    if (!this.dragging) return;
    this.dragging = false;
    this.requestComponentUpdate('drag');
  }

  onDrop(event) {
    const types = Array.from(event.dataTransfer?.types || []);
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length && !types.includes('Files')) return;
    event.preventDefault();
    if (this.dragging) {
      this.dragging = false;
      this.requestComponentUpdate('drag');
    }
    if (!this.interactive || !files.length) return;
    // One image: the first file the field accepts. The rest are reported, as
    // sf-file-upload reports a drop the accept list leaves out.
    const accepted = files.find((file) => acceptsFile(this.accept, file));
    const rejected = files.filter((file) => !acceptsFile(this.accept, file));
    if (rejected.length) this.reject(rejected, 'drop');
    if (!accepted) return;
    // The native input holds the dropped file too, so a form that submits
    // this field sends it under `name` as it sends a picked one.
    const input = this.input();
    if (input && typeof DataTransfer === 'function') {
      try {
        const transfer = new DataTransfer();
        transfer.items.add(accepted);
        input.files = transfer.files;
      } catch {
        // A browser without a settable FileList still raises the File.
      }
    }
    this.takeFile(accepted, 'drop');
  }

  onImageLoad(event, href) {
    const image = event.target;
    if (!href || !image?.naturalWidth) return;
    const known = this._dimensions.get(href);
    if (known && known.width === image.naturalWidth && known.height === image.naturalHeight) return;
    this._dimensions.set(href, {width: image.naturalWidth, height: image.naturalHeight});
    this.requestComponentUpdate('dimensions');
  }

  onImageError(href) {
    if (!href || this._failed.has(href)) return;
    this._failed.add(href);
    this.requestComponentUpdate('image-error');
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    if (this._focusAfterRender) {
      this._focusAfterRender = '';
      // The sf-button host, not its inner button: a button drawn in this
      // render has not drawn its own yet, and the host's focus() waits for it.
      this.querySelector(':scope .sf-image-field-actions sf-button:not([disabled])')?.focus({preventScroll: true});
    }
    return undefined;
  }

  onDisconnected() {
    clearTimeout(this._announceTimer);
  }

  templateContext() {
    const props = this.getPropsContext();
    const value = this.value;
    const field = createFieldContract(this, {
      prefix: 'sf-image-field',
      required: this.required,
      invalid: this.invalid || this.error,
      hint: this.hint,
      errorMessage: this.errorMessage,
    });
    const errorContent = this.hasSlotContent?.('error') ? this.getSlotContent('error') : this.errorMessage;
    const hintContent = this.hasSlotContent?.('hint') ? this.getSlotContent('hint') : this.hint;
    const fileName = value?.label || '';
    const words = Object.fromEntries(Object.keys(IMAGE_FIELD_TEXT.en).map((key) => [key, this.text(key)]));

    return this.createTemplateContext({
      ...props,
      component: this,
      id: this._id,
      field,
      value,
      size: this.size,
      accept: this.accept,
      fileName,
      metaText: this.metaText(value),
      broken: Boolean(value?.href && this._failed.has(value.href)),
      dragging: this.dragging && this.interactive,
      interactive: this.interactive,
      announcement: this.announcement,
      message: field.invalid && errorContent ? errorContent : hintContent,
      messageKind: field.invalid && errorContent ? 'error' : 'hint',
      words,
      names: {
        group: this.label || words.group,
        choose: words.chooseName,
        replace: fileName ? `${words.replaceName} ${this.quote(fileName)}` : words.replaceName,
        remove: fileName ? `${words.removeName} ${this.quote(fileName)}` : words.removeName,
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderImageFieldTemplate(this.templateContext());
  }
}

SfImageField.define('sf-image-field');

export {SfImageField};
