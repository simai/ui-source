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
import {elementFromManifest} from '../../core/js/element-manifest';
import {pageLocale} from '../../core/js/page-language';
import {instancePath, partId} from '../../core/js/instance-path';
import {createFieldContract} from '../../component/field-contract';
import {FIELD_SIZES, fieldSize} from '../../component/field-size';
import {FormField} from '../helpers/form-field';
import {renderImageFieldTemplate} from './js/templates/default';
import {acceptsFile, formatFileSize, normaliseImageValue} from './value.mjs';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// Every word this component says is lang/<locale>.json runtime (standard
// 1.3.8 §11). `quoted` wraps a file name the way the language quotes: «…» in
// Russian, “…” in English.
const WORD_KEYS = Object.keys(en.runtime);
const camel = (key) => key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
const kebab = (key) => key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

const DEFAULT_ACCEPT = 'image/*';

// sf-image-field from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §4.4, §8, §16.20, §17.1, §17.2): the settings are attributes
// and properties made by core/js/element-manifest.js, the actions answer an
// outcome, the events have their vocabulary names (the shim sends the colon
// names after them), and the host is the form control through
// ElementInternals.
const ImageFieldElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
  actions: {
    // Opens the platform's file dialog, as «Заменить…» and «Выбрать…» do.
    choose() {
      if (!this.interactive) return 'inactive';
      const input = this.input();
      if (!input) return 'not-drawn';
      input.click();
      return 'applied';
    },
    'take-file'({file, source = 'input'} = {}) {
      return this._takeFile(file, source || 'input');
    },
    'remove-image'() {
      return this._removeImage();
    },
    clear() {
      if (!this.value) return 'unchanged';
      this.setValue(null);
      return 'applied';
    },
    // §17.2: the message shows in place of the hint and the form does not
    // submit until it is cleared. It is the error-message and invalid
    // attributes, which is what a host writing them by hand gets too.
    'set-error'({message = ''} = {}) {
      const text = String(message ?? '');
      if (text) {
        this.setAttribute('error-message', text);
        this.setAttribute('invalid', '');
      } else {
        this.removeAttribute('error-message');
        this.removeAttribute('invalid');
      }
      this.setCustomValidity(text);
      return 'applied';
    },
  },
});

class SfImageField extends FormField(ImageFieldElement) {
  static get props() {
    return {
      ...super.props,
      templateName: {attribute: 'template', default: 'default'},
      // The value is an object (§4.2); its attribute -- an address, or the
      // shape as JSON -- stays as the field had it.
      value: {default: ''},
      size: {default: '1', values: FIELD_SIZES},
      // The group's name when no label is drawn: a field renderer's panel
      // prints the label beside the field, and a second, visible one inside it
      // would say it twice (the rule tests/field-control-accessible-name holds
      // for sf-input, sf-switch and the rest).
      ariaLabel: {attribute: 'aria-label', default: ''},
      rootClass: {default: ''},
    };
  }

  constructor() {
    super();
    // undefined: follow the attribute. Set by the property, a chosen file or a
    // removal; an attribute written later takes over again.
    this._value = undefined;
    // A value set as a property before the element was defined -- a lit
    // `.value` binding on a tag the loader had not upgraded yet, which is how
    // the field renderers draw it -- is an own property that would hide the
    // accessor for good and skip the normalising. It is taken through it.
    if (Object.prototype.hasOwnProperty.call(this, 'value')) {
      const early = this.value;
      delete this.value;
      this._value = normaliseImageValue(early);
    }
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
  get accept() { return this.hasAttribute('accept') ? this.getAttribute('accept') || '' : DEFAULT_ACCEPT; }
  get ariaLabel() { return this.getProp('ariaLabel') || ''; }

  // The ids the template writes come from the instance path (§7.1.1), never
  // from a counter.
  get _id() { return partId(instancePath(this, {kind: 'sf-image-field'})); }

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
    this.sfSyncFormState();
    return this;
  }

  // What the form gets (§17.1): the File the person chose, or the stored
  // image's id (else its address); nothing while empty or disabled. Read-only
  // still submits.
  sfFormValue() {
    if (this.disabled) return null;
    const value = this.value;
    if (!value) return null;
    if (value.file && typeof File === 'function' && value.file instanceof File) return value.file;
    return String(value.value || value.href || '') || null;
  }

