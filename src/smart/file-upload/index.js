import {
  bindFileUpload,
  setFileUploadItems,
  unbindFileUpload,
} from '../../component/file-upload/js/_file_upload';
import SfBaseElement from '../../core/js/smart-base';
import { renderFileUploadTemplate } from './js/templates/default';
import { FIELD_SIZES, fieldSize } from '../../component/field-size';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-file-upload", code, words).
const FILE_UPLOAD_TEXT = {
  en: {
    linkText: 'Click to upload',
    text: 'or drag and drop',
    retry: 'Try again',
  },
  ru: {
    linkText: 'Выберите файл',
    text: 'или перетащите его сюда',
    retry: 'Повторить',
  },
};


function formatAcceptValue(value) {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\./, ''))
    .map((part) => {
      if (part.includes('/')) {
        return part.split('/').pop() || part;
      }

      return part;
    })
    .map((part) => part.toUpperCase());

  return parts.join(', ');
}

class SfFileUpload extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '1', values: FIELD_SIZES },
      icon: { default: 'upload_file' },
      linkText: { default: '' },
      text: { default: 'or drag and drop' },
      formats: { default: '' },
      supportingText: { default: '' },
      accept: { default: '' },
      multiple: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      ariaLabel: { default: '' },
    };
  }


  constructor() {
    super();
    this._items = [];
    this._boundRoot = null;
    this._onSelect = null;
    this._onRemove = null;
    this._onRetry = null;
  }

  get componentName() {
    return 'file-upload';
  }

  shouldClearLightDomBeforeFirstRender() {
    return super.shouldClearLightDomBeforeFirstRender()
      || (this.templateName === 'default'
        && !!this.querySelector(':scope > .sf-file-upload[data-render-managed="1"]'));
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-file-upload');
  }

  get icon() {
    return this.getAttribute('icon') || 'upload_file';
  }

  get linkText() {
    return this.getAttribute('link-text') || pageText(FILE_UPLOAD_TEXT, "linkText", this);
  }

  get text() {
    return this.getAttribute('text') || pageText(FILE_UPLOAD_TEXT, "text", this);
  }

  get formats() {
    return (
      this.getAttribute('formats') ||
      formatAcceptValue(this.accept) ||
      // The component cannot know what a field accepts: it names formats only
      // when the host gives them or an accept list says so.
      ''
    );
  }

  get supportingText() {
    return (
      this.getAttribute('supporting-text') ||
      this.formats
    );
  }

  get accept() {
    return this.getAttribute('accept') || '';
  }

  get multiple() {
    return this.getBooleanAttr('multiple', false);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  get items() {
    return Array.isArray(this._items) ? this._items : [];
  }

  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    this.syncRuntimeItems();
    this.requestComponentUpdate('items');
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      linkText: this.getAttribute("link-text") || pageText(FILE_UPLOAD_TEXT, "linkText", this),
      text: this.getAttribute("text") || pageText(FILE_UPLOAD_TEXT, "text", this),
      retryText: pageText(FILE_UPLOAD_TEXT, "retry", this),
      component: this,
      formats: this.formats,
      supportingText: this.supportingText,
      items: this.items,
    });
  }

  template() {
    return renderFileUploadTemplate(this.templateContext());
  }

  get state() {
    return {
      size: this.size,
      icon: this.icon,
      linkText: this.linkText,
      text: this.text,
      formats: this.formats,
      supportingText: this.supportingText,
      accept: this.accept,
      multiple: this.multiple,
      disabled: this.disabled,
      items: this.items,
    };
  }

  getItems() {
    return this.items;
  }

  onFileAdd(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:file-add', handler, options);
    }

    return this;
  }

  onFileError(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:file-error', handler, options);
    }

    return this;
  }

  onFileComplete(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:file-complete', handler, options);
    }

    return this;
  }

  onFileRemove(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:remove', handler, options);
    }

    return this;
  }

  onFileRetry(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:retry', handler, options);
    }

    return this;
  }

  onComplete(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:complete', handler, options);
    }

    return this;
  }

  setItems(nextItems = []) {
    this.items = nextItems;
    return this;
  }

  clear() {
    this.items = [];
    return this;
  }

  removeItem(index) {
    const nextItems = Array.from(this.items);
    const normalizedIndex = Number(index);

    if (
      !Number.isInteger(normalizedIndex) ||
      normalizedIndex < 0 ||
      normalizedIndex >= nextItems.length
    ) {
      return this;
    }

    nextItems.splice(normalizedIndex, 1);
    this.items = nextItems;
    return this;
  }

  setState(nextState = {}) {
    if (!nextState || typeof nextState !== 'object') {
      return this;
    }

    const attributeState = { ...nextState };

    if ('items' in attributeState) {
      this._items = Array.isArray(attributeState.items) ? attributeState.items : [];
      delete attributeState.items;
    }

    super.setState(attributeState);
    this.syncRuntimeItems();
    this.requestComponentUpdate('state');
    return this;
  }

  beforeRender() {
    this.teardownRuntime();
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);

    this._boundRoot = this.querySelector('.sf-file-upload');
    if (!this._boundRoot) {
      return;
    }

    bindFileUpload(this._boundRoot);
    this.syncRuntimeItems();

    this._onSelect = () => {
      this._items = Array.from(this._boundRoot?.__sfFileUploadItems || []);
      this.requestComponentUpdate('items');
    };

    this._onRemove = () => {
      this._items = Array.from(this._boundRoot?.__sfFileUploadItems || []);
      this.requestComponentUpdate('items');
    };

    this._onRetry = () => {
      this._items = Array.from(this._boundRoot?.__sfFileUploadItems || []);
      this.requestComponentUpdate('items');
    };

    this._boundRoot.addEventListener('sf-file-upload:select', this._onSelect);
    this._boundRoot.addEventListener('sf-file-upload:remove', this._onRemove);
    this._boundRoot.addEventListener('sf-file-upload:retry', this._onRetry);
  }

  onDisconnected() {
    this.teardownRuntime();
  }

  syncRuntimeItems() {
    if (!this._boundRoot) {
      return;
    }

    setFileUploadItems(this._boundRoot, this.items);
  }

  teardownRuntime() {
    if (this._boundRoot && this._onSelect) {
      this._boundRoot.removeEventListener('sf-file-upload:select', this._onSelect);
    }

    if (this._boundRoot && this._onRemove) {
      this._boundRoot.removeEventListener('sf-file-upload:remove', this._onRemove);
    }

    if (this._boundRoot && this._onRetry) {
      this._boundRoot.removeEventListener('sf-file-upload:retry', this._onRetry);
    }

    if (this._boundRoot) {
      unbindFileUpload(this._boundRoot);
      this._boundRoot = null;
    }

    this._onSelect = null;
    this._onRemove = null;
    this._onRetry = null;
  }
}

SfFileUpload.define('sf-file-upload');
