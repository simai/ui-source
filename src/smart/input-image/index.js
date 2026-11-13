// sf-input-image: a form field that holds one image (simai/ui-source#27; the
// single-file view of the upload family, C81; its looks and parts, C94). It
// shows the image -- as a row (thumbnail, name and size, the buttons) or as a
// preview (the picture in its frame, the row under it) -- and takes a file the
// person chooses, drops or pastes on it, or a picture from the page's library
// or an address. ui-mail's polish audit (2026-10-22, B1) found the only part
// the Framework had for it was sf-file-upload, a drop zone with a list of
// transfers.
//
// What a file must be is the upload core's rule (component/file-upload/js/
// intake.mjs): the type accept names, not empty, not past max-size; and, for a
// picture, at least min-width × min-height pixels. A file that fails is said
// under the field, in words that name the file and the reason (C81: the
// message under the field), and in `rejected`. Of several files dropped at
// once the first image is taken and the field says so (IF-3).
//
// It transfers nothing itself. Without `uploader` it raises the File, in the
// events, and the host uploads it and writes back the stored value; until then
// the thumbnail shows the chosen file from an object URL. With `uploader` --
// the page's async (file, {signal, onProgress}) => {value, href} | id, the
// contract sf-file-upload's uploader has -- the field sends the file itself and
// shows the transfer on the picture: a ring with the share, «Отменить», and on
// a failure the reason, «Повторить» (IF-12).
//
// The picture's description (alt) and «Декоративная» are inside the field when
// the page asks for them (`alt`); the frame and the focal point are edited in
// place (`edit`), never the pixels: they go in the value, and the server or
// CDN cuts the sizes (C94 points 3, 4).
//
// The field half -- label, help text, error, required, disabled, read-only --
// is the one every Framework field has (component/field-contract.js), so the
// field reads, sizes and announces itself as sf-input and sf-textarea do.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {instancePath, partId} from '../../core/js/instance-path';
import {tagSelector} from '../../core/js/tag-aliases.js';
import {createFieldContract} from '../../component/field-contract';
import {FIELD_SIZES, fieldSize} from '../../component/field-size';
import {FormField} from '../helpers/form-field';
import {renderImageFieldTemplate} from './js/templates/default';
import {
  acceptFormats,
  aspectRatio,
  fileRejection,
  formatFileSize,
  mayBeTransparent,
  normaliseCrop,
  normaliseFocus,
  normaliseImageValue,
  positiveLimit,
  ZOOM_MAX,
  ZOOM_MIN,
} from './value.mjs';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// Every word this component says is lang/<locale>.json runtime (standard
// 1.3.8 §11). `quoted` wraps a file name the way the language quotes: «…» in
// Russian, “…” in English.
const WORD_KEYS = Object.keys(en.runtime).filter((key) => typeof en.runtime[key] === 'string');
const camel = (key) => key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
const kebab = (key) => key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

const DEFAULT_ACCEPT = 'image/*';
const SOURCES = ['device', 'library', 'url'];
const EDITS = ['crop', 'focus'];
const MENU = `:scope .sf-image-field-parts > ${tagSelector('sf-menu-context')}`;

// Reads a comma list against the names it may hold, in their order there.
const listOf = (text, known) => {
  const asked = String(text || '').split(',').map((part) => part.trim()).filter(Boolean);
  return known.filter((name) => asked.includes(name));
};

// Whether the pointer is a finger: no hover, no drag words (IF-1).
const coarseQuery = () => {
  try {
    return globalThis.matchMedia?.('(pointer: coarse)') ?? null;
  } catch {
    return null;
  }
};

// The pixels of a picture at an address, or null when it does not load.
function readDimensions(href) {
  return new Promise((resolve) => {
    if (!href || typeof Image !== 'function') {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth ? {width: image.naturalWidth, height: image.naturalHeight} : null);
    image.onerror = () => resolve(null);
    image.src = href;
  });
}