  fieldValidity() {
    return {
      valueMissing: this.required && !this.disabled && !this.value,
      message: this.sfWord('value-missing'),
      anchor: this.focusDelegate(),
    };
  }

  // form.reset(): back to the image the field was written with, without
  // events (§17.1 item 4).
  fieldReset() {
    this._releaseObjectUrl();
    this._value = undefined;
    const input = this.input();
    if (input) input.value = '';
    this.requestComponentUpdate('value');
  }

  get interactive() {
    return !this.disabled && !this.readonly;
  }

  text(key) {
    return this.sfWord(kebab(key));
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

  // The person chose a file: from the dialog (source input) or by dropping it
  // (source drop). The thumbnail shows it at once from an object URL; the host
  // hears of it in input, change and attach (sf-image-field:select after it),
  // each carrying the File, and uploads it. The action take-file answers
  // its outcome (§4.4).
  _takeFile(file, source = 'input') {
    if (!file) return 'no-file';
    if (!this.interactive) return 'inactive';
    if (!acceptsFile(this.accept, file)) {
      this.reject([file], source);
      return 'rejected';
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
    this.sfEmit('attach', {files: [file], file, source, value, name: this.name});
    return 'applied';
  }

  // The person removed the image. Focus goes to «Выбрать…», which is where the
  // removed button stood, so the keyboard does not fall back to the page. Not
  // called remove(): that is the element's own removal from the document.
  _removeImage() {
    const previous = this.value;
    if (!previous) return 'empty';
    if (!this.interactive) return 'inactive';
    this._releaseObjectUrl();
    this._value = null;
    const input = this.input();
    if (input) input.value = '';
    this._focusAfterRender = 'choose';
    this.announce(this.text('removed'));
    this.requestComponentUpdate('value');
    this._emitValue({value: null, file: null, source: 'remove'});
    this.sfEmit('detach', {value: previous, name: this.name});
    return 'applied';
  }

  reject(files, source) {
    const names = files.map((file) => this.quote(file.name)).join(', ');
    this.announce(`${this.text('rejected')}: ${names}`);
    this.sfEmit('rejected', {files, accept: this.accept, source});
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
    this.sfSyncFormState();
    for (const type of ['input', 'change']) this.sfEmit(type, {value, file, source, name: this.name});
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
    if (file) this._takeFile(file, 'input');
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
      this.sfHostState('data-dragged-over', true);
      this.requestComponentUpdate('drag');
    }
  }

  onDragLeave(event) {
    const well = event.currentTarget;
    if (event.relatedTarget && well.contains(event.relatedTarget)) return;
    if (!this.dragging) return;
    this.dragging = false;
    this.sfHostState('data-dragged-over', false);
    this.requestComponentUpdate('drag');
  }

  onDrop(event) {
    const types = Array.from(event.dataTransfer?.types || []);
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length && !types.includes('Files')) return;
    event.preventDefault();
    if (this.dragging) {
      this.dragging = false;
      this.sfHostState('data-dragged-over', false);
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
    this._takeFile(accepted, 'drop');
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
    this.sfSyncFormState();
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
      // error is a dated alias of invalid (§17.2, aliases.json).
      invalid: this.invalid || this.hasAttribute('error'),
      hint: this.hint,
      errorMessage: this.errorMessage,
    });
    const errorContent = this.hasSlotContent?.('error') ? this.getSlotContent('error') : this.errorMessage;
    const hintContent = this.hasSlotContent?.('hint') ? this.getSlotContent('hint') : this.hint;
    const fileName = value?.label || '';
    const words = Object.fromEntries(WORD_KEYS.map((key) => [camel(key), this.sfWord(key)]));

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
        group: this.label || this.ariaLabel || words.group,
        choose: words.chooseName,
        replace: fileName ? `${words.replaceName} ${this.quote(fileName)}` : words.replaceName,
        remove: fileName ? `${words.removeName} ${this.quote(fileName)}` : words.removeName,
      },
      rootClass: this.getRootClass(),
      // The host is the form control where the browser has ElementInternals,
      // so the native file input carries no name (§17.1 item 6).
      controlName: this.sfInternals ? '' : this.name,
    });
  }

  template() {
    return renderImageFieldTemplate(this.templateContext());
  }
}

SfImageField.define('sf-image-field');

export {SfImageField};