// sf-input-image from its component.json (standard simai.smart-component
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
      return this._takeFiles(file ? [file] : [], source || 'input');
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
    // The page's transfer, a property like sf-file-upload's.
    this._uploader = null;
    if (Object.prototype.hasOwnProperty.call(this, 'uploader')) {
      const early = this.uploader;
      delete this.uploader;
      this._uploader = typeof early === 'function' ? early : null;
    }
    this._objectUrl = '';
    this._dimensions = new Map();
    this._failed = new Set();
    this.dragging = false;
    this.announcement = '';
    this._focusAfterRender = '';
    // What the field says under itself apart from the hint and the page's
    // error: a refused file (error) or what it did with extra files (info).
    this._notice = null;
    // A required field left empty says so when focus leaves it or the form
    // checks it, not only on submit (IF-6).
    this._missingShown = false;
    // The transfer the uploader runs: {state: process|error, progress,
    // controller, previous, message}.
    this._upload = null;
    this._urlOpen = false;
    this._urlError = '';
    // The editor's working copy: {mode, crop, focus}, or null while closed.
    this._editor = null;
    this._coarse = Boolean(coarseQuery()?.matches);
    this._onCoarse = (event) => {
      this._coarse = Boolean(event.matches);
      this.requestComponentUpdate('pointer');
    };
    this._onInvalid = () => this._showMissing();
    this._onFocusOut = (event) => {
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      this._showMissing();
    };
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && previous !== next && !this._writingValue) {
      this._value = undefined;
      this._releaseObjectUrl();
    }
    super.attributeChangedCallback(name, previous, next);
  }

  onConnected() {
    const query = coarseQuery();
    this._coarse = Boolean(query?.matches);
    query?.addEventListener?.('change', this._onCoarse);
    this.addEventListener('invalid', this._onInvalid);
    this.addEventListener('focusout', this._onFocusOut);
  }

  onDisconnected() {
    clearTimeout(this._announceTimer);
    coarseQuery()?.removeEventListener?.('change', this._onCoarse);
    this.removeEventListener('invalid', this._onInvalid);
    this.removeEventListener('focusout', this._onFocusOut);
    this._upload?.controller?.abort();
  }

  get size() { return fieldSize(this.getAttribute('size') || '1', 'sf-input-image'); }
  get accept() { return this.hasAttribute('accept') ? this.getAttribute('accept') || '' : DEFAULT_ACCEPT; }
  get ariaLabel() { return this.getProp('ariaLabel') || ''; }
  get layoutName() { return this.getAttribute('layout') === 'preview' ? 'preview' : 'row'; }
  get shapeName() { return this.getAttribute('shape') === 'circle' ? 'circle' : 'square'; }
  get fitName() { return this.getAttribute('fit') === 'contain' ? 'contain' : 'cover'; }
  get sourceList() {
    const list = listOf(this.hasAttribute('sources') ? this.getAttribute('sources') : 'device', SOURCES);
    return list.length ? list : ['device'];
  }
  get editList() { return listOf(this.getAttribute('edit'), EDITS); }
  get altMode() {
    const mode = this.getAttribute('alt');
    return mode === 'field' || mode === 'required' ? mode : 'none';
  }
  get limits() {
    return {
      maxSize: positiveLimit(this.getAttribute('max-size')),
      minWidth: positiveLimit(this.getAttribute('min-width')),
      minHeight: positiveLimit(this.getAttribute('min-height')),
    };
  }

  // The ids the template writes come from the instance path (§7.1.1), never
  // from a counter.
  get _id() { return partId(instancePath(this, {kind: 'sf-input-image'})); }

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
    if (value) this._missingShown = false;
    this.requestComponentUpdate('value');
    this.sfSyncFormState();
    return this;
  }

  // The page's transfer (IF-12): async (file, {signal, onProgress, value}) =>
  // the stored value ({value, href} or an id). With it the field sends each
  // file it takes and shows the transfer; without it the host uploads the File
  // the events carry and calls setValue().
  get uploader() {
    return this._uploader;
  }

  set uploader(value) {
    this._uploader = typeof value === 'function' ? value : null;
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

  // Beside value-missing, what keeps the form from submitting: a transfer
  // still going or failed, and a description the page requires (alt
  // required) that is neither written nor waived as decorative.
  fieldCustomError() {
    if (this.disabled) return '';
    if (this._upload?.state === 'process') return this.sfWord('wait-for-upload');
    if (this._upload?.state === 'error') return this.sfWord('upload-failed-validity');
    return this._altMissing() ? this.sfWord('alt-missing') : '';
  }

  sfSyncValidity() {
    const internals = this.sfInternals;
    const own = this.fieldCustomError();
    if (!internals || !own || this.sfCustomError) {
      super.sfSyncValidity();
      return;
    }
    try {
      const anchor = this.focusDelegate();
      internals.setValidity({customError: true}, own, anchor && this.contains(anchor) ? anchor : undefined);
    } catch (error) {
      this.reportComponentError?.(error, 'validity');
    }
  }

  // form.reset(): back to the image the field was written with, without
  // events (§17.1 item 4).
  fieldReset() {
    this._upload?.controller?.abort();
    this._upload = null;
    this._releaseObjectUrl();
    this._value = undefined;
    this._notice = null;
    this._missingShown = false;
    this._urlOpen = false;
    this._editor = null;
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
    return formatFileSize(size, {units, node: this});
  }

  // The image's pixels: the value's own, else what the picture said once it
  // loaded.
  dimensionsOf(value) {
    if (!value) return null;
    if (value.width && value.height) return {width: value.width, height: value.height};
    return value.href ? this._dimensions.get(value.href) || null : null;
  }

  // «450×300 · 2 КБ»: the image's own dimensions once it has loaded, then its
  // size. The host's `meta` replaces the line when it knows better. While a
  // transfer runs it is the share, and after a failure the failure.
  metaText(value) {
    if (this._upload?.state === 'process') {
      const share = this._upload.progress;
      return share === null || share === undefined
        ? this.sfWord('uploading-plain')
        : this.sfWord('uploading', {vars: {n: share}});
    }
    if (this._upload?.state === 'error') return this.sfWord('upload-failed-plain');
    if (this.meta) return this.meta;
    if (!value) return '';
    const dimensions = this.dimensionsOf(value);
    return [dimensions ? `${dimensions.width}×${dimensions.height}` : '', this.formatSize(value.size)]
      .filter(Boolean)
      .join(' · ');
  }

  input() {
    return this.querySelector(':scope .sf-image-field-input');
  }

  get menu() {
    return this.querySelector(MENU);
  }

  focusDelegate() {
    return this.querySelector(':scope .sf-image-field-actions button:not([disabled])');
  }

  // Shown once focus leaves the field or the form checks it: an empty
  // required field, or a description the page requires and nobody wrote.
  _showMissing() {
    if (this.disabled || this._missingShown) return;
    if (!(this.required && !this.value) && !this._altMissing()) return;
    this._missingShown = true;
    this.requestComponentUpdate('missing');
  }

  _altMissing() {
    const value = this.value;
    return this.altMode === 'required' && Boolean(value) && !value.decorative && !String(value.alt || '').trim();
  }

  _say(kind, text) {
    this._notice = text ? {kind, text} : null;
  }

  // The person gave files: from the dialog (input), a drop, a paste, or the
  // host's take-file. One image is taken: the first that passes the checks.
  // The rest are refused with their reason (rejected, under the field), and
  // extra images are said as an information line (IF-2, IF-3). With a minimum
  // width or height the picture is read first, so the action answers a
  // promise of its outcome there (§4.4).
  _takeFiles(files, source = 'input') {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return 'no-file';
    if (!this.interactive) return 'inactive';
    const {maxSize, minWidth, minHeight} = this.limits;
    const rejected = [];
    let chosen = null;
    for (const file of list) {
      if (chosen) {
        rejected.push(this._rejection(file, 'count'));
        continue;
      }
      const reason = fileRejection(file, {accept: this.accept, maxSize});
      if (reason) rejected.push(this._rejection(file, reason, {max: maxSize}));
      else chosen = file;
    }
    const extra = chosen ? rejected.filter((entry) => entry.reason === 'count').length : 0;
    const finish = (taken) => {
      const refused = taken ? rejected.filter((entry) => entry.reason !== 'count') : rejected;
      const shown = refused.length ? refused : [];
      if (shown.length) this._say('error', shown.length === 1 ? shown[0].message : shown.map((entry) => entry.message).join('. '));
      else if (taken && extra) this._say('info', this.sfWord('taken-first', {vars: {n: list.length}}));
      else this._say('', '');
      if (rejected.length) this._reject(rejected, source);
      this.requestComponentUpdate('notice');
      return taken ? 'applied' : 'rejected';
    };
    if (!chosen) return finish(false);
    if (!minWidth && !minHeight) {
      this._take(chosen, source, null);
      return finish(true);
    }
    // The picture is read before it is taken: a too-small image never shows.
    let href = '';
    try {
      href = URL.createObjectURL(chosen);
    } catch {
      href = '';
    }
    return readDimensions(href).then((dimensions) => {
      const small = !dimensions
        ? 'unreadable'
        : minWidth && dimensions.width < minWidth ? 'min-width'
          : minHeight && dimensions.height < minHeight ? 'min-height' : '';
      if (small) {
        try {
          URL.revokeObjectURL(href);
        } catch {
          // Nothing to release.
        }
        rejected.unshift(this._rejection(chosen, small, {dimensions, min: small === 'min-height' ? minHeight : minWidth}));
        return finish(false);
      }
      this._take(chosen, source, {href, dimensions});
      return finish(true);
    });
  }

  _rejection(file, reason, {max = 0, min = 0, dimensions = null} = {}) {
    const name = String(file?.name || '');
    const vars = {name};
    if (reason === 'type') vars.formats = acceptFormats(this.accept, (kind) => this.sfWord(`formats-${kind}`));
    if (reason === 'size') Object.assign(vars, {size: this.formatSize(file?.size), max: this.formatSize(max)});
    if (reason === 'min-width' || reason === 'min-height') {
      Object.assign(vars, {width: dimensions?.width ?? 0, height: dimensions?.height ?? 0, min});
    }
    return {file, name, reason, message: this.sfWord(`reject-${reason}`, {vars})};
  }

  _take(file, source, read) {
    this._upload?.controller?.abort();
    this._upload = null;
    const previous = this.value && !this.value.file ? this.value : null;
    this._releaseObjectUrl();
    let href = read?.href || '';
    if (!href) {
      try {
        href = URL.createObjectURL(file);
      } catch {
        href = '';
      }
    }
    this._objectUrl = href;
    const value = {value: '', label: file.name, mime: file.type || '', size: file.size, href, file};
    if (read?.dimensions) {
      value.width = read.dimensions.width;
      value.height = read.dimensions.height;
    }
    // A new picture needs its own description; the old one's does not fit it.
    this._value = value;
    this._missingShown = false;
    this._urlOpen = false;
    this._editor = null;
    this.announce(`${this.text('chosen')} ${this.quote(file.name)}`);
    this.requestComponentUpdate('value');
    this._emitValue({value, file, source});
    this.sfEmit('attach', {files: [file], file, source, value, name: this.name});
    if (this._uploader) this._send(file, previous);
  }

  // The transfer through the page's uploader: the share it reports, then the
  // stored value (done) or the reason (error). Cancel aborts it and puts the
  // stored image back.
  _send(file, previous = this._upload?.previous ?? null) {
    const send = this._uploader;
    if (!send || !file) return;
    this._upload?.controller?.abort();
    const controller = new AbortController();
    const upload = {state: 'process', progress: null, controller, previous, message: ''};
    this._upload = upload;
    this.requestComponentUpdate('upload');
    this.sfSyncFormState();
    const {signal} = controller;
    const onProgress = (done, total) => {
      if (signal.aborted || this._upload !== upload) return;
      const share = Number(total) > 0 ? Math.round((Number(done) / Number(total)) * 100) : null;
      upload.progress = share === null ? null : Math.max(0, Math.min(100, share));
      this.requestComponentUpdate('upload-progress');
    };
    Promise.resolve()
      .then(() => send.call(null, file, {signal, onProgress, value: this.value}))
      .then((answer) => {
        if (signal.aborted || this._upload !== upload) return;
        this._upload = null;
        const stored = answer !== null && typeof answer === 'object' ? answer : {value: answer};
        const current = this.value || {};
        const next = {...current, value: stored.value === undefined || stored.value === null ? '' : String(stored.value)};
        if (stored.href) {
          this._releaseObjectUrl();
          next.href = String(stored.href);
        }
        delete next.file;
        this._value = normaliseImageValue(next);
        this.announce(this.sfWord('uploaded'));
        this.requestComponentUpdate('upload-done');
        this._emitValue({value: this._value, file: null, source: 'upload'}, ['change']);
      })
      .catch((error) => {
        if (signal.aborted || this._upload !== upload) return;
        upload.state = 'error';
        upload.message = String(error?.message || '');
        const message = upload.message
          ? this.sfWord('upload-failed-line', {vars: {message: upload.message}})
          : this.sfWord('upload-failed-plain');
        this._say('error', message);
        this.announce(message);
        this.requestComponentUpdate('upload-failed');
        this.sfSyncFormState();
      });
  }

  _retryUpload() {
    const file = this.value?.file;
    if (!file || this._upload?.state !== 'error') return 'unchanged';
    this._say('', '');
    this._send(file, this._upload.previous);
    return 'applied';
  }

  // Cancel a transfer, or give up on a failed one: the stored image comes
  // back (or the field is empty again), as before the choice.
  _cancelUpload() {
    const upload = this._upload;
    if (!upload) return 'unchanged';
    upload.controller?.abort();
    this._upload = null;
    this._releaseObjectUrl();
    this._value = upload.previous;
    this._say('', '');
    this._focusAfterRender = 'choose';
    this.announce(this.sfWord('upload-cancelled'));
    this.requestComponentUpdate('upload-cancelled');
    this._emitValue({value: this._value, file: null, source: 'cancel'});
    return 'applied';
  }

  // The person removed the image. Focus goes to «Выбрать…», which is where the
  // removed button stood, so the keyboard does not fall back to the page. Not
  // called remove(): that is the element's own removal from the document.
  _removeImage() {
    const previous = this.value;
    if (!previous) return 'empty';
    if (!this.interactive) return 'inactive';
    this._upload?.controller?.abort();
    this._upload = null;
    this._releaseObjectUrl();
    this._value = null;
    this._say('', '');
    this._editor = null;
    const input = this.input();
    if (input) input.value = '';
    this._focusAfterRender = 'choose';
    // A required field emptied from code says so at once.
    if (this.required) this._missingShown = true;
    this.announce(this.text('removed'));
    this.requestComponentUpdate('value');
    this._emitValue({value: null, file: null, source: 'remove'});
    this.sfEmit('detach', {value: previous, name: this.name});
    return 'applied';
  }

  _reject(rejected, source) {
    const files = rejected.map((entry) => entry.file);
    this.announce(rejected.map((entry) => entry.message).join('. '));
    this.sfEmit('rejected', {files, rejected, accept: this.accept, source});
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
  // A transfer that ends (source upload) sends change alone: the form value
  // moved from the File to the stored id.
  _emitValue({value, file, source}, types = ['input', 'change']) {
    this.sfSyncFormState();
    for (const type of types) this.sfEmit(type, {value, file, source, name: this.name});
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
    const files = Array.from(event.target?.files || []);
    if (files.length) this._takeFiles(files, 'input');
    // The same file chosen again is a choice again.
    if (event.target && !this._uploader) event.target.value = '';
  }

  onInputEvent(event) {
    event.stopPropagation();
  }

  // The inner sf-input and sf-switch (description, decorative, address) send
  // their native input and change; they are this field's parts, so they stop
  // here and the field says its own.
  stopInner(event) {
    event.stopPropagation();
  }

  // «Выбрать…» / «Заменить…»: the dialog when the page gave one source, the
  // menu of sources when it gave more (C94 point 5).
  onChoosePress(event) {
    if (!this.interactive) return;
    const sources = this.sourceList;
    if (sources.length > 1) {
      const menu = this.menu;
      const trigger = event?.currentTarget?.querySelector?.('button') ?? event?.currentTarget;
      if (menu && trigger) customElements.whenDefined('sf-menu-context').then(() => menu.toggleFor(trigger, {side: 'block-end', align: 'start'}));
      return;
    }
    this._useSource(sources[0]);
  }

  onMenuSelect(event) {
    event.stopPropagation();
    const id = event.detail?.id;
    if (id) this._useSource(id);
  }

  _useSource(source) {
    if (!this.interactive) return;
    if (source === 'device') {
      this.choose();
      return;
    }
    if (source === 'library') {
      // The library is the page's (Larena «Файлы», the letter's images): it
      // opens its own and calls setValue() with the picture.
      this.sfEmit('library', {value: this.value, name: this.name});
      return;
    }
    if (source === 'url') {
      this._urlOpen = true;
      this._urlError = '';
      this._focusAfterRender = 'url';
      this.requestComponentUpdate('url');
    }
  }

  _closeUrl() {
    this._urlOpen = false;
    this._urlError = '';
    this._focusAfterRender = 'choose';
    this.requestComponentUpdate('url');
  }

  // An address: the picture is read, checked against the minimum pixels and
  // taken as the value (change, source url). Nothing is uploaded: the address
  // is the stored image.
  async _takeUrl() {
    const field = this.querySelector(':scope .sf-image-field-url-input');
    const address = String(field?.value ?? '').trim();
    if (!address) return 'no-address';
    const dimensions = await readDimensions(address);
    const {minWidth, minHeight} = this.limits;
    let problem = '';
    if (!dimensions) problem = this.sfWord('url-failed');
    else if ((minWidth && dimensions.width < minWidth) || (minHeight && dimensions.height < minHeight)) {
      problem = this._rejection({name: address}, minWidth && dimensions.width < minWidth ? 'min-width' : 'min-height', {
        dimensions,
        min: minWidth && dimensions.width < minWidth ? minWidth : minHeight,
      }).message;
    }
    if (problem) {
      this._urlError = problem;
      this.requestComponentUpdate('url');
      return 'rejected';
    }
    this._upload?.controller?.abort();
    this._upload = null;
    this._releaseObjectUrl();
    this._value = normaliseImageValue({value: '', href: address, width: dimensions.width, height: dimensions.height});
    this._urlOpen = false;
    this._urlError = '';
    this._say('', '');
    this._missingShown = false;
    this._focusAfterRender = 'choose';
    this.requestComponentUpdate('value');
    this._emitValue({value: this._value, file: null, source: 'url'});
    return 'applied';
  }

  onUrlKey(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this._takeUrl();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this._closeUrl();
    }
  }

  // The description and «Декоративная» (C94 point 4): written into the value
  // as the person types; input on each key, change when it is committed.
  onAltInput(event, type) {
    event.stopPropagation();
    const value = this.value;
    if (!value) return;
    const text = String(event.target?.value ?? event.currentTarget?.value ?? '');
    this._value = {...value, alt: text};
    this.sfSyncFormState();
    this._emitValue({value: this._value, file: value.file ?? null, source: 'alt'}, [type]);
  }

  onDecorative(event) {
    event.stopPropagation();
    const value = this.value;
    if (!value) return;
    const host = event.currentTarget;
    const on = Boolean(host?.checked ?? event.target?.checked);
    const next = {...value};
    if (on) next.decorative = true;
    else delete next.decorative;
    this._value = next;
    this.requestComponentUpdate('alt');
    this._emitValue({value: next, file: value.file ?? null, source: 'alt'});
  }

  // --------------------------------------------------------------- editor
  // The frame (crop) and the focal point (C94 point 3): edited on the picture
  // itself, never cut. The working copy is kept until «Готово».

  get cropAspect() {
    const own = aspectRatio(this.getAttribute('aspect'));
    if (own) return own;
    if (this.shapeName === 'circle') return '1 / 1';
    return this.layoutName === 'row' ? '1 / 1' : '16 / 9';
  }

  _openEditor() {
    const value = this.value;
    const modes = this.editList;
    if (!value?.href || !modes.length || !this.interactive) return 'unchanged';
    this._editor = {
      mode: modes[0],
      crop: normaliseCrop(value.crop) || {aspect: this.cropAspect.replace(/\s/gu, ''), zoom: 1, x: 0.5, y: 0.5},
      focus: normaliseFocus(value.focus) || {x: 0.5, y: 0.5},
    };
    this._focusAfterRender = 'stage';
    this.requestComponentUpdate('editor');
    return 'applied';
  }

  _setEditorMode(mode) {
    if (!this._editor || !EDITS.includes(mode)) return;
    this._editor.mode = mode;
    this.requestComponentUpdate('editor');
  }

  _closeEditor(save) {
    const editor = this._editor;
    if (!editor) return;
    this._editor = null;
    this._focusAfterRender = 'edit';
    if (save && this.value) {
      const next = {...this.value};
      const modes = this.editList;
      if (modes.includes('crop')) next.crop = {...editor.crop};
      if (modes.includes('focus')) next.focus = {...editor.focus};
      this._value = next;
      this._emitValue({value: next, file: next.file ?? null, source: 'edit'});
    }
    this.requestComponentUpdate('editor');
  }

  _zoomBy(step) {
    const editor = this._editor;
    if (!editor) return;
    const zoom = Math.round((editor.crop.zoom + step) * 100) / 100;
    editor.crop.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    this.requestComponentUpdate('editor');
  }

  _moveEditor(dx, dy) {
    const editor = this._editor;
    if (!editor) return;
    const clamp = (number) => Math.max(0, Math.min(1, number));
    const point = editor.mode === 'focus' ? editor.focus : editor.crop;
    point.x = Math.round(clamp(point.x + dx) * 1000) / 1000;
    point.y = Math.round(clamp(point.y + dy) * 1000) / 1000;
    this.requestComponentUpdate('editor');
  }

  onStageKey(event) {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      // The frame moves the other way from the picture under it: an arrow to
      // the right shows more of the right.
      this._moveEditor(move[0], move[1]);
      return;
    }
    if (this._editor?.mode === 'crop' && ['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      this._zoomBy(event.key === '-' ? -0.1 : 0.1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this._closeEditor(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this._closeEditor(false);
    }
  }

  onStagePointer(event) {
    const editor = this._editor;
    const stage = event.currentTarget;
    if (!editor || !stage) return;
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const clamp = (number) => Math.max(0, Math.min(1, number));
    if (event.type === 'pointerdown') {
      stage.setPointerCapture?.(event.pointerId);
      this._drag = {x: event.clientX, y: event.clientY, crop: {...editor.crop}};
    }
    if (!this._drag) return;
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      this._drag = null;
      return;
    }
    if (editor.mode === 'focus') {
      editor.focus = {x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height)};
    } else if (event.type === 'pointermove') {
      const k = 1 / Math.max(1, editor.crop.zoom);
      editor.crop.x = clamp(this._drag.crop.x - ((event.clientX - this._drag.x) / box.width) * k);
      editor.crop.y = clamp(this._drag.crop.y - ((event.clientY - this._drag.y) / box.height) * k);
    }
    this.requestComponentUpdate('editor');
  }

  _editorState() {
    const editor = this._editor;
    if (!editor) return '';
    const pct = (number) => Math.round(number * 100);
    if (editor.mode === 'focus') return this.sfWord('focus-state', {vars: {x: pct(editor.focus.x), y: pct(editor.focus.y)}});
    return this.sfWord('crop-state', {vars: {
      aspect: String(editor.crop.aspect || '').replace('/', ':'),
      zoom: pct(editor.crop.zoom),
      x: pct(editor.crop.x),
      y: pct(editor.crop.y),
    }});
  }

  // ------------------------------------------------------- drop and paste

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
    this._takeFiles(files, 'drop');
  }

  // A picture pasted while the field has focus (IF-5): the files the
  // clipboard holds, as a drop's. Text pasted elsewhere -- the description,
  // the address -- is not this.
  onPaste(event) {
    if (!this.interactive) return;
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;
    event.preventDefault();
    this._takeFiles(files, 'paste');
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
      const target = this._focusAfterRender;
      this._focusAfterRender = '';
      // The sf-button host, not its inner button: a button drawn in this
      // render has not drawn its own yet, and the host's focus() waits for it.
      const selector = {
        choose: ':scope .sf-image-field-actions :is(sf-button, sf-button-icon):not([disabled])',
        url: ':scope .sf-image-field-url-input',
        stage: ':scope .sf-image-field-stage',
        edit: ':scope .sf-image-field-edit',
      }[target];
      this.querySelector(selector || '')?.focus?.({preventScroll: true});
    }
    this.sfSyncFormState();
    return undefined;
  }

  templateContext() {
    const props = this.getPropsContext();
    const value = this.value;
    const upload = this._upload;
    const notice = this._notice;
    const missing = this._missingShown && this.required && !value && !this.disabled;
    const field = createFieldContract(this, {
      prefix: 'sf-image-field',
      required: this.required,
      // error is a dated alias of invalid (§17.2, aliases.json).
      invalid: this.invalid || this.hasAttribute('error') || missing || notice?.kind === 'error',
      hint: this.hint,
      errorMessage: this.errorMessage,
    });
    const pageError = (this.invalid || this.hasAttribute('error'))
      ? (this.hasSlotContent?.('error') ? this.getSlotContent('error') : this.errorMessage)
      : '';
    const hintContent = this.hasSlotContent?.('hint') ? this.getSlotContent('hint') : this.hint;
    // The page's error first, then what the field says itself, then the hint.
    let message = hintContent;
    let messageKind = 'hint';
    if (pageError) {
      message = pageError;
      messageKind = 'error';
    } else if (notice) {
      message = notice.text;
      messageKind = notice.kind;
    } else if (missing) {
      message = this.sfWord('value-missing');
      messageKind = 'error';
    }
    const fileName = value?.label || '';
    const shownName = fileName || (value ? this.sfWord('group') : '');
    const words = Object.fromEntries(WORD_KEYS.map((key) => [camel(key), this.sfWord(key)]));
    const sources = this.sourceList;
    const editor = this._editor;
    const dimensions = this.dimensionsOf(value);

    return this.createTemplateContext({
      ...props,
      component: this,
      id: this._id,
      field,
      value,
      size: this.size,
      layout: this.layoutName,
      shape: this.shapeName,
      fit: this.fitName,
      // The frame of the preview: the page's aspect, else a circle's square,
      // else the picture's own proportion once known.
      frameAspect: aspectRatio(this.getAttribute('aspect'))
        || (this.shapeName === 'circle' ? '1 / 1' : dimensions ? `${dimensions.width} / ${dimensions.height}` : '16 / 9'),
      transparent: mayBeTransparent(value),
      accept: this.accept,
      fileName: shownName,
      metaText: this.metaText(value),
      broken: Boolean(value?.href && this._failed.has(value.href)),
      dragging: this.dragging && this.interactive,
      interactive: this.interactive,
      coarse: this._coarse,
      required: this.required,
      removable: !this.required,
      upload,
      sources,
      menuEntries: sources.length > 1 ? sources.map((source) => ({
        id: source,
        text: source === 'library'
          ? (this.getAttribute('library-label') || words.sourceLibrary)
          : source === 'device' ? (this._coarse ? words.sourceDeviceCoarse : words.sourceDevice) : words.sourceUrl,
        icon: {device: 'upload', library: 'photo_library', url: 'link'}[source],
      })) : [],
      menuSize: this.size === '1/2' ? '1/2' : '1',
      edits: this.editList,
      editor,
      editorState: this._editorState(),
      altMode: this.altMode,
      altMissing: this._missingShown && this._altMissing(),
      urlOpen: this._urlOpen,
      urlError: this._urlError,
      announcement: this.announcement,
      message,
      messageKind,
      words,
      names: {
        group: this.label || this.ariaLabel || words.group,
        choose: words.chooseName,
        replace: fileName ? `${words.replaceName} ${this.quote(fileName)}` : words.replaceName,
        remove: fileName ? `${words.removeName} ${this.quote(fileName)}` : words.removeName,
        edit: fileName ? `${words.editName} ${this.quote(fileName)}` : words.editName,
        cancel: fileName ? `${words.cancelUploadName} ${this.quote(fileName)}` : words.cancelUploadName,
        retry: fileName ? `${words.retryName} ${this.quote(fileName)}` : words.retryName,
        upload: this.sfWord('upload-name', {vars: {name: fileName || words.group}}),
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

SfImageField.define('sf-input-image');

export {SfImageField};
